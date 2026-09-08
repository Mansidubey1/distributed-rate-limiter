export type RateLimiterAlgorithm = 'token_bucket' | 'sliding_window';

export type RateLimitDecision = 'ALLOW' | 'DENY';

export interface AlgorithmEvaluationResult {
  decision: RateLimitDecision;
  remaining: number;
  limit: number;
  reset: number; // Unix timestamp in seconds
  retryAfter?: number; // In seconds, provided when DENY
}

export interface TokenBucketEvaluationResult extends AlgorithmEvaluationResult {
  newTokens: number;
  newLastRefillAt: Date;
}

export interface SlidingWindowEvaluationResult extends AlgorithmEvaluationResult {
  validTimestamps: Date[];
}
