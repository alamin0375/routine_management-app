import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  categoryCreateSchema,
  categoryListResponseSchema,
  categoryUpdateSchema,
  taskCategorySchema,
  type CategoryListResponse,
  type TaskCategory as TaskCategoryDto,
} from '@routine-app/shared';
import type { TaskCategory } from '../generated/prisma/client.js';
import { requireAuth } from '../middleware/require-auth.js';
import { idParamOf } from '../lib/route-params.js';
import { notFoundError } from '../services/errors.js';

// /api/v1/task-categories — thin routes: parse with shared schemas →
// CategoryService → respond. All protected; ownership misses are 404s.

export function toCategoryDto(category: TaskCategory): TaskCategoryDto {
  return {
    id: category.id,
    name: category.name,
    color: category.color,
    icon: category.icon,
    sortOrder: category.sortOrder,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

// ?reassignTo= shares the malformed-id-as-404 convention: a junk target id
// behaves like a missing one.
const deleteQuerySchema = z.object({ reassignTo: z.string().uuid().optional() });

export async function categoryRoutes(app: FastifyInstance) {
  app.get(
    '/task-categories',
    { preHandler: requireAuth },
    async (request): Promise<CategoryListResponse> => {
      const categories = await app.categoryService.list(request.userId);
      return categoryListResponseSchema.parse({ categories: categories.map(toCategoryDto) });
    },
  );

  app.post(
    '/task-categories',
    { preHandler: requireAuth },
    async (request, reply): Promise<TaskCategoryDto> => {
      const body = categoryCreateSchema.parse(request.body);
      const category = await app.categoryService.create(request.userId, body.name, body.color);
      reply.status(201);
      return taskCategorySchema.parse(toCategoryDto(category));
    },
  );

  app.patch(
    '/task-categories/:id',
    { preHandler: requireAuth },
    async (request): Promise<TaskCategoryDto> => {
      const body = categoryUpdateSchema.parse(request.body);
      const category = await app.categoryService.update(
        request.userId,
        idParamOf(request, 'Category'),
        body,
      );
      return taskCategorySchema.parse(toCategoryDto(category));
    },
  );

  app.delete(
    '/task-categories/:id',
    { preHandler: requireAuth },
    async (request): Promise<{ ok: true }> => {
      const query = deleteQuerySchema.safeParse(request.query);
      if (!query.success) throw notFoundError('Category');
      await app.categoryService.delete(
        request.userId,
        idParamOf(request, 'Category'),
        query.data.reassignTo,
      );
      return { ok: true };
    },
  );
}
