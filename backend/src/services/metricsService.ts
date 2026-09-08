import { clientRepository, IClientRepository } from '../repositories/clientRepository.js';
import { ClientStats, MetricsResponse } from '../types/rateLimiter.js';

export class MetricsService {
  constructor(private clientRepo: IClientRepository = clientRepository) {}

  /**
   * Retrieve service-wide cumulative metrics.
   */
  async getGlobalMetrics(): Promise<MetricsResponse> {
    return this.clientRepo.getGlobalMetrics();
  }

  /**
   * Retrieve usage statistics for a specific client.
   */
  async getClientStats(clientKey: string): Promise<ClientStats> {
    if (!clientKey || typeof clientKey !== 'string' || clientKey.trim() === '') {
      const error: any = new Error('clientKey is required');
      error.statusCode = 400;
      throw error;
    }

    const stats = await this.clientRepo.getStats(clientKey.trim());
    if (!stats) {
      const error: any = new Error(`Client '${clientKey}' not found`);
      error.statusCode = 404;
      throw error;
    }

    return stats;
  }
}

export const metricsService = new MetricsService();
