import type { FastifyInstance } from 'fastify';
import { healthResponseSchema, type HealthResponse } from '@routine-app/shared';

// Phase 0's only endpoint. Routes stay thin (parse → call service → respond);
// this one has no service to call yet.
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async (): Promise<HealthResponse> => {
    return healthResponseSchema.parse({ status: 'ok', version: '0.1.0' });
  });
}
