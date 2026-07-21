import type { PrismaClient, Routine } from '../generated/prisma/client.js';
import type { UpdateRoutineRequest } from '@routine-app/shared';
import { notFoundError } from './errors.js';

// Routine business logic (Phase 2-lite). Every method takes the caller's
// userId and scopes the query to it — an id owned by someone else behaves
// exactly like a missing id (404).
export class RoutineService {
  constructor(private readonly prisma: PrismaClient) {}

  list(userId: string): Promise<Routine[]> {
    return this.prisma.routine.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'asc' }],
    });
  }

  create(userId: string, name: string): Promise<Routine> {
    return this.prisma.routine.create({ data: { userId, name } });
  }

  async get(userId: string, id: string): Promise<Routine> {
    const routine = await this.prisma.routine.findUnique({ where: { id } });
    if (!routine || routine.userId !== userId) throw notFoundError('Routine');
    return routine;
  }

  async update(userId: string, id: string, body: UpdateRoutineRequest): Promise<Routine> {
    await this.get(userId, id); // ownership check (404 on miss)
    const { archived, ...rest } = body;
    return this.prisma.routine.update({
      where: { id },
      data: {
        ...rest,
        ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
      },
    });
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.get(userId, id); // ownership check (404 on miss)
    await this.prisma.routine.delete({ where: { id } });
  }
}
