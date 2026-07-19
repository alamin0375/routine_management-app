import { z } from 'zod';

// Contract for GET /api/v1/health — the only endpoint in Phase 0.
// Serves as the pattern for all future contracts: Zod schema + inferred type.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
