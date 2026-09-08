-- Redis Lua Script: Atomic Token Bucket Evaluation
-- KEYS[1]: client:{clientKey}:bucket
-- ARGV[1]: burstSize (capacity)
-- ARGV[2]: requestsPerSecond (refill rate)
-- ARGV[3]: nowMs (current Unix epoch in milliseconds)
-- ARGV[4]: cost (tokens to consume, default 1)

local bucketKey = KEYS[1]
local burstSize = tonumber(ARGV[1])
local requestsPerSecond = tonumber(ARGV[2])
local nowMs = tonumber(ARGV[3])
local cost = tonumber(ARGV[4] or "1")

local state = redis.call('HMGET', bucketKey, 'tokens', 'last_refill_at')
local currentTokens = nil
local lastRefillMs = nil

if state and state[1] and state[1] ~= false and tostring(state[1]) ~= "" then
  currentTokens = tonumber(state[1])
  lastRefillMs = tonumber(state[2])
end

if not currentTokens then
  currentTokens = burstSize
end
if not lastRefillMs then
  lastRefillMs = nowMs
end

local elapsedSeconds = math.max(0, (nowMs - lastRefillMs) / 1000.0)
local tokensToAdd = elapsedSeconds * requestsPerSecond
local refilledTokens = math.min(burstSize, currentTokens + tokensToAdd)

local nowSec = math.floor(nowMs / 1000.0)
local limit = math.floor(burstSize)

if refilledTokens >= cost then
  local newTokens = refilledTokens - cost
  redis.call('HSET', bucketKey, 'tokens', tostring(newTokens), 'last_refill_at', tostring(nowMs))
  redis.call('EXPIRE', bucketKey, 604800)

  local remaining = math.max(0, math.floor(newTokens))
  local secondsToFull = requestsPerSecond > 0 and ((burstSize - newTokens) / requestsPerSecond) or 0
  local reset = math.max(nowSec, math.ceil((nowMs / 1000.0) + secondsToFull))

  -- Return { is_allowed (1/0), remaining, limit, reset, retry_after }
  return { 1, remaining, limit, reset, 0 }
else
  redis.call('HSET', bucketKey, 'tokens', tostring(refilledTokens), 'last_refill_at', tostring(nowMs))
  redis.call('EXPIRE', bucketKey, 604800)

  local tokensNeeded = cost - refilledTokens
  local retryAfter = requestsPerSecond > 0 and math.max(1, math.ceil(tokensNeeded / requestsPerSecond)) or 1
  local secondsToFull = requestsPerSecond > 0 and ((burstSize - refilledTokens) / requestsPerSecond) or 0
  local reset = math.max(nowSec, math.ceil((nowMs / 1000.0) + secondsToFull))

  return { 0, 0, limit, reset, retryAfter }
end
