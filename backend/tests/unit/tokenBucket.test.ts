import { describe, it, expect } from 'vitest';
import { evaluateTokenBucket } from '../../src/algorithms/tokenBucket.js';

describe('Token Bucket Algorithm - Unit Tests', () => {
  it('should allow requests up to the initial burst capacity', () => {
    const burstSize = 3;
    const requestsPerSecond = 1;
    const baseTime = 1700000000000;

    // First request: 3 tokens available -> consumes 1 -> 2 remaining
    const res1 = evaluateTokenBucket(
      { tokens: 3, lastRefillAt: baseTime, burstSize, requestsPerSecond },
      baseTime
    );
    expect(res1.decision).toBe('ALLOW');
    expect(res1.remaining).toBe(2);
    expect(res1.limit).toBe(3);
    expect(res1.newTokens).toBe(2);

    // Second request immediate: 2 tokens available -> consumes 1 -> 1 remaining
    const res2 = evaluateTokenBucket(
      { tokens: res1.newTokens, lastRefillAt: res1.newLastRefillAt, burstSize, requestsPerSecond },
      baseTime
    );
    expect(res2.decision).toBe('ALLOW');
    expect(res2.remaining).toBe(1);
    expect(res2.newTokens).toBe(1);

    // Third request immediate: 1 token available -> consumes 1 -> 0 remaining
    const res3 = evaluateTokenBucket(
      { tokens: res2.newTokens, lastRefillAt: res2.newLastRefillAt, burstSize, requestsPerSecond },
      baseTime
    );
    expect(res3.decision).toBe('ALLOW');
    expect(res3.remaining).toBe(0);
    expect(res3.newTokens).toBe(0);

    // Fourth request immediate: 0 tokens available -> DENIED
    const res4 = evaluateTokenBucket(
      { tokens: res3.newTokens, lastRefillAt: res3.newLastRefillAt, burstSize, requestsPerSecond },
      baseTime
    );
    expect(res4.decision).toBe('DENY');
    expect(res4.remaining).toBe(0);
    expect(res4.retryAfter).toBe(1); // 1 token needed at 1 req/sec = 1 sec
  });

  it('should refill tokens accurately based on elapsed time', () => {
    const burstSize = 10;
    const requestsPerSecond = 5; // 5 tokens per second
    const baseTime = 1700000000000;

    // Bucket starts at 0 tokens
    // After 1 second (1000ms), 5 tokens should be added
    const after1Sec = baseTime + 1000;
    const res1 = evaluateTokenBucket(
      { tokens: 0, lastRefillAt: baseTime, burstSize, requestsPerSecond },
      after1Sec
    );
    expect(res1.decision).toBe('ALLOW');
    expect(res1.remaining).toBe(4); // 0 + 5 - 1 = 4
    expect(res1.newTokens).toBe(4);

    // After another 1.2 seconds, 6 tokens added -> 4 + 6 = 10 (capped at burstSize 10)
    const afterAnother1200ms = after1Sec + 1200;
    const res2 = evaluateTokenBucket(
      { tokens: res1.newTokens, lastRefillAt: res1.newLastRefillAt, burstSize, requestsPerSecond },
      afterAnother1200ms
    );
    expect(res2.decision).toBe('ALLOW');
    // 4 + (1.2 * 5) = 10 (capped), consumes 1 -> 9 remaining
    expect(res2.remaining).toBe(9);
    expect(res2.newTokens).toBe(9);
  });

  it('should never exceed burstSize maximum capacity even after long idle time', () => {
    const burstSize = 10;
    const requestsPerSecond = 2;
    const baseTime = 1700000000000;
    const tenDaysLater = baseTime + 10 * 24 * 60 * 60 * 1000;

    const res = evaluateTokenBucket(
      { tokens: 5, lastRefillAt: baseTime, burstSize, requestsPerSecond },
      tenDaysLater
    );
    expect(res.decision).toBe('ALLOW');
    expect(res.remaining).toBe(9); // 10 max - 1 = 9
    expect(res.newTokens).toBe(9);
  });

  it('should calculate retryAfter accurately for partial token amounts', () => {
    const burstSize = 10;
    const requestsPerSecond = 2; // 0.5 sec per token
    const baseTime = 1700000000000;

    // 0.2 tokens available, 1 token needed -> need 0.8 tokens -> 0.8 / 2 = 0.4s -> ceil = 1s
    const res = evaluateTokenBucket(
      { tokens: 0.2, lastRefillAt: baseTime, burstSize, requestsPerSecond },
      baseTime
    );
    expect(res.decision).toBe('DENY');
    expect(res.retryAfter).toBe(1);
  });

  it('should reject invalid parameters with meaningful errors', () => {
    expect(() =>
      evaluateTokenBucket({ tokens: 5, lastRefillAt: 0, burstSize: 0, requestsPerSecond: 10 })
    ).toThrow('burstSize must be greater than 0');

    expect(() =>
      evaluateTokenBucket({ tokens: 5, lastRefillAt: 0, burstSize: 10, requestsPerSecond: -1 })
    ).toThrow('requestsPerSecond must be greater than 0');

    expect(() =>
      evaluateTokenBucket({ tokens: 5, lastRefillAt: 0, burstSize: 10, requestsPerSecond: 10 }, Date.now(), 0)
    ).toThrow('cost must be greater than 0');
  });
});
