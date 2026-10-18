import type { PrismaClient } from '@prisma/client';

export type SyncStats = Record<string, { created: number; updated: number; retired: number; unchanged: number }>;

export function readCatalog(
  dir?: string,
  content?: unknown,
  segments?: unknown,
): Promise<Record<string, Record<string, unknown>[]>>;
export function readExerciseContent(env?: Record<string, string | undefined>, file?: string): Promise<unknown>;
export function normalizeContent(
  entry: unknown,
  stepLabels?: string[],
): { rolling: string | null; steps: { label: string; text: string }[]; variants: string | null } | null;
export type Segments = {
  frm: { items: { n: number[]; text: string }[] };
  standard: { intro: string | null; steps: { label: string; text: string }[]; note: string | null };
  variants: { intro: string | null; items: { number: number; text: string }[] };
};
export function normalizeSegments(entry: unknown): Segments | null;
export function contentByCode(content: unknown): Map<string, Record<string, unknown>> | null;
export function syncCatalog(
  db: PrismaClient,
  opts?: { dir?: string; now?: Date; content?: unknown; segments?: unknown },
): Promise<SyncStats>;
