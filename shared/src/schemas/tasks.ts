import { z } from 'zod';
import { hexColorSchema } from './categories.js';

// Contracts for the task template endpoints (Task System step 4). These
// schemas are the write-side gatekeeper for recurrence consistency: the
// occursOn engine treats empty recurrenceDays / null recurrenceDayOfMonth
// defensively (they match nothing), but validation here makes those states
// unstorable in the first place.
//
// Deliberately absent: `attachments` (reserved column, own flow later) and
// `source` (set server-side, MANUAL for API writes). Unknown keys are
// stripped by Zod, so clients sending them has no effect.

export const priorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export type Priority = z.infer<typeof priorityEnum>;

export const recurrenceTypeEnum = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']);
export type RecurrenceType = z.infer<typeof recurrenceTypeEnum>;

// "HH:mm", 24-hour, zero-padded — matches the wall-clock storage convention.
// Zero-padding makes plain string comparison correct for ordering.
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be "HH:mm" (24-hour, e.g. "09:30").');

// "YYYY-MM-DD" that is also a real calendar date (rejects 2026-02-31).
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be "YYYY-MM-DD".')
  .refine(
    (value) => {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year!, month! - 1, day));
      return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month! - 1 &&
        date.getUTCDate() === day
      );
    },
    { message: 'Not a real calendar date.' },
  );

const recurrenceDaysSchema = z
  .array(
    z
      .number()
      .int()
      .min(0, 'Weekdays are 0 (Sun) through 6 (Sat).')
      .max(6, 'Weekdays are 0 (Sun) through 6 (Sat).'),
  )
  .refine((days) => new Set(days).size === days.length, {
    message: 'Weekdays must not repeat.',
  });

const recurrenceDayOfMonthSchema = z
  .number()
  .int()
  .min(1, 'Day of month is 1-31.')
  .max(31, 'Day of month is 1-31.');

const taskBaseShape = {
  title: z
    .string()
    .trim()
    .min(1, 'Title is required.')
    .max(200, 'Title must be at most 200 characters.'),
  notes: z.string().max(5000, 'Notes must be at most 5000 characters.').optional(),
  routineId: z.string().uuid().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  color: hexColorSchema.optional(),
  priority: priorityEnum.optional(),
  startTime: timeSchema.optional(),
  endTime: timeSchema.optional(),
  durationMinutes: z
    .number()
    .int()
    .positive('Duration must be a positive number of minutes.')
    .optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema.optional(),
  recurrenceType: recurrenceTypeEnum,
  recurrenceDays: recurrenceDaysSchema.optional(),
  recurrenceDayOfMonth: recurrenceDayOfMonthSchema.nullable().optional(),
  isArchived: z.boolean().optional(),
};

interface RecurrenceSlice {
  recurrenceType: RecurrenceType;
  recurrenceDays?: number[] | undefined;
  recurrenceDayOfMonth?: number | null | undefined;
}

// Presence/absence consistency between recurrenceType and its detail fields.
// Range/uniqueness violations are field-level (above) and short-circuit
// before this runs.
function checkRecurrenceConsistency(data: RecurrenceSlice, ctx: z.RefinementCtx): void {
  const days = data.recurrenceDays ?? [];
  const dayOfMonth = data.recurrenceDayOfMonth ?? null;

  if (data.recurrenceType === 'WEEKLY') {
    if (days.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceDays'],
        message: 'WEEKLY tasks need at least one weekday.',
      });
    }
  } else if (days.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recurrenceDays'],
      message: 'recurrenceDays only applies to WEEKLY tasks.',
    });
  }

  if (data.recurrenceType === 'MONTHLY') {
    if (dayOfMonth === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['recurrenceDayOfMonth'],
        message: 'MONTHLY tasks need a day of month.',
      });
    }
  } else if (dayOfMonth !== null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['recurrenceDayOfMonth'],
      message: 'recurrenceDayOfMonth only applies to MONTHLY tasks.',
    });
  }
}

interface RangeSlice {
  startTime?: string | undefined;
  endTime?: string | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
}

// Zero-padded "HH:mm" and "YYYY-MM-DD" order correctly as plain strings.
function checkRanges(data: RangeSlice, ctx: z.RefinementCtx): void {
  if (data.startTime !== undefined && data.endTime !== undefined && data.startTime >= data.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'endTime must be after startTime.',
    });
  }
  if (data.startDate !== undefined && data.endDate !== undefined && data.endDate < data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'endDate must be on or after startDate.',
    });
  }
}

export const taskInstanceSetStatusSchema = z.object({
  // COMPLETED and RESCHEDULED arrive in Phase 4; rejecting them here is a
  // plain VALIDATION_ERROR so the client gets a field-level message.
  status: z.enum(['PENDING', 'SKIPPED'], {
    errorMap: () => ({
      message: 'status must be "PENDING" or "SKIPPED" (COMPLETED and RESCHEDULED arrive in Phase 4).',
    }),
  }),
});
export type TaskInstanceSetStatusRequest = z.infer<typeof taskInstanceSetStatusSchema>;

export const taskCreateSchema = z.object(taskBaseShape).superRefine((data, ctx) => {
  checkRecurrenceConsistency(data, ctx);
  checkRanges(data, ctx);
});
export type TaskCreateRequest = z.infer<typeof taskCreateSchema>;

// Partial update. If ANY recurrence-related field appears, recurrenceType
// must appear too — the consistency rules are meaningless against a partial
// picture, so we refuse to guess the stored type.
export const taskUpdateSchema = z
  .object(taskBaseShape)
  .partial()
  .superRefine((data, ctx) => {
    if (Object.keys(data).length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update.',
      });
      return;
    }

    const touchesRecurrence =
      data.recurrenceType !== undefined ||
      data.recurrenceDays !== undefined ||
      data.recurrenceDayOfMonth !== undefined;
    if (touchesRecurrence) {
      if (data.recurrenceType === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['recurrenceType'],
          message: 'Include recurrenceType when changing any recurrence field.',
        });
      } else {
        checkRecurrenceConsistency({ ...data, recurrenceType: data.recurrenceType }, ctx);
      }
    }

    checkRanges(data, ctx);
  });
export type TaskUpdateRequest = z.infer<typeof taskUpdateSchema>;
