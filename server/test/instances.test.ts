import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';

// Integration tests for task instances + calendar (step 6). Against the real
// Postgres.

const PASSWORD = 'correct-horse-battery';
const TZ = 'Asia/Dhaka';
const BASE = '/api/v1/tasks';

let app: FastifyInstance;
const createdEmails: string[] = [];

async function signupUser(): Promise<{ userId: string; auth: { authorization: string } }> {
  const email = `instance-test-${crypto.randomUUID()}@example.com`;
  createdEmails.push(email);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/signup',
    payload: { email, password: PASSWORD, timezone: TZ },
  });
  expect(res.statusCode).toBe(201);
  return { userId: res.json().user.id, auth: { authorization: `Bearer ${res.json().accessToken}` } };
}

const createTask = (auth: { authorization: string }, over: Record<string, unknown> = {}) =>
  app.inject({
    method: 'POST',
    url: BASE,
    headers: auth,
    payload: { title: 'Task', startDate: '2026-07-01', recurrenceType: 'DAILY', ...over },
  });

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  app = await buildApp(loadEnv());
});

afterAll(async () => {
  await app.prisma.user.deleteMany({ where: { email: { in: createdEmails } } });
  await app.close();
});

describe('PUT instance status (upsert)', () => {
  it('creates on first call and updates on repeat, keeping one row', async () => {
    const { auth } = await signupUser();
    const task = await createTask(auth, { recurrenceType: 'DAILY', startDate: '2026-07-01' });
    const id = task.json().id;
    const url = `${BASE}/${id}/instances/2026-07-15`;

    const first = await app.inject({ method: 'PUT', url, headers: auth, payload: { status: 'SKIPPED' } });
    expect(first.statusCode).toBe(200);
    expect(first.json().status).toBe('SKIPPED');
    expect(first.json().date).toBe('2026-07-15');
    const firstId = first.json().id;

    // PENDING → keeps the row (no delete)
    const second = await app.inject({ method: 'PUT', url, headers: auth, payload: { status: 'PENDING' } });
    expect(second.statusCode).toBe(200);
    expect(second.json().status).toBe('PENDING');
    expect(second.json().id).toBe(firstId); // same row

    const rows = await app.prisma.taskInstance.findMany({ where: { taskId: id } });
    expect(rows).toHaveLength(1);
  });

  it('round-trips PENDING→SKIPPED→PENDING on a single row', async () => {
    const { auth } = await signupUser();
    const task = await createTask(auth);
    const url = `${BASE}/${task.json().id}/instances/2026-07-15`;

    await app.inject({ method: 'PUT', url, headers: auth, payload: { status: 'PENDING' } });
    await app.inject({ method: 'PUT', url, headers: auth, payload: { status: 'SKIPPED' } });
    await app.inject({ method: 'PUT', url, headers: auth, payload: { status: 'PENDING' } });

    const rows = await app.prisma.taskInstance.findMany({ where: { taskId: task.json().id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('PENDING');
  });

  it('rejects COMPLETED as a plain VALIDATION_ERROR', async () => {
    const { auth } = await signupUser();
    const task = await createTask(auth);
    const res = await app.inject({
      method: 'PUT',
      url: `${BASE}/${task.json().id}/instances/2026-07-15`,
      headers: auth,
      payload: { status: 'COMPLETED' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-occurring date with 409 TASK_NOT_SCHEDULED', async () => {
    const { auth } = await signupUser();
    // NONE task on 2026-07-01 only
    const task = await createTask(auth, { recurrenceType: 'NONE', startDate: '2026-07-01' });
    const res = await app.inject({
      method: 'PUT',
      url: `${BASE}/${task.json().id}/instances/2026-07-02`,
      headers: auth,
      payload: { status: 'SKIPPED' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('TASK_NOT_SCHEDULED');
  });

  it('returns 404 for an invalid date or a foreign task', async () => {
    const owner = await signupUser();
    const intruder = await signupUser();
    const task = await createTask(owner.auth);

    const badDate = await app.inject({
      method: 'PUT',
      url: `${BASE}/${task.json().id}/instances/not-a-date`,
      headers: owner.auth,
      payload: { status: 'SKIPPED' },
    });
    expect(badDate.statusCode).toBe(404);

    const foreign = await app.inject({
      method: 'PUT',
      url: `${BASE}/${task.json().id}/instances/2026-07-15`,
      headers: intruder.auth,
      payload: { status: 'SKIPPED' },
    });
    expect(foreign.statusCode).toBe(404);
  });
});

describe('GET calendar', () => {
  it('validates range params', async () => {
    const { auth } = await signupUser();

    const missing = await app.inject({ method: 'GET', url: `${BASE}/calendar?from=2026-07-01`, headers: auth });
    expect(missing.statusCode).toBe(400);

    const backwards = await app.inject({
      method: 'GET',
      url: `${BASE}/calendar?from=2026-07-10&to=2026-07-01`,
      headers: auth,
    });
    expect(backwards.statusCode).toBe(400);
    expect(backwards.json().error.code).toBe('INVALID_RANGE');

    // 63 days (inclusive) exceeds the 62-day cap
    const tooLong = await app.inject({
      method: 'GET',
      url: `${BASE}/calendar?from=2026-07-01&to=2026-09-01`,
      headers: auth,
    });
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().error.code).toBe('RANGE_TOO_LARGE');
    expect(tooLong.json().error.maxDays).toBe(62);
  });

  it('returns only days with occurrences and reflects instance status', async () => {
    const { auth } = await signupUser();
    // WEEKLY Mondays (1) starting 2026-07-01
    const task = await createTask(auth, {
      title: 'Mondays',
      recurrenceType: 'WEEKLY',
      recurrenceDays: [1],
      startDate: '2026-07-01',
    });
    // 2026-07-06 and 2026-07-13 are Mondays. Skip the first.
    await app.inject({
      method: 'PUT',
      url: `${BASE}/${task.json().id}/instances/2026-07-06`,
      headers: auth,
      payload: { status: 'SKIPPED' },
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/calendar?from=2026-07-01&to=2026-07-15`,
      headers: auth,
    });
    expect(res.statusCode).toBe(200);
    const days = res.json().days;
    const dates = days.map((d: { date: string }) => d.date);
    expect(dates).toEqual(['2026-07-06', '2026-07-13']); // only Mondays

    const first = days.find((d: { date: string }) => d.date === '2026-07-06');
    expect(first.tasks[0].instanceStatus).toBe('SKIPPED');
    const second = days.find((d: { date: string }) => d.date === '2026-07-13');
    expect(second.tasks[0].instanceStatus).toBe('PENDING'); // no instance row
  });

  it('shows MONTHLY day-31 clamping across a month boundary', async () => {
    const { auth } = await signupUser();
    // MONTHLY on the 31st, from Jan. Feb clamps to 28 (2026 non-leap).
    await createTask(auth, {
      title: 'Month end',
      recurrenceType: 'MONTHLY',
      recurrenceDayOfMonth: 31,
      startDate: '2026-01-01',
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/calendar?from=2026-01-31&to=2026-03-02`,
      headers: auth,
    });
    const dates = res.json().days.map((d: { date: string }) => d.date);
    expect(dates).toContain('2026-01-31'); // exact
    expect(dates).toContain('2026-02-28'); // clamped from 31 (2026 non-leap)
    expect(dates).not.toContain('2026-02-27'); // only the clamped day, not the day before
    expect(dates).not.toContain('2026-03-02'); // March 31 is outside the range
  });

  it('excludes archived tasks', async () => {
    const { auth } = await signupUser();
    const task = await createTask(auth, { recurrenceType: 'DAILY', startDate: '2026-07-01' });
    await app.inject({
      method: 'PATCH',
      url: `${BASE}/${task.json().id}`,
      headers: auth,
      payload: { isArchived: true },
    });

    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/calendar?from=2026-07-01&to=2026-07-05`,
      headers: auth,
    });
    expect(res.json().days).toHaveLength(0);
  });
});
