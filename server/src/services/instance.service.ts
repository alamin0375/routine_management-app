import type { PrismaClient, TaskInstance } from '../generated/prisma/client.js';
import type { TaskInstanceSetStatusRequest } from '@routine-app/shared';
import { occursOn, toCalendarDate } from '../lib/recurrence.js';
import { notFoundError, taskNotScheduledError } from './errors.js';

// "YYYY-MM-DD" → UTC-midnight Date (same convention as task.service.ts).
const toDbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

export class InstanceService {
  constructor(private readonly prisma: PrismaClient) {}

  // Upsert a TaskInstance for (taskId, date). The task must belong to the
  // user and occursOn the date; otherwise 404 or 409 TASK_NOT_SCHEDULED.
  async setStatus(
    userId: string,
    taskId: string,
    dateStr: string,
    body: TaskInstanceSetStatusRequest,
  ): Promise<TaskInstance> {
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task || task.userId !== userId) throw notFoundError('Task');

    const calDate = toCalendarDate(dateStr);
    if (
      !occursOn(
        {
          recurrenceType: task.recurrenceType,
          recurrenceDays: task.recurrenceDays,
          recurrenceDayOfMonth: task.recurrenceDayOfMonth,
          startDate: task.startDate,
          endDate: task.endDate,
        },
        calDate,
      )
    ) {
      throw taskNotScheduledError();
    }

    const dbDate = toDbDate(dateStr);
    return this.prisma.taskInstance.upsert({
      where: { taskId_date: { taskId, date: dbDate } },
      create: { taskId, userId, date: dbDate, status: body.status },
      update: { status: body.status },
    });
  }

  // Calendar: fetch non-archived tasks + all instances in [from, to], compute
  // occurrences in-memory, return only days with at least one occurrence.
  async calendar(
    userId: string,
    fromStr: string,
    toStr: string,
  ): Promise<
    {
      date: string;
      tasks: {
        taskId: string;
        title: string;
        color: string | null;
        categoryId: string | null;
        startTime: string | null;
        instanceStatus: string;
      }[];
    }[]
  > {
    const fromDb = toDbDate(fromStr);
    const toDb = toDbDate(toStr);

    const [tasks, instances] = await Promise.all([
      this.prisma.task.findMany({
        where: { userId, isArchived: false },
        include: { category: { select: { color: true } } },
      }),
      this.prisma.taskInstance.findMany({
        where: { userId, date: { gte: fromDb, lte: toDb } },
      }),
    ]);

    // Build a map: "taskId:YYYY-MM-DD" → status
    const instanceMap = new Map(
      instances.map((i) => [
        `${i.taskId}:${i.date.toISOString().slice(0, 10)}`,
        i.status,
      ]),
    );

    // Enumerate every day in the range.
    const days: Map<
      string,
      { taskId: string; title: string; color: string | null; categoryId: string | null; startTime: string | null; instanceStatus: string }[]
    > = new Map();

    const cursor = new Date(fromDb);
    while (cursor <= toDb) {
      const dateStr = cursor.toISOString().slice(0, 10);
      const calDate = toCalendarDate(dateStr);

      for (const task of tasks) {
        if (
          occursOn(
            {
              recurrenceType: task.recurrenceType,
              recurrenceDays: task.recurrenceDays,
              recurrenceDayOfMonth: task.recurrenceDayOfMonth,
              startDate: task.startDate,
              endDate: task.endDate,
            },
            calDate,
          )
        ) {
          if (!days.has(dateStr)) days.set(dateStr, []);
          days.get(dateStr)!.push({
            taskId: task.id,
            title: task.title,
            color: task.color ?? task.category?.color ?? null,
            categoryId: task.categoryId,
            startTime: task.startTime,
            instanceStatus: instanceMap.get(`${task.id}:${dateStr}`) ?? 'PENDING',
          });
        }
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    return Array.from(days.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, tasks]) => ({ date, tasks }));
  }
}
