import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

describe('Rate Limiter Concurrency Tests (Phase 2)', () => {
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

  it('Token Bucket: should handle 100 simultaneous requests with burst=10 resulting in exactly 10 ALLOW and 90 DENY', async () => {
    const clientKey = 'concurrent-tb-client';
    const burstSize = 10;
    const requestsPerSecond = 0.0001; // Negligible refill during test

    // Create client
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond,
        burstSize,
      },
    });
    expect(createRes.statusCode).toBe(201);

    // Send 100 simultaneous requests using Promise.all
    const totalRequests = 100;
    const requestPromises = Array.from({ length: totalRequests }, () =>
      app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey },
      })
    );

    const responses = await Promise.all(requestPromises);

    let allowCount = 0;
    let denyCount = 0;

    for (const res of responses) {
      if (res.statusCode === 200) {
        const body = JSON.parse(res.body);
        expect(body.decision).toBe('ALLOW');
        allowCount++;
      } else if (res.statusCode === 429) {
        const body = JSON.parse(res.body);
        expect(body.decision).toBe('DENY');
        denyCount++;
      } else {
        throw new Error(`Unexpected status code: ${res.statusCode} - ${res.body}`);
      }
    }

    expect(allowCount).toBe(10);
    expect(denyCount).toBe(90);

    // Verify database token count is 0
    const finalState = await prisma.client.findUnique({
      where: { clientKey },
      include: { bucketState: true },
    });

    expect(finalState).toBeDefined();
    expect(Math.floor(finalState!.bucketState!.tokens)).toBe(0);
    expect(finalState!.allowedRequests).toBe(10);
    expect(finalState!.deniedRequests).toBe(90);
    expect(finalState!.totalRequests).toBe(100);
  });

  it('Sliding Window: should handle 100 simultaneous requests with limit=10 resulting in exactly 10 ALLOW and 90 DENY', async () => {
    const clientKey = 'concurrent-sw-client';
    const limit = 10;
    const windowSize = 60; // 60s window so no expiration during test run

    // Create client
    const createRes = await app.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'sliding_window',
        requestsPerSecond: limit,
        windowSize,
      },
    });
    expect(createRes.statusCode).toBe(201);

    // Send 100 simultaneous requests using Promise.all
    const totalRequests = 100;
    const requestPromises = Array.from({ length: totalRequests }, () =>
      app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey },
      })
    );

    const responses = await Promise.all(requestPromises);

    let allowCount = 0;
    let denyCount = 0;

    for (const res of responses) {
      if (res.statusCode === 200) {
        const body = JSON.parse(res.body);
        expect(body.decision).toBe('ALLOW');
        allowCount++;
      } else if (res.statusCode === 429) {
        const body = JSON.parse(res.body);
        expect(body.decision).toBe('DENY');
        denyCount++;
      } else {
        throw new Error(`Unexpected status code: ${res.statusCode} - ${res.body}`);
      }
    }

    expect(allowCount).toBe(10);
    expect(denyCount).toBe(90);

    // Verify database recorded timestamps and stats
    const windowRecordsCount = await prisma.slidingWindowRequest.count({
      where: { client: { clientKey } },
    });
    expect(windowRecordsCount).toBe(10);

    const finalClient = await prisma.client.findUnique({
      where: { clientKey },
    });
    expect(finalClient?.allowedRequests).toBe(10);
    expect(finalClient?.deniedRequests).toBe(90);
    expect(finalClient?.totalRequests).toBe(100);
  });
});
