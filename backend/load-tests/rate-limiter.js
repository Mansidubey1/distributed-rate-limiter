import http from 'k6/http';
import { check, sleep } from 'k6';

// k6 options for load testing
export const options = {
  scenarios: {
    // Scenario 1: Sustained 500 RPS
    rate_limit_500_rps: {
      executor: 'constant-arrival-rate',
      rate: 500,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 50,
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% server errors (500s)
    http_req_duration: ['p(95)<50', 'p(99)<100'], // 95% of requests < 50ms
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const CLIENT_KEY = 'k6-load-client';

export function setup() {
  // Create client configuration before starting load test
  const createPayload = JSON.stringify({
    clientKey: CLIENT_KEY,
    requestsPerSecond: 250,
    burstSize: 500,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/v1/admin/clients`, createPayload, params);
  console.log(`Setup client status: ${res.status}`);
}

export default function () {
  const payload = JSON.stringify({
    clientKey: CLIENT_KEY,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/v1/check`, payload, params);

  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'has rate limit limit header': (r) => r.headers['X-Ratelimit-Limit'] !== undefined || r.headers['x-ratelimit-limit'] !== undefined,
    'has rate limit remaining header': (r) => r.headers['X-Ratelimit-Remaining'] !== undefined || r.headers['x-ratelimit-remaining'] !== undefined,
  });
}
