import { describe, expect, it } from 'vitest';
import {
  daysInMonth,
  occursOn,
  toCalendarDate,
  weekdayOf,
  type CalendarDate,
  type RecurrenceFields,
} from '../src/lib/recurrence.js';

// Spec of record for recurrence semantics (TASK_SYSTEM_SPEC.md §3).
// Pure unit tests — no database. If a behavior isn't pinned here, it isn't
// guaranteed.

// @db.Date values arrive as UTC-midnight Date objects; build them the same way.
const dbDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const cal = (iso: string): CalendarDate => toCalendarDate(iso);

const task = (over: Partial<RecurrenceFields>): RecurrenceFields => ({
  recurrenceType: 'NONE',
  recurrenceDays: [],
  recurrenceDayOfMonth: null,
  startDate: dbDate('2026-03-10'),
  endDate: null,
  ...over,
});

describe('calendar plumbing', () => {
  it('parses "YYYY-MM-DD" strings and UTC-midnight Dates identically', () => {
    expect(toCalendarDate('2026-03-10')).toEqual({ year: 2026, month: 3, day: 10 });
    expect(toCalendarDate(dbDate('2026-03-10'))).toEqual({ year: 2026, month: 3, day: 10 });
  });

  it('rejects non-date strings', () => {
    expect(() => toCalendarDate('10/03/2026')).toThrow();
    expect(() => toCalendarDate('2026-3-10')).toThrow();
  });

  it('knows month lengths, including leap Februaries', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2024, 2)).toBe(29); // leap
    expect(daysInMonth(2025, 2)).toBe(28); // non-leap
    expect(daysInMonth(2000, 2)).toBe(29); // divisible-by-400 leap
    expect(daysInMonth(1900, 2)).toBe(28); // divisible-by-100 non-leap
  });

  it('computes weekdays with 0=Sun..6=Sat numbering', () => {
    expect(weekdayOf(cal('2026-03-08'))).toBe(0); // Sunday
    expect(weekdayOf(cal('2026-03-09'))).toBe(1); // Monday
    expect(weekdayOf(cal('2026-03-14'))).toBe(6); // Saturday
  });
});

describe('range boundaries (all recurrence types)', () => {
  const daily = task({
    recurrenceType: 'DAILY',
    startDate: dbDate('2026-03-10'),
    endDate: dbDate('2026-03-20'),
  });

  it('never matches before startDate', () => {
    expect(occursOn(daily, cal('2026-03-09'))).toBe(false);
    expect(occursOn(daily, cal('2025-03-15'))).toBe(false); // prior year, in-range day
  });

  it('matches ON startDate', () => {
    expect(occursOn(daily, cal('2026-03-10'))).toBe(true);
  });

  it('matches ON endDate (inclusive)', () => {
    expect(occursOn(daily, cal('2026-03-20'))).toBe(true);
  });

  it('never matches the day after endDate', () => {
    expect(occursOn(daily, cal('2026-03-21'))).toBe(false);
  });

  it('null endDate means forever', () => {
    const forever = task({ recurrenceType: 'DAILY', startDate: dbDate('2026-03-10') });
    expect(occursOn(forever, cal('2030-01-01'))).toBe(true);
    expect(occursOn(forever, cal('2099-12-31'))).toBe(true);
  });
});

describe('NONE', () => {
  const once = task({ startDate: dbDate('2026-03-10'), endDate: null });

  it('matches only the startDate itself', () => {
    expect(occursOn(once, cal('2026-03-10'))).toBe(true);
    expect(occursOn(once, cal('2026-03-11'))).toBe(false);
    expect(occursOn(once, cal('2026-03-09'))).toBe(false);
  });
});

describe('DAILY', () => {
  it('matches every day in range, across a year boundary', () => {
    const overNewYear = task({
      recurrenceType: 'DAILY',
      startDate: dbDate('2025-12-30'),
      endDate: dbDate('2026-01-02'),
    });
    expect(occursOn(overNewYear, cal('2025-12-31'))).toBe(true);
    expect(occursOn(overNewYear, cal('2026-01-01'))).toBe(true);
    expect(occursOn(overNewYear, cal('2026-01-03'))).toBe(false);
  });
});

describe('WEEKLY', () => {
  it('matches a single weekday', () => {
    const mondays = task({
      recurrenceType: 'WEEKLY',
      recurrenceDays: [1],
      startDate: dbDate('2026-03-01'),
    });
    expect(occursOn(mondays, cal('2026-03-09'))).toBe(true); // a Monday
    expect(occursOn(mondays, cal('2026-03-10'))).toBe(false); // a Tuesday
  });

  it('matches multiple weekdays (weekdays-only pattern)', () => {
    const weekdays = task({
      recurrenceType: 'WEEKLY',
      recurrenceDays: [1, 2, 3, 4, 5],
      startDate: dbDate('2026-03-01'),
    });
    expect(occursOn(weekdays, cal('2026-03-13'))).toBe(true); // Friday
    expect(occursOn(weekdays, cal('2026-03-14'))).toBe(false); // Saturday
    expect(occursOn(weekdays, cal('2026-03-15'))).toBe(false); // Sunday
  });

  it('matches all seven weekdays like DAILY', () => {
    const everyDay = task({
      recurrenceType: 'WEEKLY',
      recurrenceDays: [0, 1, 2, 3, 4, 5, 6],
      startDate: dbDate('2026-03-01'),
    });
    for (let day = 8; day <= 14; day++) {
      expect(occursOn(everyDay, cal(`2026-03-${String(day).padStart(2, '0')}`))).toBe(true);
    }
  });

  it('wraps the week Sat→Sun with 0=Sun..6=Sat numbering', () => {
    const weekend = task({
      recurrenceType: 'WEEKLY',
      recurrenceDays: [6, 0], // Saturday and Sunday
      startDate: dbDate('2026-03-01'),
    });
    expect(occursOn(weekend, cal('2026-03-14'))).toBe(true); // Saturday
    expect(occursOn(weekend, cal('2026-03-15'))).toBe(true); // the following Sunday
    expect(occursOn(weekend, cal('2026-03-16'))).toBe(false); // Monday
  });

  it('matches nothing when recurrenceDays is empty', () => {
    const empty = task({
      recurrenceType: 'WEEKLY',
      recurrenceDays: [],
      startDate: dbDate('2026-03-01'),
    });
    for (let day = 8; day <= 14; day++) {
      expect(occursOn(empty, cal(`2026-03-${String(day).padStart(2, '0')}`))).toBe(false);
    }
  });
});

describe('MONTHLY', () => {
  it('matches the exact day-of-month in full-length months', () => {
    const on15th = task({
      recurrenceType: 'MONTHLY',
      recurrenceDayOfMonth: 15,
      startDate: dbDate('2026-01-01'),
    });
    expect(occursOn(on15th, cal('2026-01-15'))).toBe(true);
    expect(occursOn(on15th, cal('2026-02-15'))).toBe(true);
    expect(occursOn(on15th, cal('2026-01-14'))).toBe(false);
    expect(occursOn(on15th, cal('2026-01-16'))).toBe(false);
  });

  const on31st = task({
    recurrenceType: 'MONTHLY',
    recurrenceDayOfMonth: 31,
    startDate: dbDate('2024-01-01'),
  });

  it('clamps 31 to 30-day months (Apr/Jun/Sep/Nov)', () => {
    expect(occursOn(on31st, cal('2026-04-30'))).toBe(true);
    expect(occursOn(on31st, cal('2026-04-29'))).toBe(false);
    expect(occursOn(on31st, cal('2026-06-30'))).toBe(true);
    expect(occursOn(on31st, cal('2026-09-30'))).toBe(true);
    expect(occursOn(on31st, cal('2026-11-30'))).toBe(true);
    // 31-day months still match on the 31st, not the 30th
    expect(occursOn(on31st, cal('2026-03-31'))).toBe(true);
    expect(occursOn(on31st, cal('2026-03-30'))).toBe(false);
  });

  it('clamps 31 to Feb 29 in leap years and Feb 28 otherwise', () => {
    expect(occursOn(on31st, cal('2024-02-29'))).toBe(true); // 2024 leap
    expect(occursOn(on31st, cal('2024-02-28'))).toBe(false); // not the clamped day
    expect(occursOn(on31st, cal('2025-02-28'))).toBe(true); // 2025 non-leap
    expect(occursOn(on31st, cal('2025-02-27'))).toBe(false);
  });

  it('clamps 29 to Feb 28 only in non-leap years', () => {
    const on29th = task({
      recurrenceType: 'MONTHLY',
      recurrenceDayOfMonth: 29,
      startDate: dbDate('2024-01-01'),
    });
    expect(occursOn(on29th, cal('2024-02-29'))).toBe(true); // leap: exact day exists
    expect(occursOn(on29th, cal('2025-02-28'))).toBe(true); // non-leap: clamped
    expect(occursOn(on29th, cal('2024-02-28'))).toBe(false); // leap year has a real 29th
    expect(occursOn(on29th, cal('2026-03-29'))).toBe(true); // normal months unaffected
  });

  it('clamps 30 to Feb but no other month', () => {
    const on30th = task({
      recurrenceType: 'MONTHLY',
      recurrenceDayOfMonth: 30,
      startDate: dbDate('2024-01-01'),
    });
    expect(occursOn(on30th, cal('2025-02-28'))).toBe(true); // clamped
    expect(occursOn(on30th, cal('2024-02-29'))).toBe(true); // leap-year clamp lands on 29
    expect(occursOn(on30th, cal('2026-04-30'))).toBe(true); // exact
    expect(occursOn(on30th, cal('2026-04-29'))).toBe(false);
  });

  it('matches nothing when recurrenceDayOfMonth is null', () => {
    const broken = task({
      recurrenceType: 'MONTHLY',
      recurrenceDayOfMonth: null,
      startDate: dbDate('2026-01-01'),
    });
    expect(occursOn(broken, cal('2026-01-15'))).toBe(false);
    expect(occursOn(broken, cal('2026-01-31'))).toBe(false);
  });

  it('respects range boundaries around occurrence days', () => {
    const bounded = task({
      recurrenceType: 'MONTHLY',
      recurrenceDayOfMonth: 15,
      startDate: dbDate('2026-01-20'), // after January\'s occurrence
      endDate: dbDate('2026-03-14'), // before March\'s occurrence
    });
    expect(occursOn(bounded, cal('2026-01-15'))).toBe(false); // before start
    expect(occursOn(bounded, cal('2026-02-15'))).toBe(true); // only one in range
    expect(occursOn(bounded, cal('2026-03-15'))).toBe(false); // after end
  });
});

describe('year boundaries', () => {
  it('weekly across Dec 31 → Jan 1', () => {
    // Dec 31 2026 is a Thursday (4); Jan 1 2027 is a Friday (5).
    const thuFri = task({
      recurrenceType: 'WEEKLY',
      recurrenceDays: [4, 5],
      startDate: dbDate('2026-12-01'),
    });
    expect(occursOn(thuFri, cal('2026-12-31'))).toBe(true);
    expect(occursOn(thuFri, cal('2027-01-01'))).toBe(true);
    expect(occursOn(thuFri, cal('2027-01-02'))).toBe(false); // Saturday
  });

  it('monthly 31st matches both Dec 31 and Jan 31', () => {
    const on31st = task({
      recurrenceType: 'MONTHLY',
      recurrenceDayOfMonth: 31,
      startDate: dbDate('2026-12-01'),
    });
    expect(occursOn(on31st, cal('2026-12-31'))).toBe(true);
    expect(occursOn(on31st, cal('2027-01-31'))).toBe(true);
    expect(occursOn(on31st, cal('2027-01-01'))).toBe(false);
  });
});
