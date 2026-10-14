import type { PrismaClient } from '@prisma/client';

export const ATTEMPT_RETENTION_DAYS: number;
export function applyPatientZoneRole(db: PrismaClient, password?: string): Promise<number>;
