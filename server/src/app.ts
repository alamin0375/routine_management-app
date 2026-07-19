import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { Env } from './config/env.js';
import { healthRoutes } from './routes/health.routes.js';

// Assembles the Fastify instance without listening — keeps the app testable
// (inject requests in tests) separate from the entrypoint (index.ts).
export async function buildApp(env: Env) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });

  await app.register(healthRoutes, { prefix: '/api/v1' });

  return app;
}
