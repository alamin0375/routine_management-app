import { z } from 'zod';

// Environment is parsed and validated once at boot (TECHNICAL_ARCHITECTURE.md §6).
// Fail fast on missing/invalid config instead of failing at first use.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://postgres:postgres@localhost:5432/routine_app'),
  // Signs access tokens (HS256). The dev default keeps `npm run dev` friction
  // free; production must set a real secret — enforced below.
  JWT_SECRET: z.string().min(32).default('dev-only-secret-change-me-0123456789abcdef'),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  if (
    parsed.data.NODE_ENV === 'production' &&
    parsed.data.JWT_SECRET === 'dev-only-secret-change-me-0123456789abcdef'
  ) {
    console.error('JWT_SECRET must be set to a real secret in production.');
    process.exit(1);
  }
  return parsed.data;
}
