import { prisma } from '../db/prisma.js';
import { RateLimitResult } from '../types/rateLimiter.js';

export interface ISlidingWindowRepository {
  checkAndRecord(clientKey: string): Promise<RateLimitResult>;
  clearRequests(clientId: string): Promise<void>;
}

interface LockedClientRow {
  id: string;
  client_key: string;
  requests_per_second: number;
  window_size: number;
}

interface WindowCountRow {
  active_count: number;
  oldest_epoch: number | null;
  now_epoch: number;
}

export class PostgresSlidingWindowRepository implements ISlidingWindowRepository {
  async clearRequests(clientId: string): Promise<void> {
    await prisma.slidingWindowRequest.deleteMany({
      where: { clientId },
    });
  }

  async checkAndRecord(clientKey: string): Promise<RateLimitResult> {
    const trimmedKey = clientKey.trim();

    return await prisma.$transaction(
      async (tx) => {
        // 1. Explicit row lock on client table to serialize all checks for this client (PRD §5.4 Option A)
        const clientRows = await tx.$queryRaw<LockedClientRow[]>`
          SELECT id, client_key, requests_per_second, window_size
          FROM "clients"
          WHERE "client_key" = ${trimmedKey}
          FOR UPDATE
        `;

        if (!clientRows || clientRows.length === 0) {
          const error: any = new Error(`Client '${clientKey}' not found`);
          error.statusCode = 404;
          throw error;
        }

        const client = clientRows[0];
        const limit = Math.floor(Number(client.requests_per_second));
        const windowSize = Number(client.window_size) || 1.0;
        const clientId = client.id;

        // 2. Prune expired entries older than now - windowSize
        await tx.$executeRaw`
          DELETE FROM "sliding_window_requests"
          WHERE "client_id" = ${clientId}
            AND "requested_at" < (NOW() - (${windowSize} * INTERVAL '1 second'))
        `;

        // 3. Count remaining active requests in sliding window
        const countRows = await tx.$queryRaw<WindowCountRow[]>`
          SELECT
            COUNT(*)::int AS active_count,
            EXTRACT(EPOCH FROM MIN("requested_at"))::double precision AS oldest_epoch,
            EXTRACT(EPOCH FROM NOW())::double precision AS now_epoch
          FROM "sliding_window_requests"
          WHERE "client_id" = ${clientId}
        `;

        const activeCount = Number(countRows[0]?.active_count ?? 0);
        const oldestEpoch = countRows[0]?.oldest_epoch ? Number(countRows[0].oldest_epoch) : null;
        const nowEpoch = Number(countRows[0]?.now_epoch ?? Math.floor(Date.now() / 1000));

        if (activeCount < limit) {
          // ALLOW: record timestamp
          await tx.$executeRaw`
            INSERT INTO "sliding_window_requests" ("id", "client_id", "requested_at")
            VALUES (gen_random_uuid()::text, ${clientId}, NOW())
          `;

          // Atomically update client stats
          await tx.$executeRaw`
            UPDATE "clients"
            SET
              total_requests = total_requests + 1,
              allowed_requests = allowed_requests + 1
            WHERE "id" = ${clientId}
          `;

          const remaining = Math.max(0, limit - activeCount - 1);
          const resetEarliest = oldestEpoch !== null ? oldestEpoch : nowEpoch;
          const reset = Math.max(Math.floor(nowEpoch), Math.ceil(resetEarliest + windowSize));

          return {
            decision: 'ALLOW',
            algorithm: 'sliding_window',
            limit,
            remaining,
            reset,
          };
        } else {
          // DENY: limit reached
          await tx.$executeRaw`
            UPDATE "clients"
            SET
              total_requests = total_requests + 1,
              denied_requests = denied_requests + 1
            WHERE "id" = ${clientId}
          `;

          const effectiveOldest = oldestEpoch !== null ? oldestEpoch : nowEpoch;
          const retryAfter = Math.max(1, Math.ceil(effectiveOldest + windowSize - nowEpoch));
          const reset = Math.max(Math.floor(nowEpoch), Math.ceil(effectiveOldest + windowSize));

          return {
            decision: 'DENY',
            algorithm: 'sliding_window',
            limit,
            remaining: 0,
            reset,
            retryAfter,
          };
        }
      },
      {
        maxWait: 15000,
        timeout: 30000,
      }
    );
  }
}

export const slidingWindowRepository = new PostgresSlidingWindowRepository();
