import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getRedisClient } from '../db/redis.js';
import { IBucketRepository } from './bucketRepository.js';
import { clientRepository, IClientRepository } from './clientRepository.js';
import { RateLimitResult } from '../types/rateLimiter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
function loadLuaScript(filename: string): string {
  const distPath = path.join(__dirname, 'lua', filename);
  if (fs.existsSync(distPath)) {
    return fs.readFileSync(distPath, 'utf8');
  }
  const srcPath = path.join(__dirname, '..', '..', 'src', 'repositories', 'lua', filename);
  if (fs.existsSync(srcPath)) {
    return fs.readFileSync(srcPath, 'utf8');
  }
  return fs.readFileSync(distPath, 'utf8');
}
const tokenBucketLua = loadLuaScript('tokenBucket.lua');

export class RedisBucketRepository implements IBucketRepository {
  constructor(private clientRepo: IClientRepository = clientRepository) {}

  async initializeBucket(clientId: string, burstSize: number): Promise<void> {
    const client = await this.clientRepo.findByKey(clientId);
    const clientKey = client ? client.clientKey : clientId;
    const redis = getRedisClient();
    const bucketKey = `client:${clientKey}:bucket`;

    await redis.hmset(bucketKey, {
      tokens: burstSize.toString(),
      last_refill_at: Date.now().toString(),
    });
  }

  async deleteBucket(clientId: string): Promise<void> {
    const client = await this.clientRepo.findByKey(clientId);
    const clientKey = client ? client.clientKey : clientId;
    const redis = getRedisClient();
    const bucketKey = `client:${clientKey}:bucket`;
    await redis.del(bucketKey);
  }

  async checkAndConsume(clientKey: string): Promise<RateLimitResult> {
    const trimmedKey = clientKey.trim();
    const client = await this.clientRepo.findByKey(trimmedKey);

    if (!client) {
      const error: any = new Error(`Client '${clientKey}' not found`);
      error.statusCode = 404;
      throw error;
    }

    const redis = getRedisClient();
    const bucketKey = `client:${trimmedKey}:bucket`;
    const nowMs = Date.now();

    // Execute atomic Lua script
    const res = (await redis.eval(
      tokenBucketLua,
      1,
      bucketKey,
      client.burstSize.toString(),
      client.requestsPerSecond.toString(),
      nowMs.toString(),
      '1'
    )) as [number, number, number, number, number];

    const isAllowed = res[0] === 1;
    const remaining = res[1];
    const limit = res[2];
    const reset = res[3];
    const retryAfter = res[4];

    if (isAllowed) {
      return {
        decision: 'ALLOW',
        algorithm: 'token_bucket',
        limit,
        remaining,
        reset,
      };
    } else {
      return {
        decision: 'DENY',
        algorithm: 'token_bucket',
        limit,
        remaining: 0,
        reset,
        retryAfter: retryAfter > 0 ? retryAfter : 1,
      };
    }
  }
}

export const redisBucketRepository = new RedisBucketRepository();
