import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7: connection URLs live here (not in schema.prisma), and .env is
// no longer auto-loaded — dotenv/config above provides DATABASE_URL to the
// CLI (migrate, studio, etc.). The runtime client gets its URL separately
// via the pg adapter in src/db/client.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url:
      process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/routine_app',
  },
});
