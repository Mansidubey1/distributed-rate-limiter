import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

describe('Rate Limiter API - Integration Tests (Phase 2)', () => {
  let app: FastifyInstance;
  const TEST_ADMIN_KEY = 'test-secret-admin-key';

  beforeAll(async () => {
    process.env.ADMIN_API_KEY = TEST_ADMIN_KEY;
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    delete process.env.ADMIN_API_KEY;
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test database tables in correct order
    await prisma.slidingWindowRequest.deleteMany({});
    await prisma.bucketState.deleteMany({});
    await prisma.client.deleteMany({});
  });

  const authHeaders = {
    authorization: `Bearer ${TEST_ADMIN_KEY}`,
  };

  describe('GET /health', () => {
    it('should return 200 and database connected status without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.database).toBe('connected');
    });
  });

  describe('Admin Authentication', () => {
    it('should return 401 Unauthorized when admin key is missing on admin routes', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        payload: {
          clientKey: 'unauth-client',
          requestsPerSecond: 10,
          burstSize: 20,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Unauthorized');
    });

    it('should return 401 Unauthorized when admin key is invalid on /metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: {
          authorization: 'Bearer wrong-key',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should allow access to admin routes with valid Bearer token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'auth-success-client',
          requestsPerSecond: 10,
          burstSize: 20,
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('Admin Client CRUD API', () => {
    it('should create a token_bucket client with initialized bucket state', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'client-tb-1',
          algorithm: 'token_bucket',
          requestsPerSecond: 10,
          burstSize: 20,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.clientKey).toBe('client-tb-1');
      expect(body.algorithm).toBe('token_bucket');
      expect(body.requestsPerSecond).toBe(10);
      expect(body.burstSize).toBe(20);
      expect(body.windowSize).toBe(1);

      // Verify bucket state in database
      const dbClient = await prisma.client.findUnique({
        where: { clientKey: 'client-tb-1' },
        include: { bucketState: true },
      });
      expect(dbClient).toBeDefined();
      expect(dbClient?.bucketState?.tokens).toBe(20);
    });

    it('should create a sliding_window client with windowSize', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'client-sw-1',
          algorithm: 'sliding_window',
          requestsPerSecond: 50,
          windowSize: 60,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.clientKey).toBe('client-sw-1');
      expect(body.algorithm).toBe('sliding_window');
      expect(body.requestsPerSecond).toBe(50);
      expect(body.windowSize).toBe(60);
    });

    it('should return 400 for unsupported algorithm', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'invalid-algo-client',
          algorithm: 'leaky_bucket',
          requestsPerSecond: 10,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unsupported rate limiting algorithm');
    });

    it('should return 409 Conflict if clientKey already exists', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'duplicate-client',
          requestsPerSecond: 5,
          burstSize: 10,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'duplicate-client',
          requestsPerSecond: 5,
          burstSize: 10,
        },
      });

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('already exists');
    });

    it('should get client configuration', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'get-test',
          requestsPerSecond: 15,
          burstSize: 30,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: '/v1/admin/clients/get-test',
        headers: authHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.clientKey).toBe('get-test');
      expect(body.requestsPerSecond).toBe(15);
      expect(body.burstSize).toBe(30);
    });

    it('should update client configuration', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'update-test',
          requestsPerSecond: 10,
          burstSize: 20,
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/v1/admin/clients/update-test',
        headers: authHeaders,
        payload: {
          requestsPerSecond: 25,
          burstSize: 50,
          windowSize: 5,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.requestsPerSecond).toBe(25);
      expect(body.burstSize).toBe(50);
      expect(body.windowSize).toBe(5);
    });

    it('should delete client and cascade delete state', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'delete-test',
          requestsPerSecond: 10,
          burstSize: 20,
        },
      });

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: '/v1/admin/clients/delete-test',
        headers: authHeaders,
      });
      expect(deleteRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: '/v1/admin/clients/delete-test',
        headers: authHeaders,
      });
      expect(getRes.statusCode).toBe(404);
    });
  });

  describe('Rate Limiter Check API - POST /v1/check', () => {
    it('should evaluate token_bucket client and return unified shape', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'tb-check-client',
          algorithm: 'token_bucket',
          requestsPerSecond: 1,
          burstSize: 2,
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey: 'tb-check-client' },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['x-ratelimit-limit']).toBe('2');
      expect(response.headers['x-ratelimit-remaining']).toBe('1');
      expect(response.headers['x-ratelimit-reset']).toBeDefined();

      const body = JSON.parse(response.body);
      expect(body.decision).toBe('ALLOW');
      expect(body.algorithm).toBe('token_bucket');
      expect(body.limit).toBe(2);
      expect(body.remaining).toBe(1);
      expect(body.reset).toBeDefined();
    });

    it('should evaluate sliding_window client and enforce limits', async () => {
      await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey: 'sw-check-client',
          algorithm: 'sliding_window',
          requestsPerSecond: 2,
          windowSize: 10,
        },
      });

      // Request 1: ALLOW (2 -> 1 remaining)
      const res1 = await app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey: 'sw-check-client' },
      });
      expect(res1.statusCode).toBe(200);
      const body1 = JSON.parse(res1.body);
      expect(body1.decision).toBe('ALLOW');
      expect(body1.algorithm).toBe('sliding_window');
      expect(body1.remaining).toBe(1);

      // Request 2: ALLOW (1 -> 0 remaining)
      const res2 = await app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey: 'sw-check-client' },
      });
      expect(res2.statusCode).toBe(200);
      const body2 = JSON.parse(res2.body);
      expect(body2.decision).toBe('ALLOW');
      expect(body2.remaining).toBe(0);

      // Request 3: DENY (429 Too Many Requests)
      const res3 = await app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey: 'sw-check-client' },
      });
      expect(res3.statusCode).toBe(429);
      expect(res3.headers['retry-after']).toBeDefined();
      const body3 = JSON.parse(res3.body);
      expect(body3.decision).toBe('DENY');
      expect(body3.algorithm).toBe('sliding_window');
      expect(body3.remaining).toBe(0);
    });
  });

  describe('Stats & Metrics Endpoints', () => {
    it('should track per-client stats and aggregate in /metrics', async () => {
      const clientKey = 'stats-client';
      await app.inject({
        method: 'POST',
        url: '/v1/admin/clients',
        headers: authHeaders,
        payload: {
          clientKey,
          algorithm: 'token_bucket',
          requestsPerSecond: 1,
          burstSize: 1,
        },
      });

      // 1st request -> ALLOW
      await app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey },
      });

      // 2nd request -> DENY
      await app.inject({
        method: 'POST',
        url: '/v1/check',
        payload: { clientKey },
      });

      // Check per-client stats
      const statsRes = await app.inject({
        method: 'GET',
        url: `/v1/admin/clients/${clientKey}/stats`,
        headers: authHeaders,
      });

      expect(statsRes.statusCode).toBe(200);
      const statsBody = JSON.parse(statsRes.body);
      expect(statsBody.clientKey).toBe(clientKey);
      expect(statsBody.algorithm).toBe('token_bucket');
      expect(statsBody.totalRequests).toBe(2);
      expect(statsBody.allowedRequests).toBe(1);
      expect(statsBody.deniedRequests).toBe(1);

      // Check global metrics
      const metricsRes = await app.inject({
        method: 'GET',
        url: '/metrics',
        headers: authHeaders,
      });

      expect(metricsRes.statusCode).toBe(200);
      const metricsBody = JSON.parse(metricsRes.body);
      expect(metricsBody.totalRequests).toBeGreaterThanOrEqual(2);
      expect(metricsBody.allowedRequests).toBeGreaterThanOrEqual(1);
      expect(metricsBody.deniedRequests).toBeGreaterThanOrEqual(1);
      expect(metricsBody.clients).toBeGreaterThanOrEqual(1);
    });
  });
});
