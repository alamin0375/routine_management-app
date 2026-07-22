// Recurrence engine — the single source of truth for "does task T occur on
// date D?" (TASK_SYSTEM_SPEC.md §3). The today endpoint, calendar endpoint,
// and the future AI scheduler must all route through occursOn; nothing else
// may reimplement this logic.
//
// All math operates on local CALENDAR DATES (y/m/d triples), never UTC
// instants — a task's dates are wall-clock concepts in the user's timezone,
// and converting through Date epoch milliseconds invites DST bugs. Prisma
// returns @db.Date columns as Date objects pinned to UTC midnight, so
// calendar components are read with the getUTC* family.

import type { RecurrenceType } from '../generated/prisma/enums.js';

// The recurrence-relevant slice of a Task. Structural (not the Prisma type)
// so unit tests and the AI scheduler can pass plain objects.
export interface RecurrenceFields {
  recurrenceType: RecurrenceType;
  recurrenceDays: number[]; // weekdays 0=Sun..6=Sat, for WEEKLY
  recurrenceDayOfMonth: number | null; // 1-31, for MONTHLY
  startDate: Date; // @db.Date (UTC-midnight Date)
  endDate: Date | null; // inclusive; null = forever
}

export interface CalendarDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

// "YYYY-MM-DD" (already timezone-resolved) or a @db.Date value → CalendarDate.
export function toCalendarDate(value: Date | string): CalendarDate {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) throw new Error(`Not a calendar date: "${value}"`);
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  }
  return { year: value.getUTCFullYear(), month: value.getUTCMonth() + 1, day: value.getUTCDate() };
}

const asNumber = (d: CalendarDate): number => d.year * 10_000 + d.month * 100 + d.day;

export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month = last day of this month. Fixed at UTC so the
  // host machine's timezone can never shift the result.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 0=Sun..6=Sat, via Zeller-free UTC construction (calendar-only input).
export function weekdayOf(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

// Does the task occur on the given local calendar date?
// - Dates before startDate never match; endDate is INCLUSIVE; null endDate
//   means forever.
// - NONE   → only the startDate itself.
// - DAILY  → every date in range.
// - WEEKLY → date's weekday ∈ recurrenceDays (empty array matches nothing).
// - MONTHLY→ day-of-month equals recurrenceDayOfMonth, CLAMPED to the last
//   day of shorter months (dayOfMonth 31 matches Apr 30 and Feb 28/29).
export function occursOn(task: RecurrenceFields, date: CalendarDate): boolean {
  const target = asNumber(date);
  const start = asNumber(toCalendarDate(task.startDate));
  if (target < start) return false;
  if (task.endDate !== null && target > asNumber(toCalendarDate(task.endDate))) return false;

  switch (task.recurrenceType) {
    case 'NONE':
      return target === start;
    case 'DAILY':
      return true;
    case 'WEEKLY':
      return task.recurrenceDays.includes(weekdayOf(date));
    case 'MONTHLY': {
      if (task.recurrenceDayOfMonth === null) return false;
      const effectiveDay = Math.min(task.recurrenceDayOfMonth, daysInMonth(date.year, date.month));
      return date.day === effectiveDay;
    }
  }
}
