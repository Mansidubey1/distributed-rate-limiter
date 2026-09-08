import { SlidingWindowEvaluationResult } from './types.js';

export interface SlidingWindowParams {
  timestamps: (Date | number)[];
  limit: number;
  windowSize: number; // in seconds
}

/**
 * Pure Sliding Window algorithm implementation.
 *
 * Properties:
 * - Maintains a log of timestamps within the trailing window `[now - windowSize, now]`.
 * - Expires and removes timestamps older than `now - windowSize`.
 * - If remaining active timestamp count < limit: ALLOW and record timestamp.
 * - If count >= limit: DENY with retryAfter computed from the earliest timestamp in the window.
 */
export function evaluateSlidingWindow(
  params: SlidingWindowParams,
  now: Date | number = Date.now()
): SlidingWindowEvaluationResult {
  const { limit, windowSize } = params;

  if (limit <= 0) {
    throw new Error('limit must be greater than 0');
  }
  if (windowSize <= 0) {
    throw new Error('windowSize must be greater than 0');
  }

  const nowMs = typeof now === 'number' ? now : now.getTime();
  const windowSizeMs = windowSize * 1000;
  const windowStartMs = nowMs - windowSizeMs;

  // Filter timestamps within [now - windowSize, now]
  const validTimestamps: Date[] = [];
  for (const t of params.timestamps) {
    const tMs = typeof t === 'number' ? t : t.getTime();
    if (tMs >= windowStartMs && tMs <= nowMs) {
      validTimestamps.push(typeof t === 'number' ? new Date(t) : t);
    }
  }

  // Sort chronologically ascending
  validTimestamps.sort((a, b) => a.getTime() - b.getTime());

  const currentCount = validTimestamps.length;
  const nowSec = Math.floor(nowMs / 1000);

  if (currentCount < limit) {
    const remaining = limit - currentCount - 1;
    
    // Earliest expiry timestamp or end of current window
    const earliestMs = validTimestamps.length > 0 ? validTimestamps[0].getTime() : nowMs;
    const reset = Math.max(nowSec, Math.ceil((earliestMs + windowSizeMs) / 1000));

    return {
      decision: 'ALLOW',
      remaining: Math.max(0, remaining),
      limit: Math.floor(limit),
      reset,
      validTimestamps: [...validTimestamps, new Date(nowMs)],
    };
  } else {
    // DENY: Window is saturated
    const earliestMs = validTimestamps[0].getTime();
    const msUntilOldestExpires = Math.max(0, earliestMs + windowSizeMs - nowMs);
    const retryAfter = Math.max(1, Math.ceil(msUntilOldestExpires / 1000));
    const reset = Math.max(nowSec, Math.ceil((earliestMs + windowSizeMs) / 1000));

    return {
      decision: 'DENY',
      remaining: 0,
      limit: Math.floor(limit),
      reset,
      retryAfter,
      validTimestamps,
    };
  }
}
