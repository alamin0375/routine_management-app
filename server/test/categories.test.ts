import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

// Integration tests for /api/v1/task-categories, against the real Postgres
// from docker-compose (same pattern as routines.test.ts). Task rows are
// created directly through Prisma — the task CRUD API arrives in a later
// step; here tasks only exist to exercise delete/reassign rules.

const PASSWORD = 'correct-horse-battery';
const TZ = 'Asia/Dhaka';
const BASE = '/api/v1/task-categories';

let app: FastifyInstance;
const createdEmails: string[] = [];

async function signupUser(): Promise<{
  userId: string;
  auth: { authorization: string };
}> {
  const email = `category-test-${crypto.randomUUID()}@example.com`;
  createdEmails.push(email);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email, password: PASSWORD, timezone: TZ },
  });
  expect(res.statusCode).toBe(201);
  return {
    userId: res.json().user.id,
    auth: { authorization: `Bearer ${res.json().accessToken}` },
  };
}

// Minimal valid task template pinned to a category.
function createTask(userId: string, categoryId: string, isArchived = false) {
  return app.prisma.task.create({
    data: {
      userId,
      categoryId,
      title: 'fixture task',
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      isArchived,
    },
  });
}

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await buildApp(loadEnv());
});

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await app.close();
});

describe('list & default seeding', () => {
  it('returns the 4 signup-seeded defaults sorted by sortOrder', async () => {
    const { auth } = await signupUser();
    const res = await app.inject({ method: 'GET', url: BASE, headers: auth });

    expect(res.statusCode).toBe(200);
    const names = res.json().categories.map((c: { name: string }) => c.name);
    expect(names).toEqual(['Study', 'Work', 'Health', 'Personal']);
  });

  it('does NOT resurrect a deleted default while other categories exist', async () => {
    const { auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const study = list.json().categories.find((c: { name: string }) => c.name === 'Study');

    const deleted = await app.inject({
      method: 'DELETE',
      url: `${BASE}/${study.id}`,
      headers: auth,
    });
    expect(deleted.statusCode).toBe(200);

    const after = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const names = after.json().categories.map((c: { name: string }) => c.name);
    expect(names).toEqual(['Work', 'Health', 'Personal']); // Study stays gone
  });

  it('re-seeds all 4 defaults when the user has deleted every category', async () => {
    const { auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });

    for (const category of list.json().categories) {
      const res = await app.inject({
        method: 'DELETE',
        url: `${BASE}/${category.id}`,
        headers: auth,
      });
      expect(res.statusCode).toBe(200);
    }

    const after = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const names = after.json().categories.map((c: { name: string }) => c.name);
    expect(names).toEqual(['Study', 'Work', 'Health', 'Personal']);
  });
});

describe('create', () => {
  it('creates with sortOrder = max + 1 and normalizes color to lowercase', async () => {
    const { auth } = await signupUser(); // defaults have sortOrder 0..3
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: auth,
      payload: { name: 'Reading', color: '#FFAA00' },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().color).toBe('#ffaa00');
    expect(res.json().sortOrder).toBe(4);
  });

  it('starts sortOrder at 0 when the user has no categories', async () => {
    const { auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    for (const category of list.json().categories) {
      await app.inject({ method: 'DELETE', url: `${BASE}/${category.id}`, headers: auth });
    }

    // Create WITHOUT listing first — the zero-categories guard must not run.
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: auth,
      payload: { name: 'Solo', color: '#123abc' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().sortOrder).toBe(0);
  });

  it('rejects a duplicate name with 409 CATEGORY_NAME_TAKEN', async () => {
    const { auth } = await signupUser();
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: auth,
      payload: { name: 'Study', color: '#112233' }, // collides with default
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CATEGORY_NAME_TAKEN');
  });

  it('rejects bad payloads with per-field details', async () => {
    const { auth } = await signupUser();
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      headers: auth,
      payload: { name: '   ', color: 'red' },
    });

    expect(res.statusCode).toBe(400);
    const paths = res.json().error.details.map((d: { path: string }) => d.path);
    expect(paths).toContain('name');
    expect(paths).toContain('color');
  });
});

describe('update', () => {
  it('renames, recolors (normalized), and reorders', async () => {
    const { auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const study = list.json().categories.find((c: { name: string }) => c.name === 'Study');

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${study.id}`,
      headers: auth,
      payload: { name: 'Deep Study', color: '#AABBCC', sortOrder: 9 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe('Deep Study');
    expect(res.json().color).toBe('#aabbcc');
    expect(res.json().sortOrder).toBe(9);
  });

  it('rejects renaming onto an existing name with 409', async () => {
    const { auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const study = list.json().categories.find((c: { name: string }) => c.name === 'Study');

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${study.id}`,
      headers: auth,
      payload: { name: 'Work' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CATEGORY_NAME_TAKEN');
  });

  it('rejects an empty PATCH body', async () => {
    const { auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const study = list.json().categories.find((c: { name: string }) => c.name === 'Study');

    const res = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${study.id}`,
      headers: auth,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('delete & reassign', () => {
  it('refuses to delete a category with tasks, reporting the count', async () => {
    const { userId, auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const study = list.json().categories.find((c: { name: string }) => c.name === 'Study');
    await createTask(userId, study.id);
    await createTask(userId, study.id, true); // archived tasks count too

    const res = await app.inject({
      method: 'DELETE',
      url: `${BASE}/${study.id}`,
      headers: auth,
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CATEGORY_NOT_EMPTY');
    expect(res.json().error.taskCount).toBe(2);
  });

  it('reassigns ALL tasks (archived included) then deletes, atomically', async () => {
    const { userId, auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const categories = list.json().categories;
    const study = categories.find((c: { name: string }) => c.name === 'Study');
    const work = categories.find((c: { name: string }) => c.name === 'Work');
    const active = await createTask(userId, study.id);
    const archived = await createTask(userId, study.id, true);

    const res = await app.inject({
      method: 'DELETE',
      url: `${BASE}/${study.id}?reassignTo=${work.id}`,
      headers: auth,
    });
    expect(res.statusCode).toBe(200);

    const moved = await app.prisma.task.findMany({
      where: { id: { in: [active.id, archived.id] } },
    });
    expect(moved).toHaveLength(2);
    expect(moved.every((t) => t.categoryId === work.id)).toBe(true);

    const gone = await app.prisma.taskCategory.findUnique({ where: { id: study.id } });
    expect(gone).toBeNull();
  });

  it('rejects reassignTo === id with 400 REASSIGN_TO_SELF', async () => {
    const { auth } = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const study = list.json().categories.find((c: { name: string }) => c.name === 'Study');

    const res = await app.inject({
      method: 'DELETE',
      url: `${BASE}/${study.id}?reassignTo=${study.id}`,
      headers: auth,
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('REASSIGN_TO_SELF');
  });

  it("rejects a reassignTo target owned by another user with 404", async () => {
    const owner = await signupUser();
    const other = await signupUser();
    const ownerList = await app.inject({ method: 'GET', url: BASE, headers: owner.auth });
    const otherList = await app.inject({ method: 'GET', url: BASE, headers: other.auth });
    const ownStudy = ownerList.json().categories.find((c: { name: string }) => c.name === 'Study');
    const foreign = otherList.json().categories.find((c: { name: string }) => c.name === 'Work');

    const res = await app.inject({
      method: 'DELETE',
      url: `${BASE}/${ownStudy.id}?reassignTo=${foreign.id}`,
      headers: owner.auth,
    });

    expect(res.statusCode).toBe(404);
    // And nothing was deleted.
    const still = await app.prisma.taskCategory.findUnique({ where: { id: ownStudy.id } });
    expect(still).not.toBeNull();
  });
});

describe('cross-user isolation & auth', () => {
  it("returns 404 for another user's category on update/delete, and for malformed ids", async () => {
    const owner = await signupUser();
    const intruder = await signupUser();
    const list = await app.inject({ method: 'GET', url: BASE, headers: owner.auth });
    const target = list.json().categories[0];

    const patch = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${target.id}`,
      headers: intruder.auth,
      payload: { name: 'Hijack' },
    });
    expect(patch.statusCode).toBe(404);

    const del = await app.inject({
      method: 'DELETE',
      url: `${BASE}/${target.id}`,
      headers: intruder.auth,
    });
    expect(del.statusCode).toBe(404);

    const malformed = await app.inject({
      method: 'PATCH',
      url: `${BASE}/not-a-uuid`,
      headers: owner.auth,
      payload: { name: 'x' },
    });
    expect(malformed.statusCode).toBe(404);
  });

  it('rejects unauthenticated access on every endpoint', async () => {
    const attempts = [
      { method: 'GET' as const, url: BASE },
      { method: 'POST' as const, url: BASE },
      { method: 'PATCH' as const, url: `${BASE}/${crypto.randomUUID()}` },
      { method: 'DELETE' as const, url: `${BASE}/${crypto.randomUUID()}` },
    ];
    for (const attempt of attempts) {
      const res = await app.inject(attempt);
      expect(res.statusCode).toBe(401);
    }
  });
});
