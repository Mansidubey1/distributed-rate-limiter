import { prisma } from '../db/prisma.js';
import {
  ClientConfig,
  ClientStats,
  MetricsResponse,
  RateLimiterAlgorithm,
} from '../types/rateLimiter.js';

export interface IClientRepository {
  findByKey(clientKey: string): Promise<ClientConfig | null>;
  findAll(): Promise<ClientConfig[]>;
  create(client: {
    clientKey: string;
    algorithm: RateLimiterAlgorithm;
    requestsPerSecond: number;
    burstSize: number;
    windowSize: number;
  }): Promise<ClientConfig>;
  update(
    clientKey: string,
    data: {
      algorithm?: RateLimiterAlgorithm;
      requestsPerSecond?: number;
      burstSize?: number;
      windowSize?: number;
    }
  ): Promise<ClientConfig>;
  delete(clientKey: string): Promise<boolean>;
  getStats(clientKey: string): Promise<ClientStats | null>;
  getGlobalMetrics(): Promise<MetricsResponse>;
}

export class PostgresClientRepository implements IClientRepository {
  async findByKey(clientKey: string): Promise<ClientConfig | null> {
    const client = await prisma.client.findUnique({
      where: { clientKey },
    });

    if (!client) return null;

    return {
      id: client.id,
      clientKey: client.clientKey,
      algorithm: client.algorithm as RateLimiterAlgorithm,
      requestsPerSecond: client.requestsPerSecond,
      burstSize: client.burstSize,
      windowSize: client.windowSize,
      totalRequests: client.totalRequests,
      allowedRequests: client.allowedRequests,
      deniedRequests: client.deniedRequests,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  async findAll(): Promise<ClientConfig[]> {
    const clients = await prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return clients.map((client) => ({
      id: client.id,
      clientKey: client.clientKey,
      algorithm: client.algorithm as RateLimiterAlgorithm,
      requestsPerSecond: client.requestsPerSecond,
      burstSize: client.burstSize,
      windowSize: client.windowSize,
      totalRequests: client.totalRequests,
      allowedRequests: client.allowedRequests,
      deniedRequests: client.deniedRequests,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    }));
  }

  async create(data: {
    clientKey: string;
    algorithm: RateLimiterAlgorithm;
    requestsPerSecond: number;
    burstSize: number;
    windowSize: number;
  }): Promise<ClientConfig> {
    const client = await prisma.client.create({
      data: {
        clientKey: data.clientKey,
        algorithm: data.algorithm,
        requestsPerSecond: data.requestsPerSecond,
        burstSize: data.burstSize,
        windowSize: data.windowSize,
      },
    });

    return {
      id: client.id,
      clientKey: client.clientKey,
      algorithm: client.algorithm as RateLimiterAlgorithm,
      requestsPerSecond: client.requestsPerSecond,
      burstSize: client.burstSize,
      windowSize: client.windowSize,
      totalRequests: client.totalRequests,
      allowedRequests: client.allowedRequests,
      deniedRequests: client.deniedRequests,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  async update(
    clientKey: string,
    data: {
      algorithm?: RateLimiterAlgorithm;
      requestsPerSecond?: number;
      burstSize?: number;
      windowSize?: number;
    }
  ): Promise<ClientConfig> {
    const client = await prisma.client.update({
      where: { clientKey },
      data: {
        algorithm: data.algorithm,
        requestsPerSecond: data.requestsPerSecond,
        burstSize: data.burstSize,
        windowSize: data.windowSize,
      },
    });

    return {
      id: client.id,
      clientKey: client.clientKey,
      algorithm: client.algorithm as RateLimiterAlgorithm,
      requestsPerSecond: client.requestsPerSecond,
      burstSize: client.burstSize,
      windowSize: client.windowSize,
      totalRequests: client.totalRequests,
      allowedRequests: client.allowedRequests,
      deniedRequests: client.deniedRequests,
      createdAt: client.createdAt,
      updatedAt: client.updatedAt,
    };
  }

  async delete(clientKey: string): Promise<boolean> {
    await prisma.client.delete({
      where: { clientKey },
    });
    return true;
  }

  async getStats(clientKey: string): Promise<ClientStats | null> {
    const client = await prisma.client.findUnique({
      where: { clientKey },
      select: {
        clientKey: true,
        algorithm: true,
        totalRequests: true,
        allowedRequests: true,
        deniedRequests: true,
      },
    });

    if (!client) return null;

    return {
      clientKey: client.clientKey,
      algorithm: client.algorithm as RateLimiterAlgorithm,
      totalRequests: client.totalRequests,
      allowedRequests: client.allowedRequests,
      deniedRequests: client.deniedRequests,
    };
  }

  async getGlobalMetrics(): Promise<MetricsResponse> {
    const [aggregates, clientCount] = await Promise.all([
      prisma.client.aggregate({
        _sum: {
          totalRequests: true,
          allowedRequests: true,
          deniedRequests: true,
        },
      }),
      prisma.client.count(),
    ]);

    const isDistributed = process.env.DISTRIBUTED_MODE === 'true';
    const instanceCount = parseInt(process.env.INSTANCE_COUNT || '1', 10);

    return {
      totalRequests: aggregates._sum.totalRequests ?? 0,
      allowedRequests: aggregates._sum.allowedRequests ?? 0,
      deniedRequests: aggregates._sum.deniedRequests ?? 0,
      clients: clientCount,
      activeClients: clientCount,
      instances: instanceCount,
      distributedMode: isDistributed,
    };
  }
}

export const clientRepository = new PostgresClientRepository();
