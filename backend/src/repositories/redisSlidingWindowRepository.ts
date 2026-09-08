import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getRedisClient } from '../db/redis.js';
import { ISlidingWindowRepository } from './slidingWindowRepository.js';
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
const slidingWindowLua = loadLuaScript('slidingWindow.lua');

export class RedisSlidingWindowRepository implements ISlidingWindowRepository {
  constructor(private clientRepo: IClientRepository = clientRepository) {}

  async clearRequests(clientId: string): Promise<void> {
    const client = await this.clientRepo.findByKey(clientId);
    const clientKey = client ? client.clientKey : clientId;
    const redis = getRedisClient();
    const windowKey = `client:${clientKey}:window`;
    await redis.del(windowKey);
  }

  async checkAndRecord(clientKey: string): Promise<RateLimitResult> {
    const trimmedKey = clientKey.trim();
    const client = await this.clientRepo.findByKey(trimmedKey);

    if (!client) {
      const error: any = new Error(`Client '${clientKey}' not found`);
      error.statusCode = 404;
      throw error;
    }

    const redis = getRedisClient();
    const windowKey = `client:${trimmedKey}:window`;
    const nowMs = Date.now();
    const requestId = crypto.randomUUID();

    // Execute atomic Lua script
    const res = (await redis.eval(
      slidingWindowLua,
      1,
      windowKey,
      Math.floor(client.requestsPerSecond).toString(),
      client.windowSize.toString(),
      nowMs.toString(),
      requestId
    )) as [number, number, number, number, number];

    const isAllowed = res[0] === 1;
    const remaining = res[1];
    const limit = res[2];
    const reset = res[3];
    const retryAfter = res[4];

    if (isAllowed) {
      return {
        decision: 'ALLOW',
        algorithm: 'sliding_window',
        limit,
        remaining,
        reset,
      };
    } else {
      return {
        decision: 'DENY',
        algorithm: 'sliding_window',
        limit,
        remaining: 0,
        reset,
        retryAfter: retryAfter > 0 ? retryAfter : 1,
      };
    }
  }
}

export const redisSlidingWindowRepository = new RedisSlidingWindowRepository();
