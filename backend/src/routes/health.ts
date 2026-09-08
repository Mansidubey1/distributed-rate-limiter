import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/prisma.js';
import { checkRedisHealth } from '../db/redis.js';

export const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // FR1.7 & FR3.5: Health check across dependencies
  fastify.get('/health', async (request, reply) => {
    const instanceId = process.env.INSTANCE_ID || 'limiter-01';
    let postgresStatus: 'healthy' | 'unhealthy' = 'healthy';
    let redisStatus: 'healthy' | 'unhealthy' | 'disabled' = 'healthy';

    // 1. Check PostgreSQL connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (_err) {
      postgresStatus = 'unhealthy';
    }

    // 2. Check Redis connectivity
    try {
      redisStatus = await checkRedisHealth();
    } catch (_err) {
      redisStatus = 'unhealthy';
    }

    const isHealthy =
      postgresStatus === 'healthy' &&
      (redisStatus === 'healthy' || redisStatus === 'disabled');

    const response = {
      status: isHealthy ? 'ok' : 'degraded',
      database: postgresStatus === 'healthy' ? 'connected' : 'disconnected',
      instanceId,
      services: {
        api: 'healthy',
        postgres: postgresStatus,
        redis: redisStatus,
      },
    };

    const statusCode = isHealthy ? 200 : 503;
    return reply.status(statusCode).send(response);
  });
};
