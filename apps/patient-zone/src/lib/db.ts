import type { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '@pain-therapy/shared/db';

/**
 * Database access with the role patient_zone (DATABASE_URL, design D12). The role reads only some columns, so every
 * query selects its columns explicitly; inserts into AuditEvent go without RETURNING (createMany).
 */
const globalForPrisma = globalThis as unknown as { zoneDb?: PrismaClient };

export const db = globalForPrisma.zoneDb ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.zoneDb = db;
