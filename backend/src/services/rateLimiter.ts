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
import { redisBucketRepository } from '../repositories/redisBucketRepository.js';
import { redisSlidingWindowRepository } from '../repositories/redisSlidingWindowRepository.js';
import {
  RateLimitResult,
  StructuredDecisionLog,
} from '../types/rateLimiter.js';

export class RateLimiterService {
  constructor(
    private clientRepo: IClientRepository = clientRepository,
    private postgresBucketRepo: IBucketRepository = bucketRepository,
    private postgresSlidingWindowRepo: ISlidingWindowRepository = slidingWindowRepository,
    private redisBucketRepo: IBucketRepository = redisBucketRepository,
    private redisSlidingWindowRepo: ISlidingWindowRepository = redisSlidingWindowRepository
  ) {}

  private isDistributed(): boolean {
    return process.env.DISTRIBUTED_MODE === 'true';
  }

  private getInstanceId(): string {
    return process.env.INSTANCE_ID || 'limiter-01';
  }

  /**
   * Evaluates a rate limit check by delegating to the appropriate repository
   * (Postgres or Redis depending on DISTRIBUTED_MODE).
   * Emits structured decision logs with instanceId.
   */
  async checkRateLimit(
    clientKey: string,
    requestId?: string
  ): Promise<RateLimitResult> {
    const startTime = performance.now();
    const instanceId = this.getInstanceId();
    const distributed = this.isDistributed();

    if (!clientKey || typeof clientKey !== 'string' || clientKey.trim() === '') {
      const error: any = new Error('clientKey is required');
      error.statusCode = 400;
      throw error;
    }

    const trimmedKey = clientKey.trim();
    const client = await this.clientRepo.findByKey(trimmedKey);

    if (!client) {
      const error: any = new Error(`Client '${clientKey}' not found`);
      error.statusCode = 404;
      throw error;
    }

    let result: RateLimitResult;

    try {
      if (distributed) {
        // Phase 3: Redis-backed distributed repositories
        if (client.algorithm === 'sliding_window') {
          result = await this.redisSlidingWindowRepo.checkAndRecord(trimmedKey);
        } else {
          result = await this.redisBucketRepo.checkAndConsume(trimmedKey);
        }
      } else {
        // Phase 1/2: PostgreSQL atomic repositories
        if (client.algorithm === 'sliding_window') {
          result = await this.postgresSlidingWindowRepo.checkAndRecord(trimmedKey);
        } else {
          result = await this.postgresBucketRepo.checkAndConsume(trimmedKey);
        }
      }
    } catch (err: any) {
      if (err.statusCode && err.statusCode < 500) {
        throw err;
      }

      console.error('Redis execution error:', err.message);

      // Redis failure policy: return 503 (FR3.6)
      if (distributed) {
        const unavailableError: any = new Error('Rate limiter temporarily unavailable');
        unavailableError.statusCode = 503;
        throw unavailableError;
      }

      throw err;
    }

    const latencyMs = Number((performance.now() - startTime).toFixed(2));

    // Structured decision logging (FR2.10 & FR3.4)
    const logPayload: StructuredDecisionLog = {
      instanceId,
      requestId,
      clientKey: trimmedKey,
      algorithm: result.algorithm,
      decision: result.decision,
      latencyMs,
    };

    // Forward-compatible structured logging
    if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'benchmark') {
      console.log(JSON.stringify({ level: 'info', type: 'RATE_LIMIT_DECISION', ...logPayload }));
    }

    return result;
  }
}

export const rateLimiterService = new RateLimiterService();
