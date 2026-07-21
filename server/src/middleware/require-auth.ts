import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorizedError } from '../services/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
  }
}

// preHandler for protected routes: verifies the Bearer access token and
// attaches the user id. Ownership checks (§5: every resource row carries
// user_id) happen in services using this id.
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorizedError();

  try {
    request.userId = await request.server.authService.verifyAccessToken(header.slice(7));
  } catch {
    throw unauthorizedError();
  }
}
