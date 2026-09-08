import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { clientService } from '../services/clientService.js';
import { metricsService } from '../services/metricsService.js';
import { requireAdminAuth } from '../middleware/auth.js';
import { CreateClientInput, UpdateClientInput } from '../types/rateLimiter.js';

export const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // Apply admin authentication to all admin routes
  fastify.addHook('preHandler', requireAdminAuth);

  // FR1.1 & FR2.1: Create Client Configuration
  fastify.post<{
    Body: CreateClientInput;
  }>('/v1/admin/clients', async (request, reply) => {
    try {
      const { clientKey, algorithm, requestsPerSecond, burstSize, windowSize } = request.body || {};

      if (!clientKey) {
        return reply.status(400).send({ error: 'clientKey is required' });
      }

      if (requestsPerSecond === undefined || typeof requestsPerSecond !== 'number' || requestsPerSecond <= 0) {
        return reply.status(400).send({ error: 'requestsPerSecond must be a positive number' });
      }

      if (algorithm !== undefined && algorithm !== 'token_bucket' && algorithm !== 'sliding_window') {
        return reply.status(400).send({ error: 'Unsupported rate limiting algorithm' });
      }

      if (algorithm === 'token_bucket' || (!algorithm && burstSize !== undefined)) {
        if (burstSize !== undefined && (typeof burstSize !== 'number' || burstSize <= 0)) {
          return reply.status(400).send({ error: 'burstSize must be a positive number' });
        }
      }

      if (windowSize !== undefined && (typeof windowSize !== 'number' || windowSize <= 0)) {
        return reply.status(400).send({ error: 'windowSize must be a positive number' });
      }

      const client = await clientService.createClient({
        clientKey,
        algorithm,
        requestsPerSecond,
        burstSize,
        windowSize,
      });

      return reply.status(201).send(client);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });

  // List all clients
  fastify.get('/v1/admin/clients', async (request, reply) => {
    try {
      const clients = await clientService.getAllClients();
      return reply.status(200).send(clients);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });

  // FR1.2: Get Client Configuration
  fastify.get<{
    Params: { clientKey: string };
  }>('/v1/admin/clients/:clientKey', async (request, reply) => {
    try {
      const { clientKey } = request.params;
      const client = await clientService.getClient(clientKey);
      return reply.status(200).send(client);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });

  // FR2.6: Get Client Usage Statistics
  fastify.get<{
    Params: { clientKey: string };
  }>('/v1/admin/clients/:clientKey/stats', async (request, reply) => {
    try {
      const { clientKey } = request.params;
      const stats = await metricsService.getClientStats(clientKey);
      return reply.status(200).send(stats);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });

  // FR1.2 & FR2.3: Update Client Configuration
  fastify.put<{
    Params: { clientKey: string };
    Body: UpdateClientInput;
  }>('/v1/admin/clients/:clientKey', async (request, reply) => {
    try {
      const { clientKey } = request.params;
      const body = request.body || {};

      if (body.algorithm !== undefined && body.algorithm !== 'token_bucket' && body.algorithm !== 'sliding_window') {
        return reply.status(400).send({ error: 'Unsupported rate limiting algorithm' });
      }

      if (
        body.requestsPerSecond !== undefined &&
        (typeof body.requestsPerSecond !== 'number' || isNaN(body.requestsPerSecond) || body.requestsPerSecond <= 0)
      ) {
        return reply.status(400).send({ error: 'requestsPerSecond must be a positive number' });
      }

      if (
        body.burstSize !== undefined &&
        (typeof body.burstSize !== 'number' || isNaN(body.burstSize) || body.burstSize <= 0)
      ) {
        return reply.status(400).send({ error: 'burstSize must be a positive number' });
      }

      if (
        body.windowSize !== undefined &&
        (typeof body.windowSize !== 'number' || isNaN(body.windowSize) || body.windowSize <= 0)
      ) {
        return reply.status(400).send({ error: 'windowSize must be a positive number' });
      }

      const updatedClient = await clientService.updateClient(clientKey, body);
      return reply.status(200).send(updatedClient);
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });

  // FR1.2: Delete Client
  fastify.delete<{
    Params: { clientKey: string };
  }>('/v1/admin/clients/:clientKey', async (request, reply) => {
    try {
      const { clientKey } = request.params;
      await clientService.deleteClient(clientKey);
      return reply.status(200).send({ message: `Client '${clientKey}' deleted successfully` });
    } catch (error: any) {
      const statusCode = error.statusCode || 500;
      return reply.status(statusCode).send({
        error: error.message || 'Internal server error',
      });
    }
  });
};
