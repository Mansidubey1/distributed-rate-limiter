import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

describe('Algorithm Switching Tests (FR2.3)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.slidingWindowRequest.deleteMany({});
    await prisma.bucketState.deleteMany({});
    await prisma.client.deleteMany({});
  });

  it('should switch from token_bucket to sliding_window cleanly and discard old bucket state', async () => {
    const clientKey = 'switch-client-1';

    // 1. Create with Token Bucket (burstSize: 2, 1 req/sec)
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 1,
        burstSize: 2,
      },
    });
    expect(createRes.statusCode).toBe(201);

    // 2. Consume both tokens -> 0 remaining
    await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });

    const tbDenied = await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(tbDenied.statusCode).toBe(429);

    // 3. Switch algorithm to Sliding Window (requestsPerSecond: 3, windowSize: 10s)
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/admin/clients/${clientKey}`,
      payload: {
        algorithm: 'sliding_window',
        requestsPerSecond: 3,
        windowSize: 10,
      },
    });
    expect(updateRes.statusCode).toBe(200);
    const updatedClient = JSON.parse(updateRes.body);
    expect(updatedClient.algorithm).toBe('sliding_window');

    // Verify old bucket state is deleted in DB
    const dbClient = await prisma.client.findUnique({
      where: { clientKey },
      include: { bucketState: true },
    });
    expect(dbClient?.bucketState).toBeNull();

    // 4. Send request using Sliding Window -> should start fresh and ALLOW
    const swRes1 = await app.inject({
      method: 'POST',
      url: '/v1/check',
      payload: { clientKey },
    });

    expect(swRes1.statusCode).toBe(200);
    const swBody1 = JSON.parse(swRes1.body);
    expect(swBody1.decision).toBe('ALLOW');
    expect(swBody1.algorithm).toBe('sliding_window');
    expect(swBody1.remaining).toBe(2); // 3 - 0 - 1 = 2
  });

  it('should switch from sliding_window to token_bucket with clean initial full bucket', async () => {
    const clientKey = 'switch-client-2';

    // 1. Create with Sliding Window (limit: 1, windowSize: 60s)
    await app.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'sliding_window',
        requestsPerSecond: 1,
        windowSize: 60,
      },
    });

    // 2. Consume limit -> next is denied
    await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    const swDenied = await app.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(swDenied.statusCode).toBe(429);

    // 3. Switch algorithm to Token Bucket (requestsPerSecond: 5, burstSize: 10)
    const updateRes = await app.inject({
      method: 'PUT',
      url: `/v1/admin/clients/${clientKey}`,
      payload: {
        algorithm: 'token_bucket',
        requestsPerSecond: 5,
        burstSize: 10,
      },
    });
    expect(updateRes.statusCode).toBe(200);

    // 4. Verify new token bucket starts with full capacity (10 tokens -> remaining 9 on check)
    const tbRes = await app.inject({
      method: 'POST',
      url: '/v1/check',
      payload: { clientKey },
    });

    expect(tbRes.statusCode).toBe(200);
    const tbBody = JSON.parse(tbRes.body);
    expect(tbBody.decision).toBe('ALLOW');
    expect(tbBody.algorithm).toBe('token_bucket');
    expect(tbBody.remaining).toBe(9);
  });
});
