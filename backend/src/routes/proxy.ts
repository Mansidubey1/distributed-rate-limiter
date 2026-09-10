import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { proxyService } from '../proxy/proxyService.js';
import { DEMO_API_PRESETS } from '../proxy/ssrfGuard.js';

export const proxyRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // 1. Get Curated Demo API Presets
  fastify.get('/v1/proxy/presets', async (_request, reply) => {
    return reply.status(200).send(DEMO_API_PRESETS);
  });

  // 2. Postman-style Reverse Proxy Gateway Endpoint
  fastify.post<{
    Body: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body?: any;
      params?: Record<string, string>;
      clientKey?: string;
    };
  }>('/v1/proxy', async (request, reply) => {
    try {
      const { url, method = 'GET', headers = {}, body, params, clientKey } = request.body || {};

      if (!url || typeof url !== 'string' || url.trim() === '') {
        return reply.status(400).send({ error: 'url is required and must be a valid HTTP(S) URL' });
      }

      const effectiveClientKey =
        clientKey && typeof clientKey === 'string' && clientKey.trim() !== ''
          ? clientKey.trim()
          : 'demo-client';

      const result = await proxyService.forwardRequest({
        url: url.trim(),
        method,
        headers,
        body,
        params,
        clientKey: effectiveClientKey,
        requestId: request.id,
      });

      // Set RFC RateLimit headers on the gateway response
      if (result.rateLimit) {
        reply.header('X-RateLimit-Limit', result.rateLimit.limit.toString());
        reply.header('X-RateLimit-Remaining', result.rateLimit.remaining.toString());
        reply.header('X-RateLimit-Reset', result.rateLimit.reset.toString());
      }

      if (result.rateLimit?.retryAfter !== undefined) {
        reply.header('Retry-After', result.rateLimit.retryAfter.toString());
      }

      reply.header('X-Instance-Id', result.instanceId);
      reply.header('X-Request-Id', result.requestId);

      // Return with the target response status code (e.g. 200, 201, 404, 429)
      return reply.status(result.statusCode).send(result);
    } catch (error: any) {
      if (error.details) {
        return reply.status(error.statusCode || 403).send(error.details);
      }
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal proxy error',
      });
    }
  });
};
