import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import RedisMock from 'ioredis-mock';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';
import { setCustomRedisClient } from '../../src/db/redis.js';

describe('Distributed Multi-Instance Tests (Phase 3 - Shared Redis State)', () => {
  let appInstance1: FastifyInstance;
  let appInstance2: FastifyInstance;
  let appInstance3: FastifyInstance;
  let sharedRedis: any;

  beforeAll(async () => {
    process.env.DISTRIBUTED_MODE = 'true';
    sharedRedis = new (RedisMock as any)();
    setCustomRedisClient(sharedRedis);

    // Initialize 3 separate API instances with unique instance IDs
    appInstance1 = buildApp();
    appInstance2 = buildApp();
    appInstance3 = buildApp();

    await Promise.all([appInstance1.ready(), appInstance2.ready(), appInstance3.ready()]);
  });

  afterAll(async () => {
    delete process.env.DISTRIBUTED_MODE;
    setCustomRedisClient(null);
    await Promise.all([appInstance1.close(), appInstance2.close(), appInstance3.close()]);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await sharedRedis.flushall();
    await prisma.slidingWindowRequest.deleteMany({});
    await prisma.bucketState.deleteMany({});
    await prisma.client.deleteMany({});
  });

  it('Token Bucket: token consumed on Instance 1 is immediately reflected on Instance 2 and 3', async () => {
    const clientKey = 'shared-tb-client';

    // 1. Create client via Instance 1
    const createRes = await appInstance1.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 0.0001,
        burstSize: 5,
      },
    });
    expect(createRes.statusCode).toBe(201);

    // 2. Consume 2 tokens on Instance 1
    const res1 = await appInstance1.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(res1.statusCode).toBe(200);
    expect(JSON.parse(res1.body).remaining).toBe(4);

    const res2 = await appInstance1.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(res2.statusCode).toBe(200);
    expect(JSON.parse(res2.body).remaining).toBe(3);

    // 3. Instance 2 immediately sees 3 tokens left and consumes 1 -> remaining 2
    const res3 = await appInstance2.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(res3.statusCode).toBe(200);
    expect(JSON.parse(res3.body).remaining).toBe(2);

    // 4. Instance 3 immediately sees 2 tokens left and consumes 1 -> remaining 1
    const res4 = await appInstance3.inject({ method: 'POST', url: '/v1/check', payload: { clientKey } });
    expect(res4.statusCode).toBe(200);
    expect(JSON.parse(res4.body).remaining).toBe(1);
  });

  it('Distributed Concurrency: 100 simultaneous requests across 3 instances with limit=10 yields exactly 10 ALLOW', async () => {
    const clientKey = 'distributed-concurrent-client';

    await appInstance1.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 0.0001,
        burstSize: 10,
      },
    });

    // Distribute 100 concurrent requests evenly across all 3 instances
    const instances = [appInstance1, appInstance2, appInstance3];
    const totalRequests = 100;
    const promises = Array.from({ length: totalRequests }, (_, i) => {
      const targetApp = instances[i % instances.length];
      return targetApp.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey },
      });
    });

    const responses = await Promise.all(promises);

    let allowCount = 0;
    let denyCount = 0;

    for (const res of responses) {
      if (res.statusCode === 200) allowCount++;
      else if (res.statusCode === 429) denyCount++;
      else throw new Error(`Unexpected status: ${res.statusCode}`);
    }

    expect(allowCount).toBe(10);
    expect(denyCount).toBe(90);
  });

  it('Critical Distributed Test (PRD Section 22): 500 concurrent requests across 3 instances with limit=100 results in exactly 100 ALLOW and 400 DENY', async () => {
    const clientKey = 'critical-500-test-client';

    await appInstance1.inject({
      method: 'POST',
      url: '/v1/admin/clients',
      payload: {
        clientKey,
        algorithm: 'token_bucket',
        requestsPerSecond: 0.0001,
        burstSize: 100,
      },
    });

    const instances = [appInstance1, appInstance2, appInstance3];
    const totalRequests = 500;
    const promises = Array.from({ length: totalRequests }, (_, i) => {
      const targetApp = instances[i % instances.length];
      return targetApp.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey },
      });
    });

    const responses = await Promise.all(promises);

    let allowCount = 0;
    let denyCount = 0;

    for (const res of responses) {
      if (res.statusCode === 200) allowCount++;
      else if (res.statusCode === 429) denyCount++;
      else throw new Error(`Unexpected status: ${res.statusCode}`);
    }

    expect(allowCount).toBe(100);
    expect(denyCount).toBe(400);
  });
});
