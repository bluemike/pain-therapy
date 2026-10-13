import type { PointEmphasis, Region } from '@prisma/client';
import { db } from './db';

/** therapy-catalog: read access for forms and the read-only catalog view (design D2, D3, D8). */

export const regionLabel = (r: Pick<Region, 'id' | 'nameDe' | 'nameEn'>, locale: string) =>
  `${r.id} · ${locale === 'en' ? r.nameEn : r.nameDe}`;

export const localName = (x: { nameDe: string; nameEn: string }, locale: string) =>
  locale === 'en' ? x.nameEn : x.nameDe;

/** The 12 areas for the area selection; a retired area stays selectable only for a treatment that has it. */
export async function listRegions(includeId?: number) {
  return db.region.findMany({
    where: { OR: [{ retiredAt: null }, ...(includeId ? [{ id: includeId }] : [])] },
    orderBy: { id: 'asc' },
  });
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
export type SheetExercise = { code: string; nameDe: string; nameEn: string; retired: boolean };

/**
 * consultations: Behandlungsbogen des Bereichs. Points and exercises of the area in paper order, plus entries that an
 * existing consultation recorded although they are no longer (or never were) on the form.
 */
export async function regionSheet(regionId: number, recorded: { pointIds?: string[]; exerciseCodes?: string[] } = {}) {
  const pointIds = recorded.pointIds ?? [];
  const exerciseCodes = recorded.exerciseCodes ?? [];
  const [rp, rx, extraPoints, extraExercises] = await Promise.all([
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
  for (const x of extraExercises)
    if (!exercises.some((e) => e.code === x.code))
      exercises.push({ code: x.code, nameDe: x.nameDe, nameEn: x.nameEn, retired: !!x.retiredAt });
  return { points, exercises };
}

/** All active points, for "Punkt aus anderem Bereich" */
export async function allPoints() {
  return db.osteopressurePoint.findMany({ where: { retiredAt: null }, orderBy: { sort: 'asc' } });
}

/** Data of the read-only catalog view; retired entries are left out. */
export async function catalogView() {
  const [regions, points, regionPoints, exercises, regionExercises, tools] = await Promise.all([
    db.region.findMany({ where: { retiredAt: null }, orderBy: { id: 'asc' } }),
    db.osteopressurePoint.findMany({ where: { retiredAt: null }, orderBy: { sort: 'asc' } }),
    db.regionPoint.findMany({
      where: { retiredAt: null, point: { retiredAt: null }, region: { retiredAt: null } },
      orderBy: [{ regionId: 'asc' }, { sort: 'asc' }],
    }),
    db.exercise.findMany({ where: { retiredAt: null }, orderBy: { sort: 'asc' } }),
    db.regionExercise.findMany({
      where: { retiredAt: null, exercise: { retiredAt: null }, region: { retiredAt: null } },
      orderBy: [{ regionId: 'asc' }, { sort: 'asc' }],
    }),
    db.rollingTool.findMany({ where: { retiredAt: null }, orderBy: { sort: 'asc' } }),
  ]);
  return { regions, points, regionPoints, exercises, regionExercises, tools };
}

/** Shape of Exercise.rolling and Exercise.variants once captured (null while "noch nicht erfasst") */
export type RollingStep = { order: number; toolCode: string; areaDe: string; note?: string };
export type Variant = { order: number; de: string };
