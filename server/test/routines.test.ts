import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

// Integration tests for Phase 2-lite routine CRUD, against the real Postgres
// from docker-compose (same pattern as auth.test.ts). Two users are created
// to prove cross-user isolation; afterAll deletes them and cascades clean up
// their routines.

const PASSWORD = 'correct-horse-battery';
const TZ = 'Asia/Dhaka';

let app: FastifyInstance;
const createdEmails: string[] = [];

async function signupUser(): Promise<{ email: string; auth: { authorization: string } }> {
  const email = `routine-test-${crypto.randomUUID()}@example.com`;
  createdEmails.push(email);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email, password: PASSWORD, timezone: TZ },
  });
  expect(res.statusCode).toBe(201);
  return { email, auth: { authorization: `Bearer ${res.json().accessToken}` } };
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await buildApp(loadEnv());
});

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await app.close();
});

describe('auth requirements', () => {
  it('rejects unauthenticated access to every routine endpoint', async () => {
    const attempts = [
      { method: 'GET' as const, url: '/api/v1/routines' },
      { method: 'POST' as const, url: '/api/v1/routines' },
      { method: 'GET' as const, url: `/api/v1/routines/${crypto.randomUUID()}` },
      { method: 'PATCH' as const, url: `/api/v1/routines/${crypto.randomUUID()}` },
      { method: 'DELETE' as const, url: `/api/v1/routines/${crypto.randomUUID()}` },
    ];
    for (const attempt of attempts) {
      const res = await app.inject(attempt);
      expect(res.statusCode).toBe(401);
      expect(res.json().error.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('CRUD happy path', () => {
  it('creates, lists, reads, updates, archives, and deletes a routine', async () => {
    const { auth } = await signupUser();

    // Create
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/routines',
      headers: auth,
      payload: { name: 'Morning momentum' },
    });
    expect(created.statusCode).toBe(201);
    const routine = created.json();
    expect(routine.name).toBe('Morning momentum');
    expect(routine.isActive).toBe(true);
    expect(routine.archivedAt).toBeNull();

    // List contains it
    const list = await app.inject({ method: 'GET', url: '/api/v1/routines', headers: auth });
    expect(list.statusCode).toBe(200);
    expect(list.json().routines.map((r: { id: string }) => r.id)).toContain(routine.id);

    // Read
    const read = await app.inject({
      method: 'GET',
      url: `/api/v1/routines/${routine.id}`,
      headers: auth,
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().name).toBe('Morning momentum');

    // Update name + deactivate
    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/v1/routines/${routine.id}`,
      headers: auth,
      payload: { name: 'Evening momentum', isActive: false },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().name).toBe('Evening momentum');
    expect(patched.json().isActive).toBe(false);

    // Archive, then unarchive
    const archived = await app.inject({
      method: 'PATCH',
      url: `/api/v1/routines/${routine.id}`,
      headers: auth,
      payload: { archived: true },
    });
    expect(archived.statusCode).toBe(200);
    expect(archived.json().archivedAt).not.toBeNull();

    const unarchived = await app.inject({
      method: 'PATCH',
      url: `/api/v1/routines/${routine.id}`,
      headers: auth,
      payload: { archived: false },
    });
    expect(unarchived.json().archivedAt).toBeNull();

    // Delete, then reads 404
    const deleted = await app.inject({
      method: 'DELETE',
      url: `/api/v1/routines/${routine.id}`,
      headers: auth,
    });
    expect(deleted.statusCode).toBe(200);

    const gone = await app.inject({
      method: 'GET',
      url: `/api/v1/routines/${routine.id}`,
      headers: auth,
    });
    expect(gone.statusCode).toBe(404);
    expect(gone.json().error.code).toBe('NOT_FOUND');
  });
});

describe('validation', () => {
  it('returns 400 VALIDATION_ERROR with per-field details', async () => {
    const { auth } = await signupUser();

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/routines',
      headers: auth,
      payload: { name: '' },
    });
    expect(res.statusCode).toBe(400);
    const { error } = res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.details).toBeInstanceOf(Array);
    expect(error.details.length).toBeGreaterThan(0);
    expect(error.details[0]).toEqual({ path: 'name', message: 'Name is required.' });
    // message stays the first issue (backward compatibility)
    expect(error.message).toBe('name: Name is required.');
  });

  it('collects multiple issues into details[]', async () => {
    const { auth } = await signupUser();

    // Too-long name AND a wrongly-typed isActive on PATCH → two issues.
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/routines',
      headers: auth,
      payload: { name: 'Valid name' },
    });
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/routines/${created.json().id}`,
      headers: auth,
      payload: { name: 'x'.repeat(101), isActive: 'yes' },
    });
    expect(res.statusCode).toBe(400);
    const { error } = res.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    const paths = error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain('name');
    expect(paths).toContain('isActive');
  });

  it('rejects an empty PATCH body', async () => {
    const { auth } = await signupUser();
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/routines',
      headers: auth,
      payload: { name: 'Patch target' },
    });

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/routines/${created.json().id}`,
      headers: auth,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});

describe('cross-user isolation', () => {
  it("returns 404 for another user's routine on read/update/delete", async () => {
    const owner = await signupUser();
    const intruder = await signupUser();

    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/routines',
      headers: owner.auth,
      payload: { name: 'Private routine' },
    });
    const id = created.json().id;

    const attempts = [
      { method: 'GET' as const, url: `/api/v1/routines/${id}` },
      { method: 'PATCH' as const, url: `/api/v1/routines/${id}`, payload: { name: 'Hacked' } },
      { method: 'DELETE' as const, url: `/api/v1/routines/${id}` },
    ];
    for (const attempt of attempts) {
      const res = await app.inject({ ...attempt, headers: intruder.auth });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe('NOT_FOUND');
    }

    // And the intruder's list never shows it.
    const list = await app.inject({
      method: 'GET',
      url: '/api/v1/routines',
      headers: intruder.auth,
    });
    expect(list.json().routines).toHaveLength(0);

    // Owner still has it, untouched.
    const stillThere = await app.inject({
      method: 'GET',
      url: `/api/v1/routines/${id}`,
      headers: owner.auth,
    });
    expect(stillThere.statusCode).toBe(200);
    expect(stillThere.json().name).toBe('Private routine');
  });

  it('treats a malformed id as 404, indistinguishable from a missing one', async () => {
    const { auth } = await signupUser();
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/routines/not-a-uuid',
      headers: auth,
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});
