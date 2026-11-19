import type { PrismaClient } from '@prisma/client';

export function applyPracticeAppRole(db: PrismaClient, password?: string): Promise<void>;
