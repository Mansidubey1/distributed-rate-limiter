import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const connectionUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/rate_limiter';

export const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionUrl,
    },
  },
  log: process.env.NODE_ENV === 'development' && process.env.DEBUG_PRISMA ? ['query', 'info', 'warn', 'error'] : ['error'],
});

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    return false;
  }
}
