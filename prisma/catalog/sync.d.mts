import type { PrismaClient } from '@prisma/client';

export type SyncStats = Record<string, { created: number; updated: number; retired: number; unchanged: number }>;

export function readCatalog(dir?: string): Promise<Record<string, Record<string, unknown>[]>>;
export function syncCatalog(db: PrismaClient, opts?: { dir?: string; now?: Date }): Promise<SyncStats>;
