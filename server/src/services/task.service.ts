import type { Prisma, PrismaClient, Task } from '../generated/prisma/client.js';
import type { TaskCreateRequest, TaskUpdateRequest } from '@routine-app/shared';
import { occursOn, toCalendarDate } from '../lib/recurrence.js';
import { notFoundError, planLimitError } from './errors.js';

// Task business logic (Task System step 5). All queries scoped to userId;
// ownership misses are 404s. Source is always MANUAL for API writes.

const ACTIVE_TASK_LIMIT = 50;

// "YYYY-MM-DD" → UTC-midnight Date (the @db.Date storage convention used
// throughout this codebase — see recurrence.ts for the rationale).
const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

// Derive the user's local calendar date as "YYYY-MM-DD" using the IANA
// timezone. en-CA locale formats as ISO date, so no parsing needed.
export const localDateFor = (timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date());

type TaskWithCategory = Task & {
  category: { id: string; name: string; color: string } | null;
};

const taskInclude = {
  category: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TaskInclude;

export class TaskService {
  constructor(private readonly prisma: PrismaClient) {}

  // Verify a categoryId or routineId belongs to the user; throw 404 if not.
  private async assertOwns(
    userId: string,
    type: 'category' | 'routine',
    id: string,
  ): Promise<void> {
    if (type === 'category') {
      const row = await this.prisma.taskCategory.findUnique({ where: { id } });
      if (!row || row.userId !== userId) throw notFoundError('Category');
    } else {
      const row = await this.prisma.routine.findUnique({ where: { id } });
      if (!row || row.userId !== userId) throw notFoundError('Routine');
    }
  }

  private async assertPlanLimit(userId: string, extra = 1): Promise<void> {
    const current = await this.prisma.task.count({
      where: { userId, isArchived: false },
    });
    if (current + extra > ACTIVE_TASK_LIMIT) throw planLimitError(ACTIVE_TASK_LIMIT, current);
  }

  async create(userId: string, body: TaskCreateRequest): Promise<TaskWithCategory> {
    if (body.categoryId) await this.assertOwns(userId, 'category', body.categoryId);
    if (body.routineId) await this.assertOwns(userId, 'routine', body.routineId);
    await this.assertPlanLimit(userId);

    const { startDate, endDate, recurrenceDays, ...rest } = body;
    return this.prisma.task.create({
      data: {
        ...rest,
        userId,
        source: 'MANUAL',
        startDate: toDbDate(startDate),
        endDate: endDate ? toDbDate(endDate) : null,
        recurrenceDays: recurrenceDays ?? [],
      },
      include: taskInclude,
    });
  }

  list(
    userId: string,
    filters: { isArchived?: boolean; categoryId?: string },
  ): Promise<TaskWithCategory[]> {
    return this.prisma.task.findMany({
      where: {
        userId,
        isArchived: filters.isArchived ?? false,
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      },
      // Untimed tasks (null startTime) sort last, then alphabetically.
      orderBy: [{ startTime: { sort: 'asc', nulls: 'last' } }, { title: 'asc' }],
      include: taskInclude,
    });
  }

  async get(userId: string, id: string): Promise<TaskWithCategory> {
    const task = await this.prisma.task.findUnique({ where: { id }, include: taskInclude });
    if (!task || task.userId !== userId) throw notFoundError('Task');
    return task;
  }

  async update(
    userId: string,
    id: string,
    body: TaskUpdateRequest,
    userTimezone: string,
  ): Promise<TaskWithCategory> {
    const existing = await this.get(userId, id);

    if (body.categoryId !== undefined && body.categoryId !== null) {
      await this.assertOwns(userId, 'category', body.categoryId);
    }
    if (body.routineId !== undefined && body.routineId !== null) {
      await this.assertOwns(userId, 'routine', body.routineId);
    }

    // Unarchiving: check the limit (the task itself is already counted as
    // archived, so we're adding 1 active task).
    if (body.isArchived === false && existing.isArchived) {
      await this.assertPlanLimit(userId, 1);
    }

    const { startDate, endDate, recurrenceDays, ...rest } = body;

    const data: Prisma.TaskUpdateInput = {
      ...rest,
      ...(startDate !== undefined ? { startDate: toDbDate(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? toDbDate(endDate) : null } : {}),
      ...(recurrenceDays !== undefined ? { recurrenceDays } : {}),
    };

    // Recurrence change: delete PENDING instances with date STRICTLY AFTER
    // the user's local today (today's instance survives).
    if (body.recurrenceType !== undefined) {
      const todayStr = localDateFor(userTimezone);
      const todayDb = toDbDate(todayStr);
      return this.prisma.$transaction(async (tx) => {
        await tx.taskInstance.deleteMany({
          where: { taskId: id, status: 'PENDING', date: { gt: todayDb } },
        });
        return tx.task.update({ where: { id }, data, include: taskInclude });
      });
    }

    return this.prisma.task.update({ where: { id }, data, include: taskInclude });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.get(userId, id); // ownership check
    await this.prisma.task.delete({ where: { id } });
  }

  async today(
    userId: string,
    userTimezone: string,
    dateStr?: string,
  ): Promise<{
    date: string;
    tasks: {
      task: TaskWithCategory;
      instanceStatus: string;
      instanceId: string | null;
    }[];
  }> {
    const resolvedDate = dateStr ?? localDateFor(userTimezone);
    const calDate = toCalendarDate(resolvedDate);
    const dbDate = toDbDate(resolvedDate);

    const [allTasks, instances] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, isArchived: false },
        include: taskInclude,
      }),
      this.prisma.taskInstance.findMany({
        where: { userId, date: dbDate },
      }),
    ]);

    const instanceMap = new Map(instances.map((i) => [i.taskId, i]));

    const occurring = allTasks.filter((t) =>
      occursOn(
        {
          recurrenceType: t.recurrenceType,
          recurrenceDays: t.recurrenceDays,
          recurrenceDayOfMonth: t.recurrenceDayOfMonth,
          startDate: t.startDate,
          endDate: t.endDate,
        },
        calDate,
      ),
    );

    occurring.sort((a, b) => {
      if (a.startTime === null && b.startTime === null) return a.title.localeCompare(b.title);
      if (a.startTime === null) return 1;
      if (b.startTime === null) return -1;
      return a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0;
    });

    return {
      date: resolvedDate,
      tasks: occurring.map((task) => {
        const instance = instanceMap.get(task.id);
        return {
          task,
          instanceStatus: instance?.status ?? 'PENDING',
          instanceId: instance?.id ?? null,
        };
      }),
    };
  }
}
