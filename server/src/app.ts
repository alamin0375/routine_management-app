import Fastify from 'fastify';
import cors from '@fastify/cors';
import type { PrismaClient } from './generated/prisma/client.js';
import type { Env } from './config/env.js';
import { getPrisma, disconnectPrisma } from './db/client.js';
import { healthRoutes } from './routes/health.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

// Assembles the Fastify instance without listening — keeps the app testable
// (inject requests in tests) separate from the entrypoint (index.ts).
export async function buildApp(env: Env) {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });

  // Connection is lazy — the server boots without Postgres up; the first
  // query connects (and fails loudly if the database is unreachable).
  app.decorate('prisma', getPrisma(env.DATABASE_URL));
  app.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  await app.register(healthRoutes, { prefix: '/api/v1' });

  return app;
}
