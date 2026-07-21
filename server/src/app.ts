import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import type { PrismaClient } from './generated/prisma/client.js';
import type { Env } from './config/env.js';
import { getPrisma, disconnectPrisma } from './db/client.js';
import { AuthService } from './services/auth.service.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRoutes } from './routes/health.routes.js';
import { authRoutes } from './routes/auth.routes.js';
import { meRoutes } from './routes/me.routes.js';

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    prisma: PrismaClient;
    authService: AuthService;
  }
}

// Assembles the Fastify instance without listening — keeps the app testable
// (inject requests in tests) separate from the entrypoint (index.ts).
export async function buildApp(env: Env) {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'test'
        ? false
        : {
            level: env.NODE_ENV === 'production' ? 'info' : 'debug',
          },
  });

  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(cookie);

  app.setErrorHandler(errorHandler);

  // Connection is lazy — the server boots without Postgres up; the first
  // query connects (and fails loudly if the database is unreachable).
  const prisma = getPrisma(env.DATABASE_URL);
  app.decorate('env', env);
  app.decorate('prisma', prisma);
  app.decorate('authService', new AuthService(prisma, env));
  app.addHook('onClose', async () => {
    await disconnectPrisma();
  });

  await app.register(healthRoutes, { prefix: '/api/v1' });
  await app.register(authRoutes, { prefix: '/api/v1' });
  await app.register(meRoutes, { prefix: '/api/v1' });

  return app;
}
