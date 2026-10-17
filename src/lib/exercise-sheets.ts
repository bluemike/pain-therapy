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

/** Shape of ExerciseSheet.segments, written by catalog:sync from segments-content.json (iteration 8, design D2) */
export type SheetSegments = {
  frm: { items: { n: number[]; text: string }[] };
  standard: { intro: string | null; steps: { label: string; text: string }[]; note: string | null };
  variants: { intro: string | null; items: { number: number; text: string }[] };
};

/**
 * Media of an exercise: main image, whole sheet and spoken sheet (iterations 3 and 7); since iteration 8 (design D2)
 * the image bands of FRM, Standardübung and Varianten and one recording each for FRM, Standardübung and every
 * variant (`v<n>-audio`).
 */
export type MediaKind =
  'main' | 'sheet' | 'audio' | 'frm' | 'std' | 'var' | 'frm-audio' | 'std-audio' | `v${number}-audio`;
const FIXED_KINDS = ['main', 'sheet', 'audio', 'frm', 'std', 'var', 'frm-audio', 'std-audio'];
export const isMediaKind = (kind: string): kind is MediaKind =>
  FIXED_KINDS.includes(kind) || /^v[1-9]\d?-audio$/.test(kind);
export type BandKind = 'frm' | 'std' | 'var';
export type AudioKind = 'audio' | 'frm-audio' | 'std-audio' | `v${number}-audio`;

/** File name of a medium in the container `exercise-media` */
export function mediaFileOf(code: string, kind: MediaKind, sheet: Pick<ExerciseSheet, 'mainImage' | 'sheetImage'>) {
  if (kind === 'main') return sheet.mainImage;
  if (kind === 'sheet') return sheet.sheetImage;
  if (kind === 'audio') return audioFileOf(sheet.mainImage);
  if (kind === 'frm' || kind === 'std' || kind === 'var') return `${code}-${kind}.png`;
  if (kind === 'frm-audio') return `${code}-frm.mp3`;
  if (kind === 'std-audio') return `${code}-std.mp3`;
  return `${code}-V${kind.slice(1, -'-audio'.length)}.mp3`;
}

export const timingOf = (s: Pick<ExerciseSheet, 'stretchSecondsPerSide' | 'sides' | 'rollingSeconds'> | null) =>
  s ? { stretchSecondsPerSide: s.stretchSecondsPerSide, sides: s.sides, rollingSeconds: s.rollingSeconds } : null;

/**
 * Every active exercise with its Bereich, timing and EPD variants, for "Übung aus anderem Bereich hinzufügen" and the
 * time totals of the session form (iteration 8, design D6)
 */
export async function exerciseChoices(includeCodes: string[] = []) {
  const rows = await db.exercise.findMany({
    where: { OR: [{ retiredAt: null }, { code: { in: includeCodes } }] },
    include: {
      sheet: true,
      epdVariants: { where: { retiredAt: null }, orderBy: { number: 'asc' } },
      bodyArea: true,
    },
    orderBy: { sort: 'asc' },
  });
  return rows.map((x) => ({
    code: x.code,
    nameDe: x.nameDe,
    nameEn: x.nameEn,
    group: x.group,
    areaDe: x.bodyArea.nameDe,
    areaEn: x.bodyArea.nameEn,
    retired: !!x.retiredAt,
    timing: timingOf(x.sheet?.retiredAt ? null : x.sheet) as Timing | null,
    variants: x.epdVariants.map((v) => ({ number: v.number, images: v.images, aids: v.aids, seconds: v.seconds })),
  }));
}
export type ExerciseChoice = Awaited<ReturnType<typeof exerciseChoices>>[number];

/** exercise-library: Übung im Katalog ansehen */
export async function exerciseDetail(code: string) {
  const x = await db.exercise.findFirst({
    where: { code, retiredAt: null },
    include: {
      sheet: true,
      bodyArea: true,
      epdVariants: { where: { retiredAt: null }, orderBy: { number: 'asc' } },
      regions: { where: { retiredAt: null }, include: { region: true }, orderBy: { regionId: 'asc' } },
    },
  });
  if (!x) return null;
  const sheet = x.sheet && !x.sheet.retiredAt ? x.sheet : null;
  const tools = sheet?.rollingTools.length
    ? await db.rollingTool.findMany({ where: { code: { in: sheet.rollingTools } }, orderBy: { sort: 'asc' } })
    : [];
  return {
    ...x,
    sheet,
    tools,
    segments: (sheet?.segments ?? null) as SheetSegments | null,
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

/** Reads an image or recording of an exercise; null if the sheet, the variant or the file is missing. */
export async function loadExerciseMedia(code: string, kind: MediaKind) {
  const sheet = await db.exerciseSheet.findUnique({ where: { exerciseCode: code } });
  if (!sheet || sheet.retiredAt) return null;
  const variant = /^v(\d+)-audio$/.exec(kind);
  if (
    variant &&
    !(await db.exerciseVariant.findFirst({
      where: { exerciseCode: code, number: Number(variant[1]), retiredAt: null },
    }))
  )
    return null;
  const name = mediaFileOf(code, kind, sheet);
  const contentType = CONTENT_TYPES[name.split('.').pop()?.toLowerCase() ?? ''];
  if (!contentType) return null;
  const data = await exerciseMediaStore().get(name);
  return data ? { data, contentType, name } : null;
}
