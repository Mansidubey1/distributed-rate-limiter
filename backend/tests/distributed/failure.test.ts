import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { setCustomRedisClient } from '../../src/db/redis.js';

describe('Distributed Failure & Resilience Tests (FR3.6)', () => {
  let app: FastifyInstance;
  let sharedRedis: any;

  beforeAll(async () => {
    process.env.DISTRIBUTED_MODE = 'true';
    sharedRedis = new (RedisMock as any)();
    setCustomRedisClient(sharedRedis);

    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    delete process.env.DISTRIBUTED_MODE;
    setCustomRedisClient(null);
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await sharedRedis.flushall();
    await prisma.slidingWindowRequest.deleteMany({});
    await prisma.bucketState.deleteMany({});
    await prisma.client.deleteMany({});
  });

  it('should return 503 on /v1/check when Redis fails in distributed mode, while admin endpoints continue working', async () => {
    const clientKey = 'failure-test-client';

    // 1. Create client (PostgreSQL-backed)
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 10,
        burstSize: 20,
      },
    });
    expect(createRes.statusCode).toBe(201);

    // 2. Normal check works
    const check1 = await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(check1.statusCode).toBe(200);

    // 3. Simulate Redis outage by setting an error-throwing Redis client
    const brokenRedis: any = {
      eval: async () => {
        throw new Error('Connection to Redis lost');
      },
      ping: async () => {
        throw new Error('Connection refused');
      },
      status: 'end',
    };
    setCustomRedisClient(brokenRedis);

    // 4. Rate check should fail gracefully with 503 Service Unavailable (not fail open)
    const checkUnavailable = await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(checkUnavailable.statusCode).toBe(503);
    const body = JSON.parse(checkUnavailable.body);
    expect(body.error).toBe('Rate limiter temporarily unavailable');

    // 5. Admin endpoints (Postgres-backed) continue working normally
    const getClientRes = await app.inject({ method: 'GET', url: `/v1/admin/clients/${clientKey}` });
    expect(getClientRes.statusCode).toBe(200);

    // 6. Redis recovers -> rate limiting resumes smoothly
    setCustomRedisClient(sharedRedis);
    const checkRecovered = await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(checkRecovered.statusCode).toBe(200);
  });
});
