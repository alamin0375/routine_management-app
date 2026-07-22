import type { FastifyInstance } from 'fastify';
import {
  createRoutineRequestSchema,
  routineListResponseSchema,
  routineSchema,
  updateRoutineRequestSchema,
  type Routine as RoutineDto,
  type RoutineListResponse,
} from '@routine-app/shared';
import type { Routine } from '../generated/prisma/client.js';
import { requireAuth } from '../middleware/require-auth.js';
import { idParamOf } from '../lib/route-params.js';

// /api/v1/routines — thin routes: parse with shared schemas → RoutineService
// → respond. All protected; ownership misses are 404s (see RoutineService).

export function toRoutineDto(routine: Routine): RoutineDto {
  return {
    id: routine.id,
    name: routine.name,
    isActive: routine.isActive,
    archivedAt: routine.archivedAt?.toISOString() ?? null,
    createdAt: routine.createdAt.toISOString(),
    updatedAt: routine.updatedAt.toISOString(),
  };
}

export async function routineRoutes(app: FastifyInstance) {
  app.get('/routines', { preHandler: requireAuth }, async (request): Promise<RoutineListResponse> => {
    const routines = await app.routineService.list(request.userId);
    return routineListResponseSchema.parse({ routines: routines.map(toRoutineDto) });
  });

  app.post('/routines', { preHandler: requireAuth }, async (request, reply): Promise<RoutineDto> => {
    const body = createRoutineRequestSchema.parse(request.body);
    const routine = await app.routineService.create(request.userId, body.name);
    reply.status(201);
    return routineSchema.parse(toRoutineDto(routine));
  });

  app.get('/routines/:id', { preHandler: requireAuth }, async (request): Promise<RoutineDto> => {
    const routine = await app.routineService.get(request.userId, idParamOf(request, 'Routine'));
    return routineSchema.parse(toRoutineDto(routine));
  });

  app.patch('/routines/:id', { preHandler: requireAuth }, async (request): Promise<RoutineDto> => {
    const body = updateRoutineRequestSchema.parse(request.body);
    const routine = await app.routineService.update(request.userId, idParamOf(request, 'Routine'), body);
    return routineSchema.parse(toRoutineDto(routine));
  });

  app.delete(
    '/routines/:id',
    { preHandler: requireAuth },
    async (request): Promise<{ ok: true }> => {
      await app.routineService.delete(request.userId, idParamOf(request, 'Routine'));
      return { ok: true };
    },
  );
}
