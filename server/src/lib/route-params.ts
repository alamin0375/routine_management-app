import { z } from 'zod';
import type { FastifyRequest } from 'fastify';
import { notFoundError } from '../services/errors.js';

// Project-wide convention (TASK_SYSTEM_AUDIT.md conflict #4 follow-up):
// a malformed resource id can't match anything, so it's a 404 — not a
// validation 400 — making probes with junk ids indistinguishable from
// probes with well-formed-but-missing ones. Ownership misses use the same
// notFoundError, so "not yours" and "not there" look identical too.

const paramsSchema = z.object({ id: z.string().uuid() });

export function idParamOf(request: FastifyRequest, resource: string): string {
  const parsed = paramsSchema.safeParse(request.params);
  if (!parsed.success) throw notFoundError(resource);
  return parsed.data.id;
}
