import { healthResponseSchema, type HealthResponse } from '@routine-app/shared';

// Minimal API client for Phase 0. Grows into a typed wrapper with auth
// headers and error-envelope handling in Phase 1.
const BASE_URL = '/api/v1';

export async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return healthResponseSchema.parse(await res.json());
}
