import type { FastifyInstance } from 'fastify';
import { updateMeRequestSchema, userSchema, type User } from '@routine-app/shared';
import { requireAuth } from '../middleware/require-auth.js';
import { unauthorizedError } from '../services/errors.js';
import { toUserDto } from './auth.routes.js';

// /api/v1/me — profile endpoints (§7). DELETE removes the account and, via
// the schema's cascades, every routine/task/completion/etc. (GDPR).
export async function meRoutes(app: FastifyInstance) {
  app.get('/me', { preHandler: requireAuth }, async (request): Promise<User> => {
    const user = await app.prisma.user.findUnique({ where: { id: request.userId } });
    if (!user) throw unauthorizedError(); // deleted account with a live token
    return userSchema.parse(toUserDto(user));
  });

  app.patch('/me', { preHandler: requireAuth }, async (request): Promise<User> => {
    const body = updateMeRequestSchema.parse(request.body);
    const user = await app.prisma.user.update({
      where: { id: request.userId },
      data: body,
    });
    return userSchema.parse(toUserDto(user));
  });

  app.delete('/me', { preHandler: requireAuth }, async (request): Promise<{ ok: true }> => {
    await app.prisma.user.delete({ where: { id: request.userId } });
    return { ok: true };
  });
}
