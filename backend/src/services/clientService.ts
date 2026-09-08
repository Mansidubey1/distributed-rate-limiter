import {
  clientRepository,
  IClientRepository,
} from '../repositories/clientRepository.js';
import {
  bucketRepository,
  IBucketRepository,
} from '../repositories/bucketRepository.js';
import {
  slidingWindowRepository,
  ISlidingWindowRepository,
} from '../repositories/slidingWindowRepository.js';
import {
  ClientConfig,
  ClientResponse,
  CreateClientInput,
  RateLimiterAlgorithm,
  UpdateClientInput,
} from '../types/rateLimiter.js';

export class ClientService {
  constructor(
    private clientRepo: IClientRepository = clientRepository,
    private bucketRepo: IBucketRepository = bucketRepository,
    private slidingWindowRepo: ISlidingWindowRepository = slidingWindowRepository
  ) {}

  /**
   * Format client model into standard ClientResponse.
   */
  private formatClientResponse(client: ClientConfig): ClientResponse {
    return {
      clientKey: client.clientKey,
      algorithm: client.algorithm,
      requestsPerSecond: client.requestsPerSecond,
      burstSize: client.burstSize,
      windowSize: client.windowSize,
      createdAt: client.createdAt ? client.createdAt.toISOString() : undefined,
      updatedAt: client.updatedAt ? client.updatedAt.toISOString() : undefined,
    };
  }

  /**
   * Validate algorithm parameter.
   */
  private validateAlgorithm(algorithm?: string): RateLimiterAlgorithm {
    if (!algorithm) {
      return 'token_bucket';
    }

    if (algorithm !== 'token_bucket' && algorithm !== 'sliding_window') {
      const error: any = new Error('Unsupported rate limiting algorithm');
      error.statusCode = 400;
      throw error;
    }

    return algorithm as RateLimiterAlgorithm;
  }

  /**
   * Create a new client configuration and initialize appropriate algorithm state.
   */
  async createClient(input: CreateClientInput): Promise<ClientResponse> {
    const { clientKey, requestsPerSecond } = input;

    if (!clientKey || typeof clientKey !== 'string' || clientKey.trim() === '') {
      const error: any = new Error('clientKey is required');
      error.statusCode = 400;
      throw error;
    }

    const algorithm = this.validateAlgorithm(input.algorithm);

    if (
      typeof requestsPerSecond !== 'number' ||
      isNaN(requestsPerSecond) ||
      requestsPerSecond <= 0
    ) {
      const error: any = new Error('requestsPerSecond must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    const windowSize = input.windowSize !== undefined ? input.windowSize : 1.0;
    if (typeof windowSize !== 'number' || isNaN(windowSize) || windowSize <= 0) {
      const error: any = new Error('windowSize must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    let burstSize = input.burstSize;
    if (algorithm === 'token_bucket') {
      if (typeof burstSize !== 'number' || isNaN(burstSize) || burstSize <= 0) {
        const error: any = new Error('burstSize must be a positive number for token_bucket algorithm');
        error.statusCode = 400;
        throw error;
      }
    } else {
      // For sliding_window, default burstSize to requestsPerSecond if omitted
      burstSize = typeof burstSize === 'number' && burstSize > 0 ? burstSize : requestsPerSecond;
    }

    const trimmedKey = clientKey.trim();

    // Check if client already exists
    const existing = await this.clientRepo.findByKey(trimmedKey);
    if (existing) {
      const error: any = new Error(`Client '${clientKey}' already exists`);
      error.statusCode = 409;
      throw error;
    }

    // Create client in DB
    const client = await this.clientRepo.create({
      clientKey: trimmedKey,
      algorithm,
      requestsPerSecond,
      burstSize,
      windowSize,
    });

    // Initialize state depending on algorithm
    if (algorithm === 'token_bucket' && client.id) {
      await this.bucketRepo.initializeBucket(client.id, burstSize);
    }

    return this.formatClientResponse(client);
  }

  /**
   * Retrieve all client configurations.
   */
  async getAllClients(): Promise<ClientResponse[]> {
    const clients = await this.clientRepo.findAll();
    return clients.map((c) => this.formatClientResponse(c));
  }

  /**
   * Retrieve a client configuration.
   */
  async getClient(clientKey: string): Promise<ClientResponse> {
    if (!clientKey || typeof clientKey !== 'string' || clientKey.trim() === '') {
      const error: any = new Error('clientKey is required');
      error.statusCode = 400;
      throw error;
    }

    const client = await this.clientRepo.findByKey(clientKey.trim());
    if (!client) {
      const error: any = new Error(`Client '${clientKey}' not found`);
      error.statusCode = 404;
      throw error;
    }

    return this.formatClientResponse(client);
  }

  /**
   * Update client configuration and handle algorithm switching cleanly.
   */
  async updateClient(
    clientKey: string,
    input: UpdateClientInput
  ): Promise<ClientResponse> {
    if (!clientKey || typeof clientKey !== 'string' || clientKey.trim() === '') {
      const error: any = new Error('clientKey is required');
      error.statusCode = 400;
      throw error;
    }

    const trimmedKey = clientKey.trim();
    const existing = await this.clientRepo.findByKey(trimmedKey);
    if (!existing) {
      const error: any = new Error(`Client '${clientKey}' not found`);
      error.statusCode = 404;
      throw error;
    }

    let newAlgorithm = existing.algorithm;
    if (input.algorithm !== undefined) {
      newAlgorithm = this.validateAlgorithm(input.algorithm);
    }

    if (
      input.requestsPerSecond !== undefined &&
      (typeof input.requestsPerSecond !== 'number' ||
        isNaN(input.requestsPerSecond) ||
        input.requestsPerSecond <= 0)
    ) {
      const error: any = new Error('requestsPerSecond must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    if (
      input.burstSize !== undefined &&
      (typeof input.burstSize !== 'number' ||
        isNaN(input.burstSize) ||
        input.burstSize <= 0)
    ) {
      const error: any = new Error('burstSize must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    if (
      input.windowSize !== undefined &&
      (typeof input.windowSize !== 'number' ||
        isNaN(input.windowSize) ||
        input.windowSize <= 0)
    ) {
      const error: any = new Error('windowSize must be a positive number');
      error.statusCode = 400;
      throw error;
    }

    const newRequestsPerSecond = input.requestsPerSecond ?? existing.requestsPerSecond;
    const newBurstSize = input.burstSize ?? existing.burstSize;
    const newWindowSize = input.windowSize ?? existing.windowSize;

    // Handle Algorithm Switching / State Discarding (FR2.3)
    if (existing.id) {
      if (existing.algorithm !== newAlgorithm) {
        if (newAlgorithm === 'sliding_window') {
          // Discard old token bucket state and clear window
          await this.bucketRepo.deleteBucket(existing.id);
          await this.slidingWindowRepo.clearRequests(existing.id);
        } else if (newAlgorithm === 'token_bucket') {
          // Discard sliding window state and create fresh full token bucket
          await this.slidingWindowRepo.clearRequests(existing.id);
          await this.bucketRepo.initializeBucket(existing.id, newBurstSize);
        }
      }
    }

    const updated = await this.clientRepo.update(trimmedKey, {
      algorithm: newAlgorithm,
      requestsPerSecond: newRequestsPerSecond,
      burstSize: newBurstSize,
      windowSize: newWindowSize,
    });

    return this.formatClientResponse(updated);
  }

  /**
   * Delete client configuration and cascade delete associated algorithm states.
   */
  async deleteClient(clientKey: string): Promise<boolean> {
    if (!clientKey || typeof clientKey !== 'string' || clientKey.trim() === '') {
      const error: any = new Error('clientKey is required');
      error.statusCode = 400;
      throw error;
    }

    const trimmedKey = clientKey.trim();
    const existing = await this.clientRepo.findByKey(trimmedKey);
    if (!existing) {
      const error: any = new Error(`Client '${clientKey}' not found`);
      error.statusCode = 404;
      throw error;
    }

    await this.clientRepo.delete(trimmedKey);
    return true;
  }
}

export const clientService = new ClientService();
