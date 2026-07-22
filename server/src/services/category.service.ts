import { Prisma, type PrismaClient, type TaskCategory } from '../generated/prisma/client.js';
import type { CategoryUpdateRequest } from '@routine-app/shared';
import { ensureDefaultCategories } from '../lib/default-categories.js';
import {
  badRequestError,
  categoryNotEmptyError,
  duplicateCategoryError,
  notFoundError,
} from './errors.js';

// TaskCategory business logic (Task System step 3). Ownership follows the
// routine pattern: queries scoped to userId, misses are 404s.

const isUniqueViolation = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';

export class CategoryService {
  constructor(private readonly prisma: PrismaClient) {}

  // List, re-seeding the 4 defaults ONLY for a user with zero categories
  // (fresh pre-seeding account, or one who deleted everything). A deleted
  // default must NOT resurrect while other categories exist.
  async list(userId: string): Promise<TaskCategory[]> {
    const existing = await this.prisma.taskCategory.count({ where: { userId } });
    if (existing === 0) await ensureDefaultCategories(this.prisma, userId);
    return this.prisma.taskCategory.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(userId: string, name: string, color: string): Promise<TaskCategory> {
    const max = await this.prisma.taskCategory.aggregate({
      where: { userId },
      _max: { sortOrder: true },
    });
    try {
      return await this.prisma.taskCategory.create({
        data: {
          userId,
          name,
          color,
          sortOrder: max._max.sortOrder === null ? 0 : max._max.sortOrder + 1,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateCategoryError();
      throw error;
    }
  }

  async get(userId: string, id: string): Promise<TaskCategory> {
    const category = await this.prisma.taskCategory.findUnique({ where: { id } });
    if (!category || category.userId !== userId) throw notFoundError('Category');
    return category;
  }

  async update(userId: string, id: string, body: CategoryUpdateRequest): Promise<TaskCategory> {
    await this.get(userId, id); // ownership check (404 on miss)
    try {
      return await this.prisma.taskCategory.update({ where: { id }, data: body });
    } catch (error) {
      if (isUniqueViolation(error)) throw duplicateCategoryError();
      throw error;
    }
  }

  // The DB relation is SetNull, so "empty or reassign" is an application
  // rule. Archived tasks count and reassign like any other.
  async delete(userId: string, id: string, reassignTo?: string): Promise<void> {
    await this.get(userId, id); // ownership check (404 on miss)

    if (reassignTo === undefined) {
      const taskCount = await this.prisma.task.count({ where: { categoryId: id } });
      if (taskCount > 0) throw categoryNotEmptyError(taskCount);
      await this.prisma.taskCategory.delete({ where: { id } });
      return;
    }

    if (reassignTo === id) {
      throw badRequestError(
        'REASSIGN_TO_SELF',
        'reassignTo must be a different category than the one being deleted.',
      );
    }
    await this.get(userId, reassignTo); // target ownership check (404 on miss)

    // Move tasks and delete atomically; the count re-check happens implicitly
    // because updateMany inside the transaction sees a consistent snapshot.
    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { categoryId: id }, // includes archived tasks
        data: { categoryId: reassignTo },
      });
      await tx.taskCategory.delete({ where: { id } });
    });
  }
}
