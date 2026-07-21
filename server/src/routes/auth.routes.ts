import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  authResponseSchema,
  loginRequestSchema,
  signupRequestSchema,
  type AuthResponse,
} from '@routine-app/shared';
import type { User } from '../generated/prisma/client.js';
import { invalidRefreshTokenError } from '../services/errors.js';

// /api/v1/auth/* — thin routes: parse with shared schemas → AuthService →
// respond. The refresh token travels only in an httpOnly cookie (§5);
// the JSON body carries the access token.

export const REFRESH_COOKIE = 'refresh_token';

export function toUserDto(user: User) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    timezone: user.timezone,
    plan: user.plan,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function authRoutes(app: FastifyInstance) {
  const isProd = app.env.NODE_ENV === 'production';

  const setRefreshCookie = (reply: FastifyReply, token: string, expiresAt: Date) => {
    void reply.setCookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd, // localhost is http in dev
      sameSite: 'strict',
      path: '/api/v1/auth',
      expires: expiresAt,
    });
  };

  app.post('/auth/signup', async (request, reply): Promise<AuthResponse> => {
    const body = signupRequestSchema.parse(request.body);
    const { user, tokens } = await app.authService.signup(body.email, body.password, body.timezone);
    setRefreshCookie(reply, tokens.refreshToken, tokens.refreshExpiresAt);
    reply.status(201);
    return authResponseSchema.parse({ accessToken: tokens.accessToken, user: toUserDto(user) });
  });

  app.post('/auth/login', async (request, reply): Promise<AuthResponse> => {
    const body = loginRequestSchema.parse(request.body);
    const { user, tokens } = await app.authService.login(body.email, body.password);
    setRefreshCookie(reply, tokens.refreshToken, tokens.refreshExpiresAt);
    return authResponseSchema.parse({ accessToken: tokens.accessToken, user: toUserDto(user) });
  });

  app.post('/auth/refresh', async (request, reply): Promise<AuthResponse> => {
    const raw = request.cookies[REFRESH_COOKIE];
    if (!raw) throw invalidRefreshTokenError();
    const { user, tokens } = await app.authService.refresh(raw);
    setRefreshCookie(reply, tokens.refreshToken, tokens.refreshExpiresAt);
    return authResponseSchema.parse({ accessToken: tokens.accessToken, user: toUserDto(user) });
  });

  app.post('/auth/logout', async (request, reply): Promise<{ ok: true }> => {
    const raw = request.cookies[REFRESH_COOKIE];
    if (raw) await app.authService.logout(raw);
    void reply.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { ok: true };
  });
}
