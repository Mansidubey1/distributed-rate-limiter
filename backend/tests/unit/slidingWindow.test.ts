import { describe, it, expect } from 'vitest';
import { evaluateSlidingWindow } from '../../src/algorithms/slidingWindow.js';

describe('Sliding Window Algorithm - Pure Evaluation', () => {
  it('should allow requests within limit and track remaining count', () => {
    const now = 1000000;
    const timestamps: number[] = [];

    // Request 1 (limit: 3, windowSize: 10s)
    const res1 = evaluateSlidingWindow({ timestamps, limit: 3, windowSize: 10 }, now);
    expect(res1.decision).toBe('ALLOW');
    expect(res1.remaining).toBe(2);
    expect(res1.validTimestamps.length).toBe(1);

    // Request 2 (1s later)
    const res2 = evaluateSlidingWindow({ timestamps: [now], limit: 3, windowSize: 10 }, now + 1000);
    expect(res2.decision).toBe('ALLOW');
    expect(res2.remaining).toBe(1);
    expect(res2.validTimestamps.length).toBe(2);

    // Request 3 (2s later)
    const res3 = evaluateSlidingWindow(
      { timestamps: [now, now + 1000], limit: 3, windowSize: 10 },
      now + 2000
    );
    expect(res3.decision).toBe('ALLOW');
    expect(res3.remaining).toBe(0);
    expect(res3.validTimestamps.length).toBe(3);
  });

  it('should deny the (limit + 1)th request and provide retryAfter', () => {
    const now = 1000000;
    const timestamps = [now, now + 1000, now + 2000]; // 3 requests in window

    // 4th request at now + 3000ms with limit = 3, windowSize = 10s
    const res4 = evaluateSlidingWindow(
      { timestamps, limit: 3, windowSize: 10 },
      now + 3000
    );

    expect(res4.decision).toBe('DENY');
    expect(res4.remaining).toBe(0);
    expect(res4.retryAfter).toBe(7); // Oldest at 1000s expires at 1010s. Now is 1003s -> 7s wait.
    expect(res4.reset).toBe(Math.ceil((now + 10000) / 1000));
  });

  it('should allow new requests once older timestamps expire outside the window', () => {
    const now = 1000000;
    // 3 requests occurred at now, now + 1000, now + 2000
    const timestamps = [now, now + 1000, now + 2000];

    // Check at now + 10500ms (10.5 seconds later) with windowSize = 10s
    // The first request (at now) has expired! Remaining valid: now+1000, now+2000 (2 requests)
    const res = evaluateSlidingWindow(
      { timestamps, limit: 3, windowSize: 10 },
      now + 10500
    );

    expect(res.decision).toBe('ALLOW');
    expect(res.remaining).toBe(0); // 3 - 2 - 1 = 0 remaining after this 3rd active
    expect(res.validTimestamps.length).toBe(3); // 2 previous + 1 current
  });

  it('should throw errors for invalid limit or windowSize', () => {
    expect(() => evaluateSlidingWindow({ timestamps: [], limit: 0, windowSize: 1 })).toThrow();
    expect(() => evaluateSlidingWindow({ timestamps: [], limit: -1, windowSize: 1 })).toThrow();
    expect(() => evaluateSlidingWindow({ timestamps: [], limit: 5, windowSize: 0 })).toThrow();
    expect(() => evaluateSlidingWindow({ timestamps: [], limit: 5, windowSize: -2 })).toThrow();
  });
});
