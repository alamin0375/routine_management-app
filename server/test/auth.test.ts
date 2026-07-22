import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

// Integration tests for the Phase 1 auth flow. They hit the real Postgres
// from docker-compose (no mocks — the rotation/uniqueness guarantees live in
// the database). Each run uses random emails; afterAll deletes the created
// users and cascades clean up everything else.

const testEmail = () => `test-${crypto.randomUUID()}@example.com`;
const PASSWORD = 'correct-horse-battery';
const TZ = 'Asia/Dhaka';

let app: FastifyInstance;
const createdEmails: string[] = [];

const signup = (email: string) =>
  app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email, password: PASSWORD, timezone: TZ },
  });

const refreshCookieOf = (res: { cookies: { name: string; value: string }[] }) => {
  const cookie = res.cookies.find((c) => c.name === 'refresh_token');
  expect(cookie).toBeDefined();
  return cookie!.value;
};

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await buildApp(loadEnv());
});

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await app.close();
});

describe('signup', () => {
  it('creates a user, returns an access token and sets a refresh cookie', async () => {
    const email = testEmail();
    createdEmails.push(email);
    const res = await signup(email);

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeTypeOf('string');
    expect(body.user.email).toBe(email);
    expect(body.user.plan).toBe('FREE');
    expect(refreshCookieOf(res)).toBeTruthy();
  });

  it('seeds exactly the 4 default task categories for the new user', async () => {
    const email = testEmail();
    createdEmails.push(email);
    const res = await signup(email);
    expect(res.statusCode).toBe(201);

    const categories = await app.prisma.taskCategory.findMany({
      where: { userId: res.json().user.id },
      orderBy: { sortOrder: 'asc' },
    });
    expect(categories.map((c) => c.name)).toEqual(['Study', 'Work', 'Health', 'Personal']);
    expect(categories.every((c) => /^#[0-9a-f]{6}$/i.test(c.color))).toBe(true);
  });

  it('rejects a duplicate email with EMAIL_TAKEN', async () => {
    const email = testEmail();
    createdEmails.push(email);
    await signup(email);
    const res = await signup(email.toUpperCase()); // emails are normalized

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('EMAIL_TAKEN');
  });

  it('rejects an invalid timezone with VALIDATION_ERROR', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/signup',
      payload: { email: testEmail(), password: PASSWORD, timezone: 'Not/AZone' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('login', () => {
  it('returns tokens for correct credentials', async () => {
    const email = testEmail();
    createdEmails.push(email);
    await signup(email);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: PASSWORD },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeTypeOf('string');
  });

  it('rejects a wrong password and an unknown email identically', async () => {
    const email = testEmail();
    createdEmails.push(email);
    await signup(email);

    const wrongPassword = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email, password: 'wrong-password' },
    });
    const unknownEmail = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: testEmail(), password: PASSWORD },
    });

    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('INVALID_CREDENTIALS');
    }
  });
});

describe('refresh rotation', () => {
  it('rotates the refresh token and rejects replay of the old one', async () => {
    const email = testEmail();
    createdEmails.push(email);
    const signupRes = await signup(email);
    const firstToken = refreshCookieOf(signupRes);

    const refresh1 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: firstToken },
    });
    expect(refresh1.statusCode).toBe(200);
    const secondToken = refreshCookieOf(refresh1);
    expect(secondToken).not.toBe(firstToken);

    // Replaying the revoked first token must fail…
    const replay = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: firstToken },
    });
    expect(replay.statusCode).toBe(401);
    expect(replay.json().error.code).toBe('INVALID_REFRESH_TOKEN');

    // …while the rotated token still works.
    const refresh2 = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: secondToken },
    });
    expect(refresh2.statusCode).toBe(200);
  });

  it('rejects refresh with no cookie', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/refresh' });
    expect(res.statusCode).toBe(401);
  });
});

describe('logout', () => {
  it('revokes the refresh token', async () => {
    const email = testEmail();
    createdEmails.push(email);
    const token = refreshCookieOf(await signup(email));

    const logout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      cookies: { refresh_token: token },
    });
    expect(logout.statusCode).toBe(200);

    const afterLogout = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      cookies: { refresh_token: token },
    });
    expect(afterLogout.statusCode).toBe(401);
  });
});

describe('/me', () => {
  it('requires a valid Bearer token', async () => {
    const noAuth = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(noAuth.statusCode).toBe(401);

    const badToken = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { authorization: 'Bearer not-a-jwt' },
    });
    expect(badToken.statusCode).toBe(401);
  });

  it('returns the profile, updates timezone, and deletes the account', async () => {
    const email = testEmail();
    createdEmails.push(email);
    const { accessToken } = (await signup(email)).json();
    const auth = { authorization: `Bearer ${accessToken}` };

    const me = await app.inject({ method: 'GET', url: '/api/v1/me', headers: auth });
    expect(me.statusCode).toBe(200);
    expect(me.json().email).toBe(email);

    const patched = await app.inject({
      method: 'PATCH',
      url: '/api/v1/me',
      headers: auth,
      payload: { timezone: 'Europe/Berlin' },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().timezone).toBe('Europe/Berlin');

    const deleted = await app.inject({ method: 'DELETE', url: '/api/v1/me', headers: auth });
    expect(deleted.statusCode).toBe(200);

    // Live access token for a deleted account no longer works.
    const gone = await app.inject({ method: 'GET', url: '/api/v1/me', headers: auth });
    expect(gone.statusCode).toBe(401);
  });
});
