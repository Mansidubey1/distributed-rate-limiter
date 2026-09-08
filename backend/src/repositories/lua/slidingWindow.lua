-- Redis Lua Script: Atomic Sliding Window Evaluation
-- KEYS[1]: client:{clientKey}:window (Sorted Set)
-- ARGV[1]: limit (maximum allowed requests)
-- ARGV[2]: windowSizeSec (window size in seconds)
-- ARGV[3]: nowMs (current Unix epoch in milliseconds)
-- ARGV[4]: requestId (unique identifier for this request member)

local windowKey = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSizeSec = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local requestId = ARGV[4]

local windowSizeMs = windowSizeSec * 1000.0
local windowStartMs = nowMs - windowSizeMs

-- 1. Prune expired entries older than now - windowSize
redis.call('ZREMRANGEBYSCORE', windowKey, '-inf', '(' .. tostring(windowStartMs))

-- 2. Count active entries in current window
local currentCount = redis.call('ZCARD', windowKey)
local nowSec = math.floor(nowMs / 1000.0)

if currentCount < limit then
  -- ALLOW: Record request timestamp
  redis.call('ZADD', windowKey, nowMs, requestId)
  
  -- Set TTL to 2x window size
  redis.call('EXPIRE', windowKey, math.ceil(windowSizeSec * 2 + 60))

  local remaining = math.max(0, limit - currentCount - 1)
  local reset = math.max(nowSec, math.ceil((nowMs + windowSizeMs) / 1000.0))

  -- Return { is_allowed (1/0), remaining, limit, reset, retry_after }
  return { 1, remaining, limit, reset, 0 }
else
  -- DENY: Quota exceeded
  local oldest = redis.call('ZRANGE', windowKey, 0, 0, 'WITHSCORES')
  local oldestMs = (oldest and oldest[2]) and tonumber(oldest[2]) or nowMs
  local msUntilExpiry = math.max(0, oldestMs + windowSizeMs - nowMs)
  local retryAfter = math.max(1, math.ceil(msUntilExpiry / 1000.0))
  local reset = math.max(nowSec, math.ceil((oldestMs + windowSizeMs) / 1000.0))

  return { 0, 0, limit, reset, retryAfter }
end
