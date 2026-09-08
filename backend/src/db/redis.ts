import { Redis } from 'ioredis';

let redisInstance: Redis | null = null;
let isRedisConnected = false;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
    
    redisInstance = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      retryStrategy(times) {
        if (times > 3) {
          return null; // Stop retrying after 3 attempts
        }
        return Math.min(times * 200, 1000);
      },
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    redisInstance.on('connect', () => {
      isRedisConnected = true;
    });

    redisInstance.on('ready', () => {
      isRedisConnected = true;
    });

    redisInstance.on('error', (_err) => {
      isRedisConnected = false;
    });

    redisInstance.on('close', () => {
      isRedisConnected = false;
    });
  }

  return redisInstance;
}

export function setCustomRedisClient(client: Redis | null): void {
  redisInstance = client;
  isRedisConnected = client !== null;
}

export async function checkRedisHealth(): Promise<'healthy' | 'unhealthy' | 'disabled'> {
  const isDistributed = process.env.DISTRIBUTED_MODE === 'true';
  if (!isDistributed && !process.env.REDIS_URL) {
    return 'disabled';
  }

  try {
    const client = getRedisClient();
    if (client.status === 'wait') {
      await client.connect();
    }
    const pong = await client.ping();
    return pong === 'PONG' ? 'healthy' : 'unhealthy';
  } catch (_err) {
    return 'unhealthy';
  }
}

export async function closeRedis(): Promise<void> {
  if (redisInstance) {
    try {
      await redisInstance.quit();
    } catch (_) {
      redisInstance.disconnect();
    }
    redisInstance = null;
    isRedisConnected = false;
  }
}
