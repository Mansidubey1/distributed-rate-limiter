import fastify, { FastifyInstance, FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { healthRoutes } from './routes/health.js';
import { adminRoutes } from './routes/admin.js';
import { checkRoutes } from './routes/check.js';
import { metricsRoutes } from './routes/metrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const app = fastify({
    logger: opts.logger ?? {
      level: process.env.NODE_ENV === 'test' ? 'silent' : 'info',
    },
    ...opts,
  });

  // Enable CORS
  app.register(cors, {
    origin: true,
  });

  // Register Dashboard Static Assets
  const publicPath = path.join(__dirname, '..', 'public');
  const dashboardDistPath = path.join(publicPath, 'dashboard-dist');

  if (fs.existsSync(dashboardDistPath)) {
    app.register(fastifyStatic, {
      root: dashboardDistPath,
      prefix: '/dashboard/',
    });
  } else {
    app.register(fastifyStatic, {
      root: publicPath,
      prefix: '/dashboard/',
    });
  }

  // Dashboard route
  app.get('/dashboard', async (_request, reply) => {
    if (fs.existsSync(path.join(dashboardDistPath, 'index.html'))) {
      return reply.sendFile('index.html', dashboardDistPath);
    }
    return reply.sendFile('dashboard.html', publicPath);
  });

  app.get('/', async (_request, reply) => {
    if (fs.existsSync(path.join(dashboardDistPath, 'index.html'))) {
      return reply.sendFile('index.html', dashboardDistPath);
    }
    return reply.sendFile('dashboard.html', publicPath);
  });

  // Register Routes
  app.register(healthRoutes);
  app.register(adminRoutes);
  app.register(checkRoutes);
  app.register(metricsRoutes);

  // Custom 404 Handler
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send({
      error: `Route ${request.method}:${request.url} not found`,
    });
  });

  // Global Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    const statusCode = error.statusCode || 500;
    app.log.error(error);
    reply.status(statusCode).send({
      error: error.message || 'Internal server error',
    });
  });

  return app;
}
