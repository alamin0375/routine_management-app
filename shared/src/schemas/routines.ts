import { z } from 'zod';

// Contracts for /api/v1/routines (Phase 2-lite). Field limits follow the
// Routine model: name is the only user-supplied content for now; activation
// and archiving are booleans the server maps onto isActive/archivedAt.

export const createRoutineRequestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(100, 'Name must be at most 100 characters.'),
});
export type CreateRoutineRequest = z.infer<typeof createRoutineRequestSchema>;

export const updateRoutineRequestSchema = z
  .object({
    name: createRoutineRequestSchema.shape.name,
    isActive: z.boolean(),
    archived: z.boolean(), // true sets archivedAt=now, false clears it
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type UpdateRoutineRequest = z.infer<typeof updateRoutineRequestSchema>;

export const routineSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  isActive: z.boolean(),
  archivedAt: z.string().nullable(), // ISO 8601
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
});
export type Routine = z.infer<typeof routineSchema>;

export const routineListResponseSchema = z.object({
  routines: z.array(routineSchema),
});
export type RoutineListResponse = z.infer<typeof routineListResponseSchema>;
