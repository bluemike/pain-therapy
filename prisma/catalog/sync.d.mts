import type { PrismaClient } from '@prisma/client';

export type SyncStats = Record<string, { created: number; updated: number; retired: number; unchanged: number }>;

export function readCatalog(dir?: string, content?: unknown): Promise<Record<string, Record<string, unknown>[]>>;
export function readExerciseContent(env?: Record<string, string | undefined>): Promise<unknown>;
export function normalizeContent(
  entry: unknown,
  stepLabels?: string[],
): { rolling: string | null; steps: { label: string; text: string }[]; variants: string | null } | null;
export function contentByCode(content: unknown): Map<string, Record<string, unknown>> | null;
export function syncCatalog(
  db: PrismaClient,
  opts?: { dir?: string; now?: Date; content?: unknown },
): Promise<SyncStats>;
