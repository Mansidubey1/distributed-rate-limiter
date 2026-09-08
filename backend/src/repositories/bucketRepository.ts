import { prisma } from '../db/prisma.js';
import { RateLimitResult } from '../types/rateLimiter.js';

export interface IBucketRepository {
  checkAndConsume(clientKey: string): Promise<RateLimitResult>;
  initializeBucket(clientId: string, burstSize: number): Promise<void>;
  deleteBucket(clientId: string): Promise<void>;
}

interface RawTokenBucketRow {
  is_allowed: boolean;
  remaining_tokens: number;
  burst_size: number;
  requests_per_second: number;
  now_epoch: number;
}

export class PostgresBucketRepository implements IBucketRepository {
  async initializeBucket(clientId: string, burstSize: number): Promise<void> {
    await prisma.bucketState.upsert({
      where: { clientId },
      create: {
        clientId,
        tokens: burstSize,
        lastRefillAt: new Date(),
      },
      update: {
        tokens: burstSize,
        lastRefillAt: new Date(),
      },
    });
  }

  async deleteBucket(clientId: string): Promise<void> {
    await prisma.bucketState.deleteMany({
      where: { clientId },
    });
  }

  async checkAndConsume(clientKey: string): Promise<RateLimitResult> {
    const trimmedKey = clientKey.trim();

    // Atomic CTE query that locks bucket_state and client, refills tokens, consumes 1 token if available,
    // updates bucket state, and atomically increments client request counters.
    const result = await prisma.$queryRaw<RawTokenBucketRow[]>`
      WITH client_rec AS (
        SELECT id, requests_per_second, burst_size
        FROM "clients"
        WHERE "client_key" = ${trimmedKey}
      ),
      current_bucket AS (
        SELECT bs.id, bs.tokens, bs.last_refill_at
        FROM "bucket_states" bs
        JOIN client_rec c ON bs.client_id = c.id
        FOR UPDATE OF bs
      ),
      refill_calc AS (
        SELECT
          cb.id,
          c.requests_per_second,
          c.burst_size,
          cb.tokens AS old_tokens,
          cb.last_refill_at AS old_last_refill,
          NOW() AS current_time,
          GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - cb.last_refill_at))) AS elapsed_seconds,
          LEAST(
            c.burst_size::double precision,
            cb.tokens + (GREATEST(0.0, EXTRACT(EPOCH FROM (NOW() - cb.last_refill_at))) * c.requests_per_second)
          ) AS refilled_tokens
        FROM current_bucket cb
        CROSS JOIN client_rec c
      ),
      updated_bucket AS (
        UPDATE "bucket_states" bs
        SET
          tokens = CASE
            WHEN rc.refilled_tokens >= 1.0 THEN rc.refilled_tokens - 1.0
            ELSE rc.refilled_tokens
          END,
          last_refill_at = rc.current_time,
          updated_at = rc.current_time
        FROM refill_calc rc
        WHERE bs.id = rc.id
        RETURNING
          rc.refilled_tokens >= 1.0 AS is_allowed,
          bs.tokens AS remaining_tokens,
          rc.burst_size,
          rc.requests_per_second,
          EXTRACT(EPOCH FROM rc.current_time)::double precision AS now_epoch
      ),
      updated_client_stats AS (
        UPDATE "clients" c
        SET
          total_requests = c.total_requests + 1,
          allowed_requests = CASE WHEN ub.is_allowed THEN c.allowed_requests + 1 ELSE c.allowed_requests END,
          denied_requests = CASE WHEN NOT ub.is_allowed THEN c.denied_requests + 1 ELSE c.denied_requests END
        FROM updated_bucket ub
        WHERE c.client_key = ${trimmedKey}
      )
      SELECT * FROM updated_bucket;
    `;

    if (!result || result.length === 0) {
      // Check if client exists
      const client = await prisma.client.findUnique({
        where: { clientKey: trimmedKey },
      });

      if (!client) {
        const error: any = new Error(`Client '${clientKey}' not found`);
        error.statusCode = 404;
        throw error;
      }

      // If client exists but bucket state was missing, create it and retry
      await this.initializeBucket(client.id, client.burstSize);
      return this.checkAndConsume(clientKey);
    }

    const row = result[0];
    const isAllowed = Boolean(row.is_allowed);
    const remainingTokens = Number(row.remaining_tokens);
    const burstSize = Number(row.burst_size);
    const requestsPerSecond = Number(row.requests_per_second);
    const nowEpoch = Number(row.now_epoch);

    const remaining = Math.max(0, Math.floor(remainingTokens));
    const limit = Math.floor(burstSize);

    // Reset calculation: Unix timestamp when bucket will be full again
    const secondsToFull = requestsPerSecond > 0 ? (burstSize - remainingTokens) / requestsPerSecond : 0;
    const reset = Math.ceil(nowEpoch + secondsToFull);

    if (isAllowed) {
      return {
        decision: 'ALLOW',
        algorithm: 'token_bucket',
        limit,
        remaining,
        reset: Math.max(Math.floor(nowEpoch), reset),
      };
    } else {
      // DENIED: calculate retryAfter in seconds until at least 1 token is available
      const tokensNeeded = 1.0 - remainingTokens;
      const retryAfter = requestsPerSecond > 0 ? Math.max(1, Math.ceil(tokensNeeded / requestsPerSecond)) : 1;

      return {
        decision: 'DENY',
        algorithm: 'token_bucket',
        limit,
        remaining: 0,
        reset: Math.max(Math.floor(nowEpoch), reset),
        retryAfter,
      };
    }
  }
}

export const bucketRepository = new PostgresBucketRepository();
