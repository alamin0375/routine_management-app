import { describe, expect, it } from 'vitest';
import { taskCreateSchema, taskUpdateSchema } from '../src/schemas/tasks.js';

// Unit tests for the task contracts — the write-side spec of recurrence
// consistency, range rules, and boundaries. Pure Zod, no server.

// Minimal valid NONE task; spread overrides to build each case.
const base = {
  title: 'Study React',
  startDate: '2026-07-01',
  recurrenceType: 'NONE',
} as const;

const create = (over: Record<string, unknown> = {}) =>
  taskCreateSchema.safeParse({ ...base, ...over });

const update = (payload: Record<string, unknown>) => taskUpdateSchema.safeParse(payload);

const pathsOf = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : result.error!.issues.map((issue) => issue.path.join('.'));

describe('title', () => {
  it('accepts 1 and 200 chars (after trim), rejects empty/whitespace and 201', () => {
    expect(create({ title: 'a' }).success).toBe(true);
    expect(create({ title: 'x'.repeat(200) }).success).toBe(true);
    expect(create({ title: '  padded  ' }).data?.title).toBe('padded');
    expect(create({ title: '' }).success).toBe(false);
    expect(create({ title: '   ' }).success).toBe(false);
    expect(create({ title: 'x'.repeat(201) }).success).toBe(false);
  });
});

describe('notes', () => {
  it('accepts 5000 chars and absence, rejects 5001', () => {
    expect(create({ notes: 'n'.repeat(5000) }).success).toBe(true);
    expect(create().success).toBe(true);
    expect(create({ notes: 'n'.repeat(5001) }).success).toBe(false);
  });
});

describe('ids', () => {
  it('accepts uuids, rejects junk', () => {
    const uuid = '4c4d6f6a-58a3-4f3f-9c3a-3a4f6b2e1d0c';
    expect(create({ categoryId: uuid, routineId: uuid }).success).toBe(true);
    expect(create({ categoryId: 'not-a-uuid' }).success).toBe(false);
    expect(create({ routineId: 42 }).success).toBe(false);
  });
});

describe('color', () => {
  it('accepts #RRGGBB case-insensitively and normalizes to lowercase', () => {
    const result = create({ color: '#FFAA00' });
    expect(result.success).toBe(true);
    expect(result.data?.color).toBe('#ffaa00');
  });

  it('rejects other formats', () => {
    for (const bad of ['red', '#fff', '#ffaa0', '#ffaa000', 'ffaa00', '#ggaa00']) {
      expect(create({ color: bad }).success).toBe(false);
    }
  });
});

describe('priority', () => {
  it('accepts the four enum values and absence, rejects others', () => {
    for (const priority of ['LOW', 'MEDIUM', 'HIGH', 'URGENT']) {
      expect(create({ priority }).success).toBe(true);
    }
    expect(create({ priority: 'CRITICAL' }).success).toBe(false);
    expect(create({ priority: 'medium' }).success).toBe(false);
  });
});

describe('times', () => {
  it('accepts valid "HH:mm" incl. 00:00 and 23:59, rejects 24:00 and malformed', () => {
    expect(create({ startTime: '00:00', endTime: '23:59' }).success).toBe(true);
    expect(create({ startTime: '24:00' }).success).toBe(false);
    expect(create({ startTime: '9:30' }).success).toBe(false); // not zero-padded
    expect(create({ startTime: '09:60' }).success).toBe(false);
    expect(create({ startTime: '0930' }).success).toBe(false);
  });

  it('requires startTime < endTime when both present', () => {
    expect(create({ startTime: '09:00', endTime: '10:00' }).success).toBe(true);
    const equal = create({ startTime: '09:00', endTime: '09:00' });
    expect(equal.success).toBe(false);
    expect(pathsOf(equal)).toContain('endTime');
    expect(create({ startTime: '10:00', endTime: '09:00' }).success).toBe(false);
  });

  it('allows either time alone (no cross-check possible)', () => {
    expect(create({ startTime: '09:00' }).success).toBe(true);
    expect(create({ endTime: '09:00' }).success).toBe(true);
  });
});

describe('durationMinutes', () => {
  it('accepts positive ints, rejects zero/negative/fractional', () => {
    expect(create({ durationMinutes: 1 }).success).toBe(true);
    expect(create({ durationMinutes: 0 }).success).toBe(false);
    expect(create({ durationMinutes: -30 }).success).toBe(false);
    expect(create({ durationMinutes: 25.5 }).success).toBe(false);
  });
});

describe('dates', () => {
  it('requires startDate in create', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { startDate: _unused, ...withoutStart } = base;
    expect(taskCreateSchema.safeParse(withoutStart).success).toBe(false);
  });

  it('rejects malformed and impossible dates', () => {
    expect(create({ startDate: '01-07-2026' }).success).toBe(false);
    expect(create({ startDate: '2026-7-1' }).success).toBe(false);
    expect(create({ startDate: '2026-02-31' }).success).toBe(false);
    expect(create({ startDate: '2025-02-29' }).success).toBe(false); // non-leap
    expect(create({ startDate: '2024-02-29' }).success).toBe(true); // leap
  });

  it('requires endDate ≥ startDate; equal is allowed', () => {
    expect(create({ endDate: '2026-07-01' }).success).toBe(true); // equal
    expect(create({ endDate: '2026-08-01' }).success).toBe(true);
    const backwards = create({ endDate: '2026-06-30' });
    expect(backwards.success).toBe(false);
    expect(pathsOf(backwards)).toContain('endDate');
  });
});

describe('recurrence consistency (create)', () => {
  it('NONE/DAILY reject any recurrence detail fields', () => {
    for (const recurrenceType of ['NONE', 'DAILY']) {
      expect(create({ recurrenceType }).success).toBe(true);
      expect(create({ recurrenceType, recurrenceDays: [1] }).success).toBe(false);
      expect(create({ recurrenceType, recurrenceDayOfMonth: 15 }).success).toBe(false);
      // empty array / explicit null are the "absent" forms — fine
      expect(create({ recurrenceType, recurrenceDays: [] }).success).toBe(true);
      expect(create({ recurrenceType, recurrenceDayOfMonth: null }).success).toBe(true);
    }
  });

  it('WEEKLY requires non-empty unique days 0-6 and no dayOfMonth', () => {
    expect(create({ recurrenceType: 'WEEKLY', recurrenceDays: [0] }).success).toBe(true);
    expect(create({ recurrenceType: 'WEEKLY', recurrenceDays: [6] }).success).toBe(true);
    expect(
      create({ recurrenceType: 'WEEKLY', recurrenceDays: [0, 1, 2, 3, 4, 5, 6] }).success,
    ).toBe(true);

    const missing = create({ recurrenceType: 'WEEKLY' });
    expect(missing.success).toBe(false);
    expect(pathsOf(missing)).toContain('recurrenceDays');
    expect(create({ recurrenceType: 'WEEKLY', recurrenceDays: [] }).success).toBe(false);
    expect(create({ recurrenceType: 'WEEKLY', recurrenceDays: [7] }).success).toBe(false);
    expect(create({ recurrenceType: 'WEEKLY', recurrenceDays: [-1] }).success).toBe(false);
    expect(create({ recurrenceType: 'WEEKLY', recurrenceDays: [1, 1] }).success).toBe(false);
    expect(
      create({ recurrenceType: 'WEEKLY', recurrenceDays: [1], recurrenceDayOfMonth: 5 }).success,
    ).toBe(false);
  });

  it('MONTHLY requires dayOfMonth 1-31 and no days array', () => {
    expect(create({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 1 }).success).toBe(true);
    expect(create({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 31 }).success).toBe(true);

    const missing = create({ recurrenceType: 'MONTHLY' });
    expect(missing.success).toBe(false);
    expect(pathsOf(missing)).toContain('recurrenceDayOfMonth');
    expect(create({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: null }).success).toBe(false);
    expect(create({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 0 }).success).toBe(false);
    expect(create({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 32 }).success).toBe(false);
    expect(create({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 2.5 }).success).toBe(false);
    expect(
      create({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 5, recurrenceDays: [1] }).success,
    ).toBe(false);
  });

  it('rejects unknown recurrence types', () => {
    expect(create({ recurrenceType: 'YEARLY' }).success).toBe(false);
  });
});

describe('taskUpdateSchema', () => {
  it('accepts single-field partials', () => {
    expect(update({ title: 'New title' }).success).toBe(true);
    expect(update({ priority: 'HIGH' }).success).toBe(true);
    expect(update({ color: '#ABCDEF' }).data?.color).toBe('#abcdef');
  });

  it('rejects an empty payload', () => {
    expect(update({}).success).toBe(false);
  });

  it('rejects recurrence detail changes without recurrenceType', () => {
    const days = update({ recurrenceDays: [1, 3] });
    expect(days.success).toBe(false);
    expect(pathsOf(days)).toContain('recurrenceType');

    const dom = update({ recurrenceDayOfMonth: 15 });
    expect(dom.success).toBe(false);
    expect(pathsOf(dom)).toContain('recurrenceType');
  });

  it('applies full consistency rules when recurrenceType is present', () => {
    expect(update({ recurrenceType: 'WEEKLY', recurrenceDays: [1, 3] }).success).toBe(true);
    expect(update({ recurrenceType: 'WEEKLY' }).success).toBe(false); // days required
    expect(update({ recurrenceType: 'MONTHLY', recurrenceDayOfMonth: 31 }).success).toBe(true);
    expect(update({ recurrenceType: 'MONTHLY' }).success).toBe(false);
    expect(update({ recurrenceType: 'NONE' }).success).toBe(true);
    expect(update({ recurrenceType: 'NONE', recurrenceDays: [1] }).success).toBe(false);
    expect(update({ recurrenceType: 'DAILY', recurrenceDayOfMonth: 3 }).success).toBe(false);
  });

  it('applies time/date range rules only when both ends are present', () => {
    expect(update({ startTime: '10:00' }).success).toBe(true); // stored endTime unknown here
    expect(update({ startTime: '10:00', endTime: '09:00' }).success).toBe(false);
    expect(update({ startTime: '10:00', endTime: '11:00' }).success).toBe(true);
    expect(update({ endDate: '2026-01-01' }).success).toBe(true);
    expect(update({ startDate: '2026-02-01', endDate: '2026-01-31' }).success).toBe(false);
    expect(update({ startDate: '2026-02-01', endDate: '2026-02-01' }).success).toBe(true);
  });

  it('strips unknown keys (source/attachments are not client-writable)', () => {
    const result = update({ title: 'ok', source: 'AI', attachments: [{ url: 'x' }] });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: 'ok' });
  });
});
