import type { Prisma, PrismaClient } from '../generated/prisma/client.js';

// The four TaskCategory rows every user starts with (TASK_SYSTEM_SPEC.md §2).
// Colors come from the app's violet-friendly Tailwind palette (violet-500,
// indigo-500, emerald-500, amber-500). Names are unique per user, so seeding
// is idempotent via skipDuplicates.
export const DEFAULT_TASK_CATEGORIES: readonly { name: string; color: string }[] = [
  { name: 'Study', color: '#8b5cf6' },
  { name: 'Work', color: '#6366f1' },
  { name: 'Health', color: '#10b981' },
  { name: 'Personal', color: '#f59e0b' },
];

type Db = PrismaClient | Prisma.TransactionClient;

// Insert whichever defaults the user is missing. Runs inside the signup
// transaction for new users; the category list endpoint (step 3) also calls
// it as a guard for accounts created before this feature existed.
export async function ensureDefaultCategories(db: Db, userId: string): Promise<void> {
  await db.taskCategory.createMany({
    data: DEFAULT_TASK_CATEGORIES.map((category, index) => ({
      userId,
      name: category.name,
      color: category.color,
      sortOrder: index,
    })),
    skipDuplicates: true,
  });
}
