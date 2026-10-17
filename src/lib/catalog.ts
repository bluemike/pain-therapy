import type { PointEmphasis, Region } from '@prisma/client';
import { db } from './db';

/** therapy-catalog: read access for forms and the read-only catalog view (design D2, D3, D8). */

/** "1.2 · Kiefer und Zähne": Schmerzbereich with its number in the Bereich (iteration 8, design D1) */
export const regionLabel = (r: Pick<Region, 'code' | 'nameDe' | 'nameEn'>, locale: string) =>
  `${r.code} · ${locale === 'en' ? r.nameEn : r.nameDe}`;

export const localName = (x: { nameDe: string; nameEn: string }, locale: string) =>
  locale === 'en' ? x.nameEn : x.nameDe;

/**
 * The 12 Schmerzbereiche for the selection, with their Bereich (grouped in the form); a retired one stays selectable
 * only for a treatment that has it.
 */
export async function listRegions(includeId?: number) {
  return db.region.findMany({
    where: { OR: [{ retiredAt: null }, ...(includeId ? [{ id: includeId }] : [])] },
    include: { bodyArea: true },
    orderBy: { id: 'asc' },
  });
}

/** Schmerzbereiche grouped by Bereich for a <select> with <optgroup> */
export function regionGroups(
  regions: Awaited<ReturnType<typeof listRegions>>,
  locale: string,
): { label: string; options: [string, string][] }[] {
  const groups = new Map<number, { label: string; options: [string, string][] }>();
  for (const r of regions) {
    const g = groups.get(r.bodyAreaId) ?? { label: `${r.bodyArea.id} ${localName(r.bodyArea, locale)}`, options: [] };
    g.options.push([String(r.id), regionLabel(r, locale)]);
    groups.set(r.bodyAreaId, g);
  }
  return [...groups.values()];
}

/** The 4 Bereiche */
export async function listBodyAreas() {
  return db.bodyArea.findMany({ where: { retiredAt: null }, orderBy: { id: 'asc' } });
}

export async function rollingTools(includeCodes: string[] = []) {
  return db.rollingTool.findMany({
    where: { OR: [{ retiredAt: null }, { code: { in: includeCodes } }] },
    orderBy: { sort: 'asc' },
  });
}

export type SheetPoint = {
  id: string;
  group: number;
  latin: string;
  de: string;
  emphasis: PointEmphasis;
  /** Not on this area's form: added from the catalog by the therapist */
  extra: boolean;
  retired: boolean;
};
export type SheetExercise = {
  code: string;
  nameDe: string;
  nameEn: string;
  retired: boolean;
  /** From another Bereich: added by the therapist (iteration 8, design D6) */
  extra?: boolean;
};

/**
 * session-form: Behandlungsbogen des Schmerzbereichs. Points in paper order; exercises of the Bereich with those of
 * the Behandlungsbogen first (iteration 8, design D6); plus entries that an existing session recorded although they
 * are no longer (or never were) on the form.
 */
export async function regionSheet(regionId: number, recorded: { pointIds?: string[]; exerciseCodes?: string[] } = {}) {
  const pointIds = recorded.pointIds ?? [];
  const exerciseCodes = recorded.exerciseCodes ?? [];
  const region = await db.region.findUnique({ where: { id: regionId }, select: { bodyAreaId: true } });
  const [rp, rx, areaExercises, extraPoints, extraExercises] = await Promise.all([
    db.regionPoint.findMany({
      where: { regionId, retiredAt: null, point: { retiredAt: null } },
      include: { point: true },
      orderBy: { sort: 'asc' },
    }),
    db.regionExercise.findMany({
      where: { regionId, retiredAt: null, exercise: { retiredAt: null } },
      include: { exercise: true },
      orderBy: { sort: 'asc' },
    }),
    db.exercise.findMany({ where: { group: region?.bodyAreaId ?? -1, retiredAt: null }, orderBy: { sort: 'asc' } }),
    db.osteopressurePoint.findMany({ where: { id: { in: pointIds } }, orderBy: { sort: 'asc' } }),
    db.exercise.findMany({ where: { code: { in: exerciseCodes } }, orderBy: { sort: 'asc' } }),
  ]);
  const points: SheetPoint[] = rp.map((r) => ({
    id: r.pointId,
    group: r.point.group,
    latin: r.point.muscleAttachmentLatin,
    de: r.point.attachmentDe,
    emphasis: r.emphasis,
    extra: false,
    retired: false,
  }));
  for (const p of extraPoints)
    if (!points.some((x) => x.id === p.id))
      points.push({
        id: p.id,
        group: p.group,
        latin: p.muscleAttachmentLatin,
        de: p.attachmentDe,
        emphasis: 'standard',
        extra: true,
        retired: !!p.retiredAt,
      });
  const exercises: SheetExercise[] = rx.map((r) => ({
    code: r.exerciseCode,
    nameDe: r.exercise.nameDe,
    nameEn: r.exercise.nameEn,
    retired: false,
  }));
  for (const x of areaExercises)
    if (!exercises.some((e) => e.code === x.code))
      exercises.push({ code: x.code, nameDe: x.nameDe, nameEn: x.nameEn, retired: false });
  for (const x of extraExercises)
    if (!exercises.some((e) => e.code === x.code))
      exercises.push({ code: x.code, nameDe: x.nameDe, nameEn: x.nameEn, retired: !!x.retiredAt, extra: true });
  return { points, exercises };
}

/** All active points, for "Punkt aus anderem Bereich" */
export async function allPoints() {
  return db.osteopressurePoint.findMany({ where: { retiredAt: null }, orderBy: { sort: 'asc' } });
}

/** Data of the read-only view "L&B Basisdaten"; retired entries are left out. */
export async function catalogView() {
  const [areas, regions, points, regionPoints, exercises, regionExercises, tools] = await Promise.all([
    db.bodyArea.findMany({ where: { retiredAt: null }, orderBy: { id: 'asc' } }),
    db.region.findMany({ where: { retiredAt: null }, orderBy: { id: 'asc' } }),
    db.osteopressurePoint.findMany({ where: { retiredAt: null }, orderBy: { sort: 'asc' } }),
    db.regionPoint.findMany({
      where: { retiredAt: null, point: { retiredAt: null }, region: { retiredAt: null } },
      orderBy: [{ regionId: 'asc' }, { sort: 'asc' }],
    }),
    db.exercise.findMany({
      where: { retiredAt: null },
      include: { sheet: true, epdVariants: { where: { retiredAt: null }, orderBy: { number: 'asc' } } },
      orderBy: { sort: 'asc' },
    }),
    db.regionExercise.findMany({
      where: { retiredAt: null, exercise: { retiredAt: null }, region: { retiredAt: null } },
      orderBy: [{ regionId: 'asc' }, { sort: 'asc' }],
    }),
    db.rollingTool.findMany({ where: { retiredAt: null }, orderBy: { sort: 'asc' } }),
  ]);
  return { areas, regions, points, regionPoints, exercises, regionExercises, tools };
}
