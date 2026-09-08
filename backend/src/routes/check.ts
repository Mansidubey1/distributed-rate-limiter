import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { rateLimiterService } from '../services/rateLimiter.js';
import { CheckRateLimitInput } from '../types/rateLimiter.js';

export const checkRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // FR1.3 & FR2.4: Unified Rate Limit Check Endpoint
  fastify.post<{
    Body: CheckRateLimitInput;
  }>('/v1/check', async (request, reply) => {
    try {
      const { clientKey } = request.body || {};

      if (!clientKey || typeof clientKey !== 'string' || clientKey.trim() === '') {
        return reply.status(400).send({ error: 'clientKey is required' });
      }

      const result = await rateLimiterService.checkRateLimit(clientKey, request.id);

      const instanceId = process.env.INSTANCE_ID || 'limiter-01';
      const requestId = request.id || `req-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

      // Set standard RateLimit headers (FR1.5 & FR2.5)
      reply.header('X-RateLimit-Limit', result.limit.toString());
      reply.header('X-RateLimit-Remaining', result.remaining.toString());
      reply.header('X-RateLimit-Reset', result.reset.toString());
      reply.header('X-Instance-Id', instanceId);
      reply.header('X-Request-Id', requestId);

      if (result.decision === 'ALLOW') {
        return reply.status(200).send({
          decision: 'ALLOW',
          algorithm: result.algorithm,
          limit: result.limit,
          remaining: result.remaining,
          reset: result.reset,
          instanceId,
          requestId,
        });
      } else {
        // Rate limit exceeded (DENY)
        if (result.retryAfter !== undefined) {
          reply.header('Retry-After', result.retryAfter.toString());
        }

        return reply.status(429).send({
          decision: 'DENY',
          algorithm: result.algorithm,
          limit: result.limit,
          remaining: 0,
          reset: result.reset,
          retryAfter: result.retryAfter,
          instanceId,
          requestId,
        });
      }
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });
};
