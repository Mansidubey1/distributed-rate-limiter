import { RateLimitResult } from '../types/rateLimiter.js';

export interface TokenBucketParams {
  tokens: number;
  lastRefillAt: Date | number;
  burstSize: number;
  requestsPerSecond: number;
}

export interface TokenBucketEvaluation extends RateLimitResult {
  newTokens: number;
  newLastRefillAt: Date;
}

/**
 * Pure Token Bucket algorithm implementation.
 *
 * Mathematical properties:
 * - Refills continuously at `requestsPerSecond` rate: tokensToAdd = deltaSeconds * requestsPerSecond
 * - Caps at `burstSize` maximum capacity
 * - Consumes 1 (or `cost`) token if available, returning ALLOW
 * - Denies request if insufficient tokens, returning DENY with retryAfter
 */
export function evaluateTokenBucket(
  params: TokenBucketParams,
  now: Date | number = Date.now(),
  cost: number = 1
): TokenBucketEvaluation {
  const { burstSize, requestsPerSecond } = params;

  if (burstSize <= 0) {
    throw new Error('burstSize must be greater than 0');
  }
  if (requestsPerSecond <= 0) {
    throw new Error('requestsPerSecond must be greater than 0');
  }
  if (cost <= 0) {
    throw new Error('cost must be greater than 0');
  }

  const nowMs = typeof now === 'number' ? now : now.getTime();
  const lastRefillMs =
    typeof params.lastRefillAt === 'number'
      ? params.lastRefillAt
      : params.lastRefillAt.getTime();

  // Elapsed time in seconds (non-negative)
  const elapsedSeconds = Math.max(0, (nowMs - lastRefillMs) / 1000);

  // Tokens added since last refill
  const tokensToAdd = elapsedSeconds * requestsPerSecond;

  // Refill tokens, bounded by burstSize
  const currentTokens = Math.min(burstSize, params.tokens + tokensToAdd);

  const nowSec = Math.floor(nowMs / 1000);

  if (currentTokens >= cost) {
    const newTokens = currentTokens - cost;
    const remaining = Math.max(0, Math.floor(newTokens));

    // Reset is the timestamp when the bucket will be completely full again
    const secondsToFull = requestsPerSecond > 0 ? (burstSize - newTokens) / requestsPerSecond : 0;
    const reset = Math.ceil((nowMs / 1000) + secondsToFull);

    return {
      decision: 'ALLOW',
      algorithm: 'token_bucket',
      remaining,
      limit: Math.floor(burstSize),
      reset: Math.max(nowSec, reset),
      newTokens,
      newLastRefillAt: new Date(nowMs),
    };
  } else {
    // DENIED: tokens remain unchanged (or updated to current refilled amount)
    const remaining = Math.max(0, Math.floor(currentTokens));

    // Seconds required until at least 1 token is available
    const tokensNeeded = cost - currentTokens;
    const secondsToWait = requestsPerSecond > 0 ? Math.max(1, Math.ceil(tokensNeeded / requestsPerSecond)) : 1;

    // Reset timestamp when bucket will reach 1 token (or full)
    const secondsToFull = requestsPerSecond > 0 ? (burstSize - currentTokens) / requestsPerSecond : 0;
    const reset = Math.ceil((nowMs / 1000) + secondsToFull);

    return {
      decision: 'DENY',
      algorithm: 'token_bucket',
      remaining,
      limit: Math.floor(burstSize),
      reset: Math.max(nowSec, reset),
      retryAfter: secondsToWait,
      newTokens: currentTokens,
      newLastRefillAt: new Date(nowMs),
    };
  }
}
