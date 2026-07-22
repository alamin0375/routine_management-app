import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

// Integration tests for /api/v1/tasks (step 5). Against the real Postgres.
// Task instances are seeded directly via Prisma where needed.

const PASSWORD = 'correct-horse-battery';
const TZ = 'Asia/Dhaka'; // UTC+6, used for most tests
const BASE = '/api/v1/tasks';

let app: FastifyInstance;
const createdEmails: string[] = [];

async function signupUser(tz = TZ): Promise<{
  userId: string;
  auth: { authorization: string };
}> {
  const email = `task-test-${crypto.randomUUID()}@example.com`;
  createdEmails.push(email);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email, password: PASSWORD, timezone: tz },
  });
  expect(res.statusCode).toBe(201);
  return { userId: res.json().user.id, auth: { authorization: `Bearer ${res.json().accessToken}` } };
}

const createTask = (auth: { authorization: string }, over: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: BASE,
    headers: auth,
    payload: {
      title: 'Study React',
      startDate: '2026-07-01',
      recurrenceType: 'DAILY',
      ...over,
    },
  });

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await buildApp(loadEnv());
});

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await app.close();
});

describe('create', () => {
  it('creates a task and forces source to MANUAL even if schema strips it', async () => {
    const { auth } = await signupUser();
    const res = await createTask(auth, { source: 'AI' }); // schema strips source
    expect(res.statusCode).toBe(201);
    const task = res.json();
    expect(task.source).toBe('MANUAL');
    expect(task.title).toBe('Study React');
    expect(task.recurrenceType).toBe('DAILY');
  });

  it('rejects a foreign categoryId with 404', async () => {
    const owner = await signupUser();
    const other = await signupUser();
    const catList = await app.inject({ method: 'GET', url: '/api/v1/task-categories', headers: other.auth });
    const foreignCat = catList.json().categories[0];

    const res = await createTask(owner.auth, { categoryId: foreignCat.id });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });

  it('rejects a foreign routineId with 404', async () => {
    const owner = await signupUser();
    const other = await signupUser();
    const routine = await app.inject({
      method: 'POST', url: '/api/v1/routines', headers: other.auth,
      payload: { name: 'Other routine' },
    });
    const res = await createTask(owner.auth, { routineId: routine.json().id });
    expect(res.statusCode).toBe(404);
  });

  it('enforces the 50-active-task limit on create', async () => {
    const { auth } = await signupUser();
    // Create 50 tasks
    for (let i = 0; i < 50; i++) {
      const r = await createTask(auth, { title: `Task ${i}` });
      expect(r.statusCode).toBe(201);
    }
    const over = await createTask(auth, { title: 'Task 51' });
    expect(over.statusCode).toBe(409);
    expect(over.json().error.code).toBe('PLAN_LIMIT_REACHED');
    expect(over.json().error.limit).toBe(50);
    expect(over.json().error.current).toBe(50);
  });
});

describe('list', () => {
  it('returns only non-archived tasks by default, sorted by startTime then title', async () => {
    const { auth } = await signupUser();
    await createTask(auth, { title: 'Zebra', startTime: '10:00', endTime: '11:00' });
    await createTask(auth, { title: 'Apple', startTime: '10:00', endTime: '11:00' });
    await createTask(auth, { title: 'No time' });
    const created = await createTask(auth, { title: 'Archived' });
    await app.inject({ method: 'PATCH', url: `${BASE}/${created.json().id}`, headers: auth, payload: { isArchived: true } });

    const res = await app.inject({ method: 'GET', url: BASE, headers: auth });
    expect(res.statusCode).toBe(200);
    const titles = res.json().tasks.map((t: { title: string }) => t.title);
    // Apple and Zebra both at 10:00, sorted by title; No time last (null startTime)
    expect(titles.indexOf('Apple')).toBeLessThan(titles.indexOf('Zebra'));
    expect(titles.indexOf('Zebra')).toBeLessThan(titles.indexOf('No time'));
    expect(titles).not.toContain('Archived');
  });

  it('sorts timed tasks ascending with untimed (null startTime) last', async () => {
    const { auth } = await signupUser();
    await createTask(auth, { title: 'Nine', startTime: '09:00', endTime: '10:00' });
    await createTask(auth, { title: 'Untimed' }); // null startTime
    await createTask(auth, { title: 'Seven', startTime: '07:00', endTime: '08:00' });

    const res = await app.inject({ method: 'GET', url: BASE, headers: auth });
    const titles = res.json().tasks.map((t: { title: string }) => t.title);
    expect(titles).toEqual(['Seven', 'Nine', 'Untimed']);
  });

  it('filters by isArchived=true', async () => {
    const { auth } = await signupUser();
    const t = await createTask(auth, { title: 'To archive' });
    await app.inject({ method: 'PATCH', url: `${BASE}/${t.json().id}`, headers: auth, payload: { isArchived: true } });

    const res = await app.inject({ method: 'GET', url: `${BASE}?isArchived=true`, headers: auth });
    const titles = res.json().tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain('To archive');
  });

  it('filters by categoryId', async () => {
    const { auth } = await signupUser();
    const cats = await app.inject({ method: 'GET', url: '/api/v1/task-categories', headers: auth });
    const catId = cats.json().categories[0].id;
    await createTask(auth, { title: 'Categorized', categoryId: catId });
    await createTask(auth, { title: 'Uncategorized' });

    const res = await app.inject({ method: 'GET', url: `${BASE}?categoryId=${catId}`, headers: auth });
    const titles = res.json().tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain('Categorized');
    expect(titles).not.toContain('Uncategorized');
  });
});

describe('get', () => {
  it('returns 404 for another user\'s task and for malformed ids', async () => {
    const owner = await signupUser();
    const intruder = await signupUser();
    const t = await createTask(owner.auth);

    const cross = await app.inject({ method: 'GET', url: `${BASE}/${t.json().id}`, headers: intruder.auth });
    expect(cross.statusCode).toBe(404);

    const bad = await app.inject({ method: 'GET', url: `${BASE}/not-a-uuid`, headers: owner.auth });
    expect(bad.statusCode).toBe(404);
  });
});

describe('patch', () => {
  it('detaches category when categoryId is explicitly null', async () => {
    const { auth } = await signupUser();
    const cats = await app.inject({ method: 'GET', url: '/api/v1/task-categories', headers: auth });
    const catId = cats.json().categories[0].id;
    const t = await createTask(auth, { categoryId: catId });
    expect(t.json().categoryId).toBe(catId);

    const res = await app.inject({ method: 'PATCH', url: `${BASE}/${t.json().id}`, headers: auth, payload: { categoryId: null } });
    expect(res.statusCode).toBe(200);
    expect(res.json().categoryId).toBeNull();
  });

  it('enforces the 50-task limit when unarchiving', async () => {
    const { auth } = await signupUser();
    // Create 49 active + 1 archived
    for (let i = 0; i < 49; i++) await createTask(auth, { title: `Active ${i}` });
    const archived = await createTask(auth, { title: 'Archived one' });
    await app.inject({ method: 'PATCH', url: `${BASE}/${archived.json().id}`, headers: auth, payload: { isArchived: true } });
    // Now at 49 active — create one more to hit 50
    await createTask(auth, { title: 'Active 50' });

    const res = await app.inject({ method: 'PATCH', url: `${BASE}/${archived.json().id}`, headers: auth, payload: { isArchived: false } });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('PLAN_LIMIT_REACHED');
  });

  it('recurrence change deletes only future PENDING instances', async () => {
    const { userId, auth } = await signupUser();
    const t = await createTask(auth, { title: 'Recur task', recurrenceType: 'DAILY', startDate: '2026-01-01' });
    const taskId = t.json().id;

    // Seed 4 instances: past PENDING, today PENDING, future PENDING, future SKIPPED
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
    const pastDate = new Date('2026-01-01T00:00:00.000Z');
    const todayDate = new Date(`${todayStr}T00:00:00.000Z`);
    const futureDate = new Date(Date.now() + 2 * 86400_000);
    futureDate.setUTCHours(0, 0, 0, 0);

    const [past, today, futurePending, futureSkipped] = await Promise.all([
      app.prisma.taskInstance.create({ data: { taskId, userId, date: pastDate, status: 'PENDING' } }),
      app.prisma.taskInstance.create({ data: { taskId, userId, date: todayDate, status: 'PENDING' } }),
      app.prisma.taskInstance.create({ data: { taskId, userId, date: futureDate, status: 'PENDING' } }),
      app.prisma.taskInstance.create({ data: { taskId, userId, date: new Date(futureDate.getTime() + 86400_000), status: 'SKIPPED' } }),
    ]);

    const res = await app.inject({
      method: 'PATCH', url: `${BASE}/${taskId}`, headers: auth,
      payload: { recurrenceType: 'WEEKLY', recurrenceDays: [1] },
    });
    expect(res.statusCode).toBe(200);

    const remaining = await app.prisma.taskInstance.findMany({ where: { taskId } });
    const ids = remaining.map((i) => i.id);
    expect(ids).toContain(past.id);       // past PENDING survives
    expect(ids).toContain(today.id);      // today PENDING survives
    expect(ids).not.toContain(futurePending.id); // future PENDING deleted
    expect(ids).toContain(futureSkipped.id);     // future SKIPPED survives
  });
});

describe('delete', () => {
  it('hard-deletes the task and returns 204', async () => {
    const { auth } = await signupUser();
    const t = await createTask(auth);
    const res = await app.inject({ method: 'DELETE', url: `${BASE}/${t.json().id}`, headers: auth });
    expect(res.statusCode).toBe(204);

    const gone = await app.inject({ method: 'GET', url: `${BASE}/${t.json().id}`, headers: auth });
    expect(gone.statusCode).toBe(404);
  });
});

describe('today endpoint', () => {
  it('returns tasks matching the given date, with instanceStatus and instanceId', async () => {
    const { userId, auth } = await signupUser();
    // DAILY task covering 2026-07-15
    const daily = await createTask(auth, { title: 'Daily', recurrenceType: 'DAILY', startDate: '2026-07-01', endDate: '2026-12-31' });
    // NONE task on exactly 2026-07-15
    await createTask(auth, { title: 'Once', recurrenceType: 'NONE', startDate: '2026-07-15' });
    // NONE task on a different day — should NOT appear
    await createTask(auth, { title: 'Other day', recurrenceType: 'NONE', startDate: '2026-07-16' });
    // WEEKLY on Wednesday (3) — 2026-07-15 is a Wednesday
    await createTask(auth, { title: 'Wednesday', recurrenceType: 'WEEKLY', recurrenceDays: [3], startDate: '2026-07-01' });
    // MONTHLY on 15th
    await createTask(auth, { title: 'Monthly 15', recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 15, startDate: '2026-07-01' });

    // Seed an instance for the daily task
    const instance = await app.prisma.taskInstance.create({
      data: { taskId: daily.json().id, userId, date: new Date('2026-07-15T00:00:00.000Z'), status: 'SKIPPED' },
    });

    const res = await app.inject({ method: 'GET', url: `${BASE}/today?date=2026-07-15`, headers: auth });
    expect(res.statusCode).toBe(200);
    expect(res.json().date).toBe('2026-07-15');

    const tasks = res.json().tasks;
    const titles = tasks.map((t: { title: string }) => t.title);
    expect(titles).toContain('Daily');
    expect(titles).toContain('Once');
    expect(titles).toContain('Wednesday');
    expect(titles).toContain('Monthly 15');
    expect(titles).not.toContain('Other day');

    const dailyEntry = tasks.find((t: { title: string }) => t.title === 'Daily');
    expect(dailyEntry.instanceStatus).toBe('SKIPPED');
    expect(dailyEntry.instanceId).toBe(instance.id);

    const onceEntry = tasks.find((t: { title: string }) => t.title === 'Once');
    expect(onceEntry.instanceStatus).toBe('PENDING');
    expect(onceEntry.instanceId).toBeNull();
  });

  it('excludes archived tasks from today', async () => {
    const { auth } = await signupUser();
    const t = await createTask(auth, { recurrenceType: 'DAILY', startDate: '2026-07-01' });
    await app.inject({ method: 'PATCH', url: `${BASE}/${t.json().id}`, headers: auth, payload: { isArchived: true } });

    const res = await app.inject({ method: 'GET', url: `${BASE}/today?date=2026-07-15`, headers: auth });
    const ids = res.json().tasks.map((t: { id: string }) => t.id);
    expect(ids).not.toContain(t.json().id);
  });

  it('defaults to the user\'s local date when no date param given', async () => {
    // Pacific/Honolulu is UTC-10; at UTC midnight it is still the previous day.
    const { auth } = await signupUser('Pacific/Honolulu');
    // Mock system time to 2026-07-15T05:00:00Z → UTC date is 2026-07-15, but
    // Honolulu date is 2026-07-14 (UTC-10).
    vi.setSystemTime(new Date('2026-07-15T05:00:00.000Z'));
    try {
      const res = await app.inject({ method: 'GET', url: `${BASE}/today`, headers: auth });
      expect(res.statusCode).toBe(200);
      expect(res.json().date).toBe('2026-07-14'); // Honolulu local date
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects an invalid date with 400 VALIDATION_ERROR', async () => {
    const { auth } = await signupUser();
    const res = await app.inject({ method: 'GET', url: `${BASE}/today?date=not-a-date`, headers: auth });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });
});
