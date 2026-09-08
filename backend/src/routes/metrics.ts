import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { metricsService } from '../services/metricsService.js';
import { requireAdminAuth } from '../middleware/auth.js';

export const metricsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Apply admin authentication to metrics route
  fastify.addHook('preHandler', requireAdminAuth);

  // FR2.7: Service-wide Metrics Endpoint
  fastify.get('/metrics', async (request, reply) => {
    try {
      const metrics = await metricsService.getGlobalMetrics();
      return reply.status(200).send(metrics);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });
};
