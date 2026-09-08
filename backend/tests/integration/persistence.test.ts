import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

describe('Rate Limiter Persistence Tests', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    await prisma.slidingWindowRequest.deleteMany({});
    await prisma.bucketState.deleteMany({});
    await prisma.client.deleteMany({});
    app = buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('should persist token bucket state across service restart', async () => {
    const clientKey = 'persist-tb-client';

    // 1. Create client with burstSize = 10, requestsPerSecond = 0.001
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 0.001,
        burstSize: 10,
      },
    });
    expect(createRes.statusCode).toBe(201);

    // 2. Consume 4 tokens on the first service instance
    for (let i = 0; i < 4; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey },
      });
      expect(res.statusCode).toBe(200);
    }

    // 3. Simulate service shutdown & restart
    await app.close();
    const newApp = buildApp();
    await newApp.ready();

    // 4. Request on new service instance
    const checkRes = await newApp.inject({
      method: 'POST',
      url: '/v1/check',
      payload: { clientKey },
    });

    expect(checkRes.statusCode).toBe(200);
    const body = JSON.parse(checkRes.body);
    expect(body.remaining).toBe(5); // (10 - 4) - 1 = 5

    await newApp.close();
  });

  it('should persist sliding window state across service restart', async () => {
    const clientKey = 'persist-sw-client';

    // 1. Create client with limit = 3, windowSize = 60s
    await app.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'sliding_window',
        requestsPerSecond: 3,
        windowSize: 60,
      },
    });

    // 2. Send 2 requests
    await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });

    // 3. Restart server
    await app.close();
    const newApp = buildApp();
    await newApp.ready();

    // 4. Send 3rd request -> should allow (remaining = 0)
    const res3 = await newApp.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(res3.statusCode).toBe(200);
    expect(JSON.parse(res3.body).remaining).toBe(0);

    // 5. Send 4th request -> should DENY (limit 3 reached within 60s)
    const res4 = await newApp.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(res4.statusCode).toBe(429);
    expect(JSON.parse(res4.body).decision).toBe('DENY');

    await newApp.close();
  });
});
