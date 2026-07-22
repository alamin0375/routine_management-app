import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  isoDateSchema,
  taskCreateSchema,
  taskInstanceSetStatusSchema,
  taskUpdateSchema,
  type TaskCreateRequest,
  type TaskUpdateRequest,
} from '@routine-app/shared';
import type { Task } from '../generated/prisma/client.js';
import { requireAuth } from '../middleware/require-auth.js';
import { idParamOf } from '../lib/route-params.js';
import { AppError, badRequestError, notFoundError } from '../services/errors.js';

// /api/v1/tasks — thin routes following the established pattern.
// All protected; ownership misses are 404s.

type TaskWithCategory = Task & {
  category: { id: string; name: string; color: string } | null;
};

function toTaskDto(task: TaskWithCategory) {
  return {
    id: task.id,
    userId: task.userId,
    routineId: task.routineId,
    title: task.title,
    notes: task.notes,
    categoryId: task.categoryId,
    category: task.category,
    color: task.color,
    priority: task.priority,
    startTime: task.startTime,
    endTime: task.endTime,
    durationMinutes: task.durationMinutes,
    recurrenceType: task.recurrenceType,
    recurrenceDays: task.recurrenceDays,
    recurrenceDayOfMonth: task.recurrenceDayOfMonth,
    startDate: task.startDate.toISOString().slice(0, 10),
    endDate: task.endDate ? task.endDate.toISOString().slice(0, 10) : null,
    sortOrder: task.sortOrder,
    isArchived: task.isArchived,
    source: task.source,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

const listQuerySchema = z.object({
  isArchived: z
    .string()
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  categoryId: z.string().uuid().optional(),
});

const todayQuerySchema = z.object({
  date: z.string().optional(),
});

const CALENDAR_MAX_DAYS = 62;

const calendarQuerySchema = z.object({
  from: z.string(),
  to: z.string(),
});

export async function taskRoutes(app: FastifyInstance) {
  // ROUTE ORDER MATTERS: /tasks/today and /tasks/calendar MUST stay registered
  // before /tasks/:id, or Fastify's router matches them as an :id param.
  app.post('/tasks', { preHandler: requireAuth }, async (request, reply) => {
    const body = taskCreateSchema.parse(request.body) as TaskCreateRequest;
    const task = await app.taskService.create(request.userId, body);
    reply.status(201);
    return toTaskDto(task);
  });

  app.get('/tasks/today', { preHandler: requireAuth }, async (request) => {
    const query = todayQuerySchema.safeParse(request.query);
    if (!query.success) throw notFoundError('Date');
    const dateStr = query.data.date;
    if (dateStr !== undefined) {
      const parsed = isoDateSchema.safeParse(dateStr);
      if (!parsed.success) {
        const { ZodError } = await import('zod');
        throw new ZodError(parsed.error.issues);
      }
    }
    const user = await app.prisma.user.findUnique({ where: { id: request.userId } });
    if (!user) throw notFoundError('User');
    const result = await app.taskService.today(request.userId, user.timezone, dateStr);
    return {
      date: result.date,
      tasks: result.tasks.map(({ task, instanceStatus, instanceId }) => ({
        ...toTaskDto(task),
        instanceStatus,
        instanceId,
      })),
    };
  });

  app.get('/tasks', { preHandler: requireAuth }, async (request) => {
    const query = listQuerySchema.safeParse(request.query);
    const filters = query.success ? query.data : {};
    const tasks = await app.taskService.list(request.userId, filters);
    return { tasks: tasks.map(toTaskDto) };
  });

  app.get('/tasks/:id', { preHandler: requireAuth }, async (request) => {
    const task = await app.taskService.get(request.userId, idParamOf(request, 'Task'));
    return toTaskDto(task);
  });

  app.patch('/tasks/:id', { preHandler: requireAuth }, async (request) => {
    const body = taskUpdateSchema.parse(request.body) as TaskUpdateRequest;
    const user = await app.prisma.user.findUnique({ where: { id: request.userId } });
    if (!user) throw notFoundError('User');
    const task = await app.taskService.update(
      request.userId,
      idParamOf(request, 'Task'),
      body,
      user.timezone,
    );
    return toTaskDto(task);
  });

  app.delete('/tasks/:id', { preHandler: requireAuth }, async (request, reply) => {
    await app.taskService.delete(request.userId, idParamOf(request, 'Task'));
    reply.status(204);
  });

  // PUT /tasks/:id/instances/:date — upsert an instance status for one day.
  // :date malformed → 404 (consistent with the malformed-id convention).
  app.put('/tasks/:id/instances/:date', { preHandler: requireAuth }, async (request) => {
    const taskId = idParamOf(request, 'Task');
    const { date } = request.params as { date: string };
    if (!isoDateSchema.safeParse(date).success) throw notFoundError('Instance date');
    const body = taskInstanceSetStatusSchema.parse(request.body);
    const instance = await app.instanceService.setStatus(request.userId, taskId, date, body);
    return {
      id: instance.id,
      taskId: instance.taskId,
      date: instance.date.toISOString().slice(0, 10),
      status: instance.status,
      overrideStartTime: instance.overrideStartTime,
      overrideEndTime: instance.overrideEndTime,
      overrideNotes: instance.overrideNotes,
    };
  });

  app.get('/tasks/calendar', { preHandler: requireAuth }, async (request) => {
    const query = calendarQuerySchema.parse(request.query);
    for (const [field, value] of [
      ['from', query.from],
      ['to', query.to],
    ] as const) {
      if (!isoDateSchema.safeParse(value).success) {
        throw badRequestError('VALIDATION_ERROR', `${field} must be a valid "YYYY-MM-DD" date.`);
      }
    }
    if (query.to < query.from) {
      throw badRequestError('INVALID_RANGE', 'to must be on or after from.');
    }
    // Inclusive day count.
    const fromMs = Date.parse(`${query.from}T00:00:00.000Z`);
    const toMs = Date.parse(`${query.to}T00:00:00.000Z`);
    const dayCount = Math.round((toMs - fromMs) / 86_400_000) + 1;
    if (dayCount > CALENDAR_MAX_DAYS) {
      throw new AppError(
        400,
        'RANGE_TOO_LARGE',
        `Date range must be at most ${CALENDAR_MAX_DAYS} days.`,
        { maxDays: CALENDAR_MAX_DAYS },
      );
    }
    const days = await app.instanceService.calendar(request.userId, query.from, query.to);
    return { days };
  });
}
