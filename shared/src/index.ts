// @routine-app/shared — single source of truth for API contracts.
// Client and server both import from here; never duplicate these types.
export * from './schemas/health.js';
export * from './schemas/auth.js';
export * from './schemas/routines.js';
export * from './schemas/categories.js';
export * from './schemas/tasks.js';
