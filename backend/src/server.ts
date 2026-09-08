import dotenv from 'dotenv';
import { buildApp } from './app.js';
import { prisma } from './db/prisma.js';

dotenv.config();

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function startServer() {
  const app = buildApp({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? undefined
          : undefined,
    },
  });

  // Handle graceful shutdown
  const closeSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of closeSignals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}, closing server gracefully...`);
      try {
        await app.close();
        await prisma.$disconnect();
        process.exit(0);
      } catch (err) {
        app.log.error(err);
        process.exit(1);
      }
    });
  }

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`Rate Limiter Service listening on http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
