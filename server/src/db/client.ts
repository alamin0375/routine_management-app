import { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

// Single Prisma client for the whole process (TECHNICAL_ARCHITECTURE.md §6:
// db/ holds the client and query helpers). Uses the pg driver adapter —
// Prisma 7's client engine — with the pool sized by the adapter defaults.
let prisma: PrismaClient | undefined;

export function getPrisma(databaseUrl: string): PrismaClient {
  if (!prisma) {
    const adapter = new PrismaPg({ connectionString: databaseUrl });
    prisma = new PrismaClient({ adapter });
  }
  return prisma;
}

export async function disconnectPrisma(): Promise<void> {
  await prisma?.$disconnect();
  prisma = undefined;
}
