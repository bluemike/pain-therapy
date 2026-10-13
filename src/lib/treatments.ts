import type { Consultation, Prisma, Treatment } from '@prisma/client';
import { db } from './db';
import { audit } from './audit';
import { formatDateTime } from './format';
import { consentStatusOf } from './patients';
import { currentVersionNumber } from './consent-texts';
import { addPhotoRows, preparePhotos, removePhotoRows, writePhotos, type PhotoUpload } from './photos';
import type { ConsultationInput, Sheet, TreatmentInput } from './schemas';
import type { Actor } from './session';

/** treatments and consultations: every write goes through here and into the audit log (design D1). */

export class TreatmentError extends Error {
  constructor(
    public code: 'inactive' | 'consent' | 'region' | 'regionLocked' | 'startAfterConsultation' | 'catalog' | 'notFound',
  ) {
    super(code);
  }
}

/**
 * Voraussetzungen (design D9): new treatments and consultations only for active patients with a valid signed
 * disclaimer, the same check as "Unterschrift ausstehend" on the dashboard. Returns the reason or null.
 */
export async function openingBlocker(patientId: string): Promise<'inactive' | 'consent' | null> {
  const [p, current] = await Promise.all([
    db.patient.findUnique({
      where: { id: patientId },
      select: { status: true, documents: { orderBy: { createdAt: 'desc' }, take: 1, select: { textVersion: true } } },
    }),
    currentVersionNumber(),
  ]);
  if (!p) throw new TreatmentError('notFound');
  if (p.status !== 'ACTIVE') return 'inactive';
  return consentStatusOf(p.documents[0]?.textVersion, current) === 'signed' ? null : 'consent';
}

async function assertOpenable(patientId: string) {
  const blocker = await openingBlocker(patientId);
  if (blocker) throw new TreatmentError(blocker);
}

async function assertRegion(regionId: number, current?: number) {
  const r = await db.region.findUnique({ where: { id: regionId } });
  if (!r || (r.retiredAt && r.id !== current)) throw new TreatmentError('region');
}

/** Context stored with every audit event, so the history can name the treatment and consultation */
const ctxOf = (t: Pick<Treatment, 'id' | 'regionId'>, c?: Pick<Consultation, 'id' | 'number'>) => ({
  treatmentId: t.id,
  regionId: t.regionId,
  ...(c ? { consultationId: c.id, number: c.number } : {}),
});

/** treatments: Behandlungsliste, newest first, with consultations (newest first) and photo counts */
export async function treatmentsOf(patientId: string) {
  return db.treatment.findMany({
    where: { patientId },
    orderBy: { startedAt: 'desc' },
    include: {
      region: true,
      photos: { where: { removedAt: null, consultationId: null }, orderBy: { takenAt: 'asc' } },
      consultations: {
        orderBy: { number: 'desc' },
        include: {
          _count: { select: { points: true, exercises: true, rolling: true, photos: { where: { removedAt: null } } } },
        },
      },
    },
  });
}

export async function getTreatment(id: string) {
  return db.treatment.findUnique({
    where: { id },
    include: { region: true, patient: true, _count: { select: { consultations: true } } },
  });
}

export async function createTreatment(
  actor: Actor,
  patientId: string,
  input: TreatmentInput,
  uploads: PhotoUpload[] = [],
) {
  await assertOpenable(patientId);
  await assertRegion(input.regionId);
  const photos = preparePhotos(patientId, uploads);
  await writePhotos(photos);
  return db.$transaction(async (tx) => {
    const t = await tx.treatment.create({
      data: { ...input, patientId, createdBy: actor.name, updatedBy: actor.name },
    });
    await audit(
      actor,
      'treatment.created',
      { patientId, after: input.diagnosis, details: ctxOf(t) as Prisma.InputJsonValue },
      tx,
    );
    await addPhotoRows(tx, actor, photos, { patientId, treatmentId: t.id, details: ctxOf(t) });
    return t;
  });
}

type Change = { field: string; before: string | null; after: string | null };

const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

function treatmentChanges(before: Treatment, input: TreatmentInput): Change[] {
  const changes: Change[] = [];
  const cmp = (field: string, a: string | null, b: string | null) => {
    if (a !== b) changes.push({ field, before: a, after: b });
  };
  cmp('startedAt', formatDateTime(before.startedAt), formatDateTime(input.startedAt));
  cmp('regionId', str(before.regionId), str(input.regionId));
  cmp('diagnosis', before.diagnosis, input.diagnosis);
  cmp('painStart', str(before.painStart), str(input.painStart));
  return changes;
}

/** treatments: Behandlung ändern, with old and new value of every field in the history; photos added or hidden */
export async function updateTreatment(
  actor: Actor,
  id: string,
  input: TreatmentInput,
  photoChanges: { add?: PhotoUpload[]; remove?: string[] } = {},
) {
  const existing = await db.treatment.findUnique({ where: { id } });
  if (!existing) throw new TreatmentError('notFound');
  // Behandlung nach der ersten Konsultation: the sheets hang off the area, and no consultation may predate the start
  const first = await db.consultation.findFirst({
    where: { treatmentId: id },
    orderBy: { at: 'asc' },
    select: { at: true },
  });
  if (first && input.regionId !== existing.regionId) throw new TreatmentError('regionLocked');
  if (first && input.startedAt > first.at) throw new TreatmentError('startAfterConsultation');
  if (input.regionId !== existing.regionId) await assertRegion(input.regionId, existing.regionId);
  const photos = preparePhotos(existing.patientId, photoChanges.add ?? []);
  await writePhotos(photos);
  const changes = treatmentChanges(existing, input);
  return db.$transaction(async (tx) => {
    const t = changes.length
      ? await tx.treatment.update({ where: { id }, data: { ...input, updatedBy: actor.name } })
      : existing;
    const details = ctxOf(t) as Prisma.InputJsonValue;
    for (const c of changes) await audit(actor, 'treatment.updated', { patientId: t.patientId, ...c, details }, tx);
    const ctx = { patientId: t.patientId, treatmentId: id, details: ctxOf(t) };
    await addPhotoRows(tx, actor, photos, ctx);
    await removePhotoRows(tx, actor, photoChanges.remove ?? [], ctx);
    return t;
  });
}

// ---------- Consultations ----------

async function assertCatalog(sheet: Sheet) {
  const pointIds = sheet.points.map((p) => p.pointId);
  const codes = sheet.exercises.map((x) => x.code);
  const tools = [...new Set(sheet.rolling.map((r) => r.toolCode).filter((c): c is string => !!c))];
  const [np, nx, nt] = await Promise.all([
    db.osteopressurePoint.count({ where: { id: { in: pointIds } } }),
    db.exercise.count({ where: { code: { in: codes } } }),
    db.rollingTool.count({ where: { code: { in: tools } } }),
  ]);
  if (np !== pointIds.length || nx !== codes.length || nt !== tools.length) throw new TreatmentError('catalog');
}

function sheetRows(sheet: Sheet) {
  return {
    points: {
      create: sheet.points.map((p) => ({
        pointId: p.pointId,
        left: p.left,
        right: p.right,
        sensitivity: p.sensitivity,
      })),
    },
    exercises: {
      create: sheet.exercises.map((x) => ({
        exerciseCode: x.code,
        prescribed: x.prescribed,
        difficulty: x.difficulty,
        variants: x.variants,
      })),
    },
    rolling: {
      create: sheet.rolling.map((r) => ({ position: r.position, area: r.area, toolCode: r.toolCode })),
    },
    home: {
      create: sheet.home.map((h) => ({
        exerciseCode: h.code,
        repetition: h.repetition,
        intensity: h.intensity,
        steps: h.steps,
        note: h.note,
      })),
    },
  };
}

/** Values of a new consultation: date and time now, diagnosis of the treatment (consultations: Konsultation eröffnen) */
export async function newConsultationDefaults(treatmentId: string) {
  const t = await db.treatment.findUnique({ where: { id: treatmentId } });
  if (!t) throw new TreatmentError('notFound');
  const last = await db.consultation.findFirst({ where: { treatmentId }, orderBy: { number: 'desc' } });
  return { diagnosis: t.diagnosis, nextNumber: (last?.number ?? 0) + 1 };
}

/** consultations: Konsultation eröffnen. The number is assigned in the same transaction and never changes (D4). */
export async function createConsultation(
  actor: Actor,
  treatmentId: string,
  input: ConsultationInput,
  uploads: PhotoUpload[] = [],
) {
  const t = await db.treatment.findUnique({ where: { id: treatmentId } });
  if (!t) throw new TreatmentError('notFound');
  await assertOpenable(t.patientId);
  await assertCatalog(input.sheet);
  const photos = preparePhotos(t.patientId, uploads);
  await writePhotos(photos);
  return db.$transaction(async (tx) => {
    // Serialises concurrent saves on the same treatment so numbers stay gapless and unique
    await tx.$queryRaw`SELECT id FROM "Treatment" WHERE id = ${treatmentId} FOR UPDATE`;
    const last = await tx.consultation.aggregate({ where: { treatmentId }, _max: { number: true } });
    const c = await tx.consultation.create({
      data: {
        treatmentId,
        number: (last._max.number ?? 0) + 1,
        at: input.at,
        diagnosis: input.diagnosis,
        painBefore: input.painBefore,
        painAfter: input.painAfter,
        comparison: input.comparison,
        createdBy: actor.name,
        updatedBy: actor.name,
        ...sheetRows(input.sheet),
      },
    });
    await audit(
      actor,
      'consultation.created',
      { patientId: t.patientId, details: ctxOf(t, c) as Prisma.InputJsonValue },
      tx,
    );
    await addPhotoRows(tx, actor, photos, {
      patientId: t.patientId,
      treatmentId,
      consultationId: c.id,
      details: ctxOf(t, c),
    });
    return c;
  });
}

export async function getConsultation(id: string) {
  return db.consultation.findUnique({
    where: { id },
    include: {
      treatment: { include: { region: true, patient: true } },
      points: true,
      exercises: true,
      rolling: { orderBy: { position: 'asc' } },
      home: true,
    },
  });
}

type Stored = NonNullable<Awaited<ReturnType<typeof getConsultation>>>;

/** The sheet of a stored consultation in the shape of the form */
export function sheetOf(c: Pick<Stored, 'points' | 'exercises' | 'rolling' | 'home'>): Sheet {
  return {
    points: c.points.map((p) => ({ pointId: p.pointId, left: p.left, right: p.right, sensitivity: p.sensitivity })),
    exercises: c.exercises.map((x) => ({
      code: x.exerciseCode,
      prescribed: x.prescribed,
      difficulty: x.difficulty,
      variants: x.variants,
    })),
    rolling: c.rolling.map((r) => ({ position: r.position, area: r.area, toolCode: r.toolCode })),
    // In the order of the exercise rows, like the form
    home: c.exercises
      .map((x) => c.home.find((h) => h.exerciseCode === x.exerciseCode))
      .filter((h) => !!h)
      .map((h) => ({
        code: h.exerciseCode,
        repetition: h.repetition,
        intensity: h.intensity,
        steps: h.steps,
        note: h.note,
      })),
  };
}

/**
 * Field-by-field changes of a consultation for the history. Sheet fields are named "point:<id>:<field>",
 * "exercise:<code>:<field>", "rolling:<position>:<field>" and "home:<code>:<field>" (Selbstausführung).
 */
export function consultationChanges(before: Stored, input: ConsultationInput): Change[] {
  const changes: Change[] = [];
  const cmp = (field: string, a: unknown, b: unknown) => {
    const x = str(a);
    const y = str(b);
    if (x !== y) changes.push({ field, before: x, after: y });
  };
  cmp('at', formatDateTime(before.at), formatDateTime(input.at));
  cmp('diagnosis', before.diagnosis, input.diagnosis);
  cmp('painBefore', before.painBefore, input.painBefore);
  cmp('painAfter', before.painAfter, input.painAfter);
  cmp('comparison', before.comparison, input.comparison);
  const old = sheetOf(before);
  const next = input.sheet;
  const ids = [...new Set([...old.points, ...next.points].map((p) => p.pointId))];
  for (const id of ids) {
    const a = old.points.find((p) => p.pointId === id);
    const b = next.points.find((p) => p.pointId === id);
    cmp(`point:${id}:left`, a?.left ?? false, b?.left ?? false);
    cmp(`point:${id}:right`, a?.right ?? false, b?.right ?? false);
    cmp(`point:${id}:sensitivity`, a?.sensitivity, b?.sensitivity);
  }
  const codes = [...new Set([...old.exercises, ...next.exercises].map((x) => x.code))];
  for (const code of codes) {
    const a = old.exercises.find((x) => x.code === code);
    const b = next.exercises.find((x) => x.code === code);
    cmp(`exercise:${code}:prescribed`, a?.prescribed ?? false, b?.prescribed ?? false);
    cmp(`exercise:${code}:difficulty`, a?.difficulty, b?.difficulty);
    cmp(`exercise:${code}:variants`, a?.variants, b?.variants);
  }
  for (let pos = 1; pos <= 6; pos++) {
    const a = old.rolling.find((r) => r.position === pos);
    const b = next.rolling.find((r) => r.position === pos);
    cmp(`rolling:${pos}:area`, a?.area, b?.area);
    cmp(`rolling:${pos}:tool`, a?.toolCode, b?.toolCode);
  }
  // home-program: Änderungshistorie der Verordnungen (task 2.4)
  const homeCodes = [...new Set([...old.home, ...next.home].map((h) => h.code))];
  for (const code of homeCodes) {
    const a = old.home.find((h) => h.code === code);
    const b = next.home.find((h) => h.code === code);
    cmp(`home:${code}:repetition`, a?.repetition, b?.repetition);
    cmp(`home:${code}:intensity`, a?.intensity, b?.intensity);
    cmp(`home:${code}:steps`, a?.steps, b?.steps);
    cmp(`home:${code}:note`, a?.note, b?.note);
  }
  return changes;
}

/** consultations: Konsultation ändern, every change in the history; photos added or hidden. No delete. */
export async function updateConsultation(
  actor: Actor,
  id: string,
  input: ConsultationInput,
  photoChanges: { add?: PhotoUpload[]; remove?: string[] } = {},
) {
  const existing = await getConsultation(id);
  if (!existing) throw new TreatmentError('notFound');
  await assertCatalog(input.sheet);
  const t = existing.treatment;
  const photos = preparePhotos(t.patientId, photoChanges.add ?? []);
  await writePhotos(photos);
  const changes = consultationChanges(existing, input);
  return db.$transaction(async (tx) => {
    if (changes.length) {
      // Sheet rows are replaced as a whole; the history keeps every single change
      await tx.consultationPoint.deleteMany({ where: { consultationId: id } });
      await tx.consultationExercise.deleteMany({ where: { consultationId: id } });
      await tx.consultationRolling.deleteMany({ where: { consultationId: id } });
      await tx.homePrescription.deleteMany({ where: { consultationId: id } });
      await tx.consultation.update({
        where: { id },
        data: {
          at: input.at,
          diagnosis: input.diagnosis,
          painBefore: input.painBefore,
          painAfter: input.painAfter,
          comparison: input.comparison,
          updatedBy: actor.name,
          ...sheetRows(input.sheet),
        },
      });
    }
    const details = ctxOf(t, existing);
    for (const c of changes)
      await audit(
        actor,
        'consultation.updated',
        { patientId: t.patientId, ...c, details: details as Prisma.InputJsonValue },
        tx,
      );
    const ctx = { patientId: t.patientId, treatmentId: t.id, consultationId: id, details };
    await addPhotoRows(tx, actor, photos, ctx);
    await removePhotoRows(tx, actor, photoChanges.remove ?? [], ctx);
    return existing;
  });
}
