import type { Consultation, Prisma, Treatment } from '@prisma/client';
import { db } from './db';
import { audit } from './audit';
import { formatDateTime } from './format';
import { consentOf, consentVersions } from './patients';
import { blobFolder } from './practice';
import { addPhotoRows, preparePhotos, removePhotoRows, writePhotos, type PhotoUpload } from './photos';
import { claimHandoffPhotos } from './photo-handoff';
import type { ConsultationInput, Sheet, TreatmentInput } from './schemas';
import type { Actor } from './session';
import { inkColumn, noteForHistory, resolveInk, type InkChange } from './handwriting';

/** Handschrift (iteration 10, design D5): what the form sent for the image next to the text of a remark field */
type TreatmentInk = { diagnosisInk?: InkChange };
type ConsultationInk = { diagnosisInk?: InkChange; comparisonInk?: InkChange };
const KEEP: InkChange = { kind: 'keep' };
const svgOf = (ink: unknown) => (ink && typeof ink === 'object' ? ((ink as { svg?: string }).svg ?? null) : null);

/** treatments and consultations: every write goes through here and into the audit log (design D1). */

export class TreatmentError extends Error {
  constructor(
    public code:
      | 'inactive'
      | 'consent'
      | 'region'
      | 'regionLocked'
      | 'sideLocked'
      | 'side'
      | 'startAfterConsultation'
      | 'catalog'
      | 'notFound'
      | 'prescriptionLogged',
  ) {
    super(code);
  }
}

/**
 * Voraussetzungen (design D9): new treatments and consultations only for active patients with a valid signed
 * disclaimer, the same check as "Unterschrift ausstehend" on the dashboard. Returns the reason or null.
 *
 * Iteration 18 (design D2): with `newVisit` (opening or saving a new treatment or session) a signature of an older
 * version than the current one is no longer enough. The current version becomes the required one for this person
 * (Patient.signatureRequiredVersion, audit "consent.resignRequested") and the opening is blocked until they sign.
 */
export async function openingBlocker(
  patientId: string,
  newVisit?: Pick<Actor, 'id' | 'name'>,
): Promise<'inactive' | 'consent' | null> {
  const [p, versions] = await Promise.all([
    db.patient.findUnique({
      where: { id: patientId },
      select: {
        status: true,
        signatureRequiredVersion: true,
        // The latest completed signature, also before its PDF exists (iteration 5, design D2)
        signatureSessions: {
          where: { status: 'SIGNED' },
          orderBy: { completedAt: 'desc' },
          take: 1,
          select: { textVersion: { select: { version: true } } },
        },
      },
    }),
    consentVersions(),
  ]);
  if (!p) throw new TreatmentError('notFound');
  if (p.status !== 'ACTIVE') return 'inactive';
  const latest = p.signatureSessions[0]?.textVersion.version;
  if (newVisit && latest && latest < versions.current && (p.signatureRequiredVersion ?? 0) < versions.current) {
    await db.patient.update({
      where: { id: patientId },
      data: { signatureRequiredVersion: versions.current },
      select: { id: true },
    });
    await audit(newVisit, 'consent.resignRequested', {
      patientId,
      details: { version: versions.current, signedVersion: latest },
    });
    return 'consent';
  }
  return consentOf(latest, p.signatureRequiredVersion, versions) === 'signed' ? null : 'consent';
}

async function assertOpenable(patientId: string, actor: Pick<Actor, 'id' | 'name'>) {
  const blocker = await openingBlocker(patientId, actor);
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
          _count: { select: { points: true, exercises: true, photos: { where: { removedAt: null } } } },
        },
      },
    },
  });
}

export async function getTreatment(id: string) {
  return db.treatment.findUnique({
    where: { id },
    include: { region: { include: { bodyArea: true } }, patient: true, _count: { select: { consultations: true } } },
  });
}

export async function createTreatment(
  actor: Actor,
  patientId: string,
  input: TreatmentInput & TreatmentInk,
  uploads: PhotoUpload[] = [],
  handoff: string[] = [],
) {
  const { diagnosisInk = KEEP, ...values } = input;
  const ink = resolveInk(null, diagnosisInk, values.diagnosis);
  await assertOpenable(patientId, actor);
  await assertRegion(input.regionId);
  const photos = preparePhotos(await blobFolder(patientId), uploads);
  await writePhotos(photos);
  return db.$transaction(async (tx) => {
    const t = await tx.treatment.create({
      data: { ...values, diagnosisInk: inkColumn(ink), patientId, createdBy: actor.name, updatedBy: actor.name },
    });
    await audit(
      actor,
      'treatment.created',
      { patientId, after: noteForHistory(values.diagnosis, ink), details: ctxOf(t) as Prisma.InputJsonValue },
      tx,
    );
    await addPhotoRows(tx, actor, photos, { patientId, treatmentId: t.id, details: ctxOf(t) });
    // Fotos mit dem Smartphone (iteration 15, design D5)
    await claimHandoffPhotos(tx, actor, handoff, { patientId, treatmentId: t.id, details: ctxOf(t) });
    return t;
  });
}

type Change = { field: string; before: string | null; after: string | null };

/** A remark field is text or a handwriting image; a new image counts as a change even when both are images. */
function noteChange(
  changes: Change[],
  field: string,
  text: string | null,
  ink: unknown,
  nextText: string | null,
  nextInk: unknown,
) {
  const a = str(noteForHistory(text, ink));
  const b = str(noteForHistory(nextText, nextInk));
  if (a !== b) changes.push({ field, before: a, after: b });
  else if (svgOf(ink) !== svgOf(nextInk)) changes.push({ field, before: a, after: '[Handschrift, neu]' });
}

const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

function treatmentChanges(before: Treatment, input: TreatmentInput, ink: unknown): Change[] {
  const changes: Change[] = [];
  const cmp = (field: string, a: string | null, b: string | null) => {
    if (a !== b) changes.push({ field, before: a, after: b });
  };
  cmp('startedAt', formatDateTime(before.startedAt), formatDateTime(input.startedAt));
  cmp('regionId', str(before.regionId), str(input.regionId));
  cmp('side', before.side, input.side);
  noteChange(changes, 'diagnosis', before.diagnosis, before.diagnosisInk, input.diagnosis, ink);
  cmp('painStart', str(before.painStart), str(input.painStart));
  return changes;
}

/** treatments: Behandlung ändern, with old and new value of every field in the history; photos added or hidden */
export async function updateTreatment(
  actor: Actor,
  id: string,
  inputWithInk: TreatmentInput & TreatmentInk,
  photoChanges: { add?: PhotoUpload[]; remove?: string[]; handoff?: string[] } = {},
) {
  const { diagnosisInk = KEEP, ...input } = inputWithInk;
  const existing = await db.treatment.findUnique({ where: { id } });
  if (!existing) throw new TreatmentError('notFound');
  const ink = resolveInk(existing.diagnosisInk, diagnosisInk, input.diagnosis);
  // Behandlung nach der ersten Sitzung: the sheets hang off the area and the side (iteration 8, design D4), and no
  // session may predate the start
  const first = await db.consultation.findFirst({
    where: { treatmentId: id },
    orderBy: { at: 'asc' },
    select: { at: true },
  });
  if (first && input.regionId !== existing.regionId) throw new TreatmentError('regionLocked');
  if (first && input.side !== existing.side) throw new TreatmentError('sideLocked');
  if (first && input.startedAt > first.at) throw new TreatmentError('startAfterConsultation');
  if (input.regionId !== existing.regionId) await assertRegion(input.regionId, existing.regionId);
  const photos = preparePhotos(await blobFolder(existing.patientId), photoChanges.add ?? []);
  await writePhotos(photos);
  const changes = treatmentChanges(existing, input, ink);
  return db.$transaction(async (tx) => {
    const t = changes.length
      ? await tx.treatment.update({
          where: { id },
          data: { ...input, diagnosisInk: inkColumn(ink), updatedBy: actor.name },
        })
      : existing;
    const details = ctxOf(t) as Prisma.InputJsonValue;
    for (const c of changes) await audit(actor, 'treatment.updated', { patientId: t.patientId, ...c, details }, tx);
    const ctx = { patientId: t.patientId, treatmentId: id, details: ctxOf(t) };
    await addPhotoRows(tx, actor, photos, ctx);
    await claimHandoffPhotos(tx, actor, photoChanges.handoff ?? [], ctx);
    await removePhotoRows(tx, actor, photoChanges.remove ?? [], ctx);
    return t;
  });
}

// ---------- Consultations ----------

async function assertCatalog(sheet: Sheet) {
  const pointIds = sheet.points.map((p) => p.pointId);
  const codes = sheet.exercises.map((x) => x.code);
  const variants = sheet.exercises.filter((x) => x.variant !== null);
  const [np, nx, nv] = await Promise.all([
    db.osteopressurePoint.count({ where: { id: { in: pointIds } } }),
    db.exercise.count({ where: { code: { in: codes } } }),
    variants.length
      ? db.exerciseVariant.count({
          where: { OR: variants.map((x) => ({ exerciseCode: x.code, number: x.variant! })) },
        })
      : 0,
  ]);
  if (np !== pointIds.length || nx !== codes.length || nv !== variants.length) throw new TreatmentError('catalog');
}

/** Osteopressur nach Körperseite (design D4): with a side set, the opposite side is never recorded */
function assertSide(side: Treatment['side'], sheet: Sheet) {
  if (side === 'LEFT' && sheet.points.some((p) => p.right)) throw new TreatmentError('side');
  if (side === 'RIGHT' && sheet.points.some((p) => p.left)) throw new TreatmentError('side');
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
        variant: x.variant,
        parts: x.parts,
      })),
    },
    home: {
      create: sheet.home.map((h) => ({
        exerciseCode: h.code,
        variant: h.variant,
        parts: h.parts,
        timesPerDay: h.timesPerDay,
        weekdays: h.weekdays,
        note: h.note,
      })),
    },
  };
}

/** Values of a new session: date and time now, Schmerzlokalisation of the treatment (session-form) */
export async function newConsultationDefaults(treatmentId: string) {
  const t = await db.treatment.findUnique({ where: { id: treatmentId } });
  if (!t) throw new TreatmentError('notFound');
  const last = await db.consultation.findFirst({ where: { treatmentId }, orderBy: { number: 'desc' } });
  return { diagnosis: t.diagnosis, diagnosisInk: t.diagnosisInk, nextNumber: (last?.number ?? 0) + 1 };
}

/** consultations: Konsultation eröffnen. The number is assigned in the same transaction and never changes (D4). */
export async function createConsultation(
  actor: Actor,
  treatmentId: string,
  inputWithInk: ConsultationInput & ConsultationInk,
  uploads: PhotoUpload[] = [],
  handoff: string[] = [],
) {
  const { diagnosisInk = KEEP, comparisonInk = KEEP, ...input } = inputWithInk;
  const t = await db.treatment.findUnique({ where: { id: treatmentId } });
  if (!t) throw new TreatmentError('notFound');
  await assertOpenable(t.patientId, actor);
  assertSide(t.side, input.sheet);
  await assertCatalog(input.sheet);
  const photos = preparePhotos(await blobFolder(t.patientId), uploads);
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
        // The new session takes the treatment's handwriting as a proposal while the form keeps it ("keep")
        diagnosisInk: inkColumn(resolveInk(t.diagnosisInk, diagnosisInk, input.diagnosis)),
        painBefore: input.painBefore,
        painAfter: input.painAfter,
        comparison: input.comparison,
        comparisonInk: inkColumn(resolveInk(null, comparisonInk, input.comparison)),
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
    const ctx = { patientId: t.patientId, treatmentId, consultationId: c.id, details: ctxOf(t, c) };
    await addPhotoRows(tx, actor, photos, ctx);
    await claimHandoffPhotos(tx, actor, handoff, ctx);
    return c;
  });
}

export async function getConsultation(id: string) {
  return db.consultation.findUnique({
    where: { id },
    include: {
      treatment: { include: { region: { include: { bodyArea: true } }, patient: true } },
      points: true,
      exercises: true,
      home: true,
    },
  });
}

type Stored = NonNullable<Awaited<ReturnType<typeof getConsultation>>>;

/** The sheet of a stored consultation in the shape of the form */
export function sheetOf(c: Pick<Stored, 'points' | 'exercises' | 'home'>): Sheet {
  return {
    points: c.points.map((p) => ({ pointId: p.pointId, left: p.left, right: p.right, sensitivity: p.sensitivity })),
    exercises: c.exercises.map((x) => ({
      code: x.exerciseCode,
      prescribed: x.prescribed,
      difficulty: x.difficulty,
      variant: x.variant,
      parts: x.parts,
    })),
    // In the order of the exercise rows, like the form
    home: c.exercises
      .map((x) => c.home.find((h) => h.exerciseCode === x.exerciseCode))
      .filter((h) => !!h)
      .map((h) => ({
        code: h.exerciseCode,
        variant: h.variant,
        parts: h.parts,
        timesPerDay: h.timesPerDay,
        weekdays: h.weekdays,
        note: h.note,
      })),
  };
}

/**
 * Field-by-field changes of a session for the history. Sheet fields are named "point:<id>:<field>",
 * "exercise:<code>:<field>" and "home:<code>:<field>" (Selbstausführung).
 */
export function consultationChanges(
  before: Stored,
  input: ConsultationInput,
  ink: { diagnosis: unknown; comparison: unknown } = {
    diagnosis: before.diagnosisInk,
    comparison: before.comparisonInk,
  },
): Change[] {
  const changes: Change[] = [];
  const cmp = (field: string, a: unknown, b: unknown) => {
    const x = str(a);
    const y = str(b);
    if (x !== y) changes.push({ field, before: x, after: y });
  };
  cmp('at', formatDateTime(before.at), formatDateTime(input.at));
  noteChange(changes, 'diagnosis', before.diagnosis, before.diagnosisInk, input.diagnosis, ink.diagnosis);
  cmp('painBefore', before.painBefore, input.painBefore);
  cmp('painAfter', before.painAfter, input.painAfter);
  noteChange(changes, 'comparison', before.comparison, before.comparisonInk, input.comparison, ink.comparison);
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
    cmp(`exercise:${code}:variant`, a?.variant, b?.variant);
    cmp(`exercise:${code}:parts`, a?.parts ?? 'FRM_EPD', b?.parts ?? 'FRM_EPD');
  }
  // home-program: Änderungshistorie der Verordnungen (task 2.4)
  const homeCodes = [...new Set([...old.home, ...next.home].map((h) => h.code))];
  for (const code of homeCodes) {
    const a = old.home.find((h) => h.code === code);
    const b = next.home.find((h) => h.code === code);
    cmp(`home:${code}:timesPerDay`, a?.timesPerDay, b?.timesPerDay);
    cmp(`home:${code}:weekdays`, a?.weekdays, b?.weekdays);
    cmp(`home:${code}:note`, a?.note, b?.note);
  }
  return changes;
}

/** session-form: Sitzung ändern, every change in the history; photos added or hidden. No delete. */
export async function updateConsultation(
  actor: Actor,
  id: string,
  inputWithInk: ConsultationInput & ConsultationInk,
  photoChanges: { add?: PhotoUpload[]; remove?: string[]; handoff?: string[] } = {},
) {
  const { diagnosisInk = KEEP, comparisonInk = KEEP, ...input } = inputWithInk;
  const existing = await getConsultation(id);
  if (!existing) throw new TreatmentError('notFound');
  const ink = {
    diagnosis: resolveInk(existing.diagnosisInk, diagnosisInk, input.diagnosis),
    comparison: resolveInk(existing.comparisonInk, comparisonInk, input.comparison),
  };
  const t = existing.treatment;
  assertSide(t.side, input.sheet);
  await assertCatalog(input.sheet);
  const photos = preparePhotos(await blobFolder(t.patientId), photoChanges.add ?? []);
  await writePhotos(photos);
  const changes = consultationChanges(existing, input, ink);
  // exercise-log (iteration 4, design D8): entries of the patient point to their prescription, which therefore stays
  const keep = new Set(input.sheet.home.map((h) => h.code));
  const removed = existing.home.map((h) => h.exerciseCode).filter((code) => !keep.has(code));
  if (
    removed.length &&
    (await db.exerciseLogEntry.count({ where: { consultationId: id, exerciseCode: { in: removed } } }))
  )
    throw new TreatmentError('prescriptionLogged');
  const { home, ...rows } = sheetRows(input.sheet);
  return db.$transaction(async (tx) => {
    if (changes.length) {
      // Sheet rows are replaced as a whole; the history keeps every single change. Prescriptions are updated in place.
      await tx.consultationPoint.deleteMany({ where: { consultationId: id } });
      await tx.consultationExercise.deleteMany({ where: { consultationId: id } });
      await tx.homePrescription.deleteMany({ where: { consultationId: id, exerciseCode: { in: removed } } });
      for (const h of home.create) {
        const { exerciseCode, ...values } = h;
        await tx.homePrescription.upsert({
          where: { consultationId_exerciseCode: { consultationId: id, exerciseCode } },
          create: { consultationId: id, ...h },
          update: values,
        });
      }
      await tx.consultation.update({
        where: { id },
        data: {
          at: input.at,
          diagnosis: input.diagnosis,
          diagnosisInk: inkColumn(ink.diagnosis),
          painBefore: input.painBefore,
          painAfter: input.painAfter,
          comparison: input.comparison,
          comparisonInk: inkColumn(ink.comparison),
          updatedBy: actor.name,
          ...rows,
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
    await claimHandoffPhotos(tx, actor, photoChanges.handoff ?? [], ctx);
    await removePhotoRows(tx, actor, photoChanges.remove ?? [], ctx);
    return existing;
  });
}
