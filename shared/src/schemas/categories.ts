import { z } from 'zod';

// Contracts for /api/v1/task-categories (Task System step 3).

// #RRGGBB, case-insensitive on input, normalized to lowercase before any
// write so stored colors are canonical.
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a #RRGGBB hex value.')
  .transform((value) => value.toLowerCase());

export const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required.')
    .max(50, 'Name must be at most 50 characters.'),
  color: hexColorSchema,
});
export type CategoryCreateRequest = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = z
  .object({
    name: categoryCreateSchema.shape.name,
    color: hexColorSchema,
    sortOrder: z.number().int().min(0, 'sortOrder must be 0 or greater.'),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one field to update.',
  });
export type CategoryUpdateRequest = z.infer<typeof categoryUpdateSchema>;

export const taskCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  createdAt: z.string(), // ISO 8601
  updatedAt: z.string(), // ISO 8601
});
export type TaskCategory = z.infer<typeof taskCategorySchema>;

export const categoryListResponseSchema = z.object({
  categories: z.array(taskCategorySchema),
});
export type CategoryListResponse = z.infer<typeof categoryListResponseSchema>;
