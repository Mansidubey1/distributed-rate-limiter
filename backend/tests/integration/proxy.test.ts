import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/db/prisma.js';

describe('LimiterLab Reverse Proxy Gateway - Integration Tests', () => {
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

  describe('GET /v1/proxy/presets', () => {
    it('should return curated demo API presets', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/proxy/presets',
      });

      expect(response.statusCode).toBe(200);
      const presets = JSON.parse(response.body);
      expect(Array.isArray(presets)).toBe(true);
      expect(presets.length).toBeGreaterThan(0);
      expect(presets[0]).toHaveProperty('id');
      expect(presets[0]).toHaveProperty('name');
      expect(presets[0]).toHaveProperty('url');
      expect(presets[0]).toHaveProperty('method');
    });
  });

  describe('POST /v1/proxy - SSRF & Validation Protection', () => {
    it('should return 400 when url is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/proxy',
        payload: {
          clientKey: 'test-client',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('url is required');
    });

    it('should return 403 when trying to access localhost', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/proxy',
        payload: {
          url: 'http://localhost:3000/health',
          clientKey: 'ssrf-test-client',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.decision).toBe('DENY');
      expect(body.error).toContain('blocked');
    });

    it('should return 403 when trying to access loopback IP 127.0.0.1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/proxy',
        payload: {
          url: 'http://127.0.0.1:8080/admin',
          clientKey: 'ssrf-test-client',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.decision).toBe('DENY');
      expect(body.error).toContain('blocked');
    });

    it('should return 403 when trying to access private network 10.0.0.1', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/proxy',
        payload: {
          url: 'http://10.0.0.1/sensitive-data',
          clientKey: 'ssrf-test-client',
        },
      });

      expect(response.statusCode).toBe(403);
    });

    it('should return 403 when trying to access AWS metadata IP 169.254.169.254', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/proxy',
        payload: {
          url: 'http://169.254.169.254/latest/meta-data/',
          clientKey: 'ssrf-test-client',
        },
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('POST /v1/proxy - Rate Limiting & Gateway Forwarding', () => {
    it('should enforce rate limit and return 429 when client quota is exceeded', async () => {
      const clientKey = 'proxy-throttled-client';
      // Create a client with burst size = 1
      await prisma.client.create({
        data: {
          clientKey,
          algorithm: 'token_bucket',
          requestsPerSecond: 1,
          burstSize: 1,
          windowSize: 1,
          bucketState: {
            create: {
              tokens: 1,
              lastRefillAt: new Date(),
            },
          },
        },
      });

      // Mock global fetch to intercept outbound call
      const originalFetch = global.fetch;
      const mockFetch = vi.fn().mockResolvedValue({
        status: 200,
        statusText: 'OK',
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ message: 'success from target' }),
        text: async () => JSON.stringify({ message: 'success from target' }),
      });
      global.fetch = mockFetch;

      try {
        // 1st request -> ALLOW (passes rate limit, fetches target)
        const res1 = await app.inject({
          method: 'POST',
          url: '/v1/proxy',
          payload: {
            url: 'https://httpbin.org/get',
            method: 'GET',
            clientKey,
          },
        });

        expect(res1.statusCode).toBe(200);
        expect(res1.headers['x-ratelimit-limit']).toBe('1');
        expect(res1.headers['x-ratelimit-remaining']).toBe('0');
        const body1 = JSON.parse(res1.body);
        expect(body1.decision).toBe('ALLOW');
        expect(body1.rateLimit.remaining).toBe(0);
        expect(body1.body.message).toBe('success from target');
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // 2nd request -> DENY (429 Too Many Requests, mockFetch NOT called again)
        const res2 = await app.inject({
          method: 'POST',
          url: '/v1/proxy',
          payload: {
            url: 'https://httpbin.org/get',
            method: 'GET',
            clientKey,
          },
        });

        expect(res2.statusCode).toBe(429);
        expect(res2.headers['x-ratelimit-remaining']).toBe('0');
        expect(res2.headers['retry-after']).toBeDefined();
        const body2 = JSON.parse(res2.body);
        expect(body2.decision).toBe('DENY');
        expect(body2.statusCode).toBe(429);
        expect(body2.error).toContain('Rate limit exceeded');
        // Fetch was not called for the throttled request!
        expect(mockFetch).toHaveBeenCalledTimes(1);
      } finally {
        global.fetch = originalFetch;
      }
    });

    it('should forward custom headers, method, and POST body to target API', async () => {
      const clientKey = 'proxy-post-client';
      const originalFetch = global.fetch;
      let capturedRequest: { url: string; method: string; headers: any; body: any } | null = null;

      const mockFetch = vi.fn().mockImplementation(async (url, init) => {
        capturedRequest = {
          url: String(url),
          method: init.method,
          headers: init.headers,
          body: init.body,
        };
        return {
          status: 201,
          statusText: 'Created',
          ok: true,
          headers: new Headers({ 'content-type': 'application/json', 'x-custom-res': 'val' }),
          json: async () => ({ id: 101, title: 'New Post' }),
          text: async () => JSON.stringify({ id: 101, title: 'New Post' }),
        };
      });
      global.fetch = mockFetch;

      try {
        const response = await app.inject({
          method: 'POST',
          url: '/v1/proxy',
          payload: {
            url: 'https://jsonplaceholder.typicode.com/posts',
            method: 'POST',
            clientKey,
            headers: {
              'X-User-Role': 'Admin',
              'Authorization': 'Bearer test-token',
            },
            body: {
              title: 'New Post',
              userId: 1,
            },
          },
        });

        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.body);
        expect(body.decision).toBe('ALLOW');
        expect(body.statusCode).toBe(201);
        expect(body.body.title).toBe('New Post');
        expect(body.headers['x-custom-res']).toBe('val');

        // Verify request was dispatched properly
        expect(capturedRequest).toBeDefined();
        expect(capturedRequest?.method).toBe('POST');
        expect(capturedRequest?.headers['X-User-Role']).toBe('Admin');
        expect(capturedRequest?.headers['Authorization']).toBe('Bearer test-token');
        expect(JSON.parse(capturedRequest?.body)).toEqual({ title: 'New Post', userId: 1 });
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});
