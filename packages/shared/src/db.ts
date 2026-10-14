import { PrismaClient } from '@prisma/client';

/**
 * Prisma client factory (iteration 4, design D11). The schema stays in prisma/ at the root; the practice app connects
 * with DATABASE_URL, the patient zone with its own role patient_zone.
 */
export function createPrismaClient(url?: string): PrismaClient {
  return url ? new PrismaClient({ datasourceUrl: url }) : new PrismaClient();
}
