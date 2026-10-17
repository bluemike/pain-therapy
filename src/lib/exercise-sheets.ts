import type { ExerciseSheet } from '@prisma/client';
import { db } from './db';
import { exerciseMediaStore } from './storage';
import type { Timing } from './home-program';
import { audioFileOf } from './exercise-audio';

/** exercise-library: digitised sheets, their timing and media (design D1 to D3). */

/** Shape of ExerciseSheet.content, written by catalog:sync from exercises-content.json */
export type SheetContent = {
  rolling: string | null;
  steps: { label: string; text: string }[];
  variants: string | null;
};

export type MediaKind = 'main' | 'sheet' | 'audio';
export const MEDIA_KINDS: readonly MediaKind[] = ['main', 'sheet', 'audio'];

export const timingOf = (s: Pick<ExerciseSheet, 'stretchSecondsPerSide' | 'sides' | 'rollingSeconds'> | null) =>
  s ? { stretchSecondsPerSide: s.stretchSecondsPerSide, sides: s.sides, rollingSeconds: s.rollingSeconds } : null;

/** Every active exercise with its timing, for "Übung hinzufügen" and the time totals of the consultation form */
export async function exerciseChoices(includeCodes: string[] = []) {
  const rows = await db.exercise.findMany({
    where: { OR: [{ retiredAt: null }, { code: { in: includeCodes } }] },
    include: { sheet: true },
    orderBy: { sort: 'asc' },
  });
  return rows.map((x) => ({
    code: x.code,
    nameDe: x.nameDe,
    nameEn: x.nameEn,
    retired: !!x.retiredAt,
    timing: timingOf(x.sheet?.retiredAt ? null : x.sheet) as Timing | null,
  }));
}
export type ExerciseChoice = Awaited<ReturnType<typeof exerciseChoices>>[number];

/** exercise-library: Übung im Katalog ansehen */
export async function exerciseDetail(code: string) {
  const x = await db.exercise.findFirst({
    where: { code, retiredAt: null },
    include: { sheet: true, regions: { where: { retiredAt: null }, orderBy: { regionId: 'asc' } } },
  });
  if (!x) return null;
  const sheet = x.sheet && !x.sheet.retiredAt ? x.sheet : null;
  return {
    ...x,
    sheet,
    content: (sheet?.content ?? null) as SheetContent | null,
    timing: timingOf(sheet),
    timingTodo: (sheet?.timingTodo ?? []) as string[],
  };
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp3: 'audio/mpeg',
};

/** Reads the main image, the sheet image or the audio (iteration 7) of an exercise; null if the sheet or the file is missing. */
export async function loadExerciseMedia(code: string, kind: MediaKind) {
  const sheet = await db.exerciseSheet.findUnique({ where: { exerciseCode: code } });
  if (!sheet || sheet.retiredAt) return null;
  const name = kind === 'main' ? sheet.mainImage : kind === 'sheet' ? sheet.sheetImage : audioFileOf(sheet.mainImage);
  const contentType = CONTENT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''];
  if (!contentType) return null;
  const data = await exerciseMediaStore().get(name);
  return data ? { data, contentType, name } : null;
}
