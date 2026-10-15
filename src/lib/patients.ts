import type { Anamnesis, Patient, PatientStatus, Prisma } from '@prisma/client';
import { db } from './db';
import { audit } from './audit';
import { formatDate, parseSwissDate } from './format';
import { ANAMNESIS_FIELDS, PATIENT_FIELDS, type PatientInput } from './schemas';
import { latestSignedVersion } from '@pain-therapy/shared/signing';
import { currentVersionNumber } from './consent-texts';
import type { Actor } from './session';

export type ConsentStatus = 'signed' | 'pending' | 'resign';

/** Patient data access. Every read of a record and every write goes through here and into the audit log (design D5). */

export function consentStatusOf(latestSignedVersion: number | null | undefined, currentVersion: number): ConsentStatus {
  if (!latestSignedVersion) return 'pending';
  return latestSignedVersion < currentVersion ? 'resign' : 'signed';
}

/**
 * The latest completed signature counts, not the latest PDF (iteration 5, design D2): a signature in the patient zone
 * is valid at once, while the practice app may still be creating its PDF.
 */
const withLatestSignature = {
  signatureSessions: {
    where: { status: 'SIGNED' },
    orderBy: { completedAt: 'desc' },
    take: 1,
    select: { completedAt: true, textVersion: { select: { version: true } } },
  },
} satisfies Prisma.PatientInclude;

export type PatientListItem = Patient & { consent: ConsentStatus };

function decorate<T extends Patient & { signatureSessions: { textVersion: { version: number } }[] }>(
  p: T,
  current: number,
) {
  return { ...p, consent: consentStatusOf(p.signatureSessions[0]?.textVersion.version, current) };
}

/** patient-records: Patientenliste und Suche (name, date of birth or insurance number) */
export async function listPatients(opts: { q?: string; filter?: 'active' | 'inactive' | 'all' } = {}) {
  const where: Prisma.PatientWhereInput = {};
  if (opts.filter !== 'all') where.status = opts.filter === 'inactive' ? 'INACTIVE' : 'ACTIVE';
  const q = opts.q?.trim();
  if (q) {
    const or: Prisma.PatientWhereInput[] = [];
    const dob = parseSwissDate(q);
    if (dob) or.push({ dateOfBirth: dob });
    for (const term of q.split(/\s+/).slice(0, 4)) {
      or.push(
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { insuranceNumber: { contains: term, mode: 'insensitive' } },
      );
    }
    where.OR = or;
  }
  const [rows, current] = await Promise.all([
    db.patient.findMany({
      where,
      include: withLatestSignature,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: 500,
    }),
    currentVersionNumber(),
  ]);
  let result = rows.map((p) => decorate(p, current));
  // With several words ("Anna Müller") every word must match somewhere
  if (q && !parseSwissDate(q)) {
    const terms = q.toLowerCase().split(/\s+/);
    result = result.filter((p) =>
      terms.every((t) => `${p.firstName} ${p.lastName} ${p.insuranceNumber ?? ''}`.toLowerCase().includes(t)),
    );
  }
  return result;
}

export async function dashboardData() {
  const startOfMonth = new Date();
  startOfMonth.setUTCDate(1);
  startOfMonth.setUTCHours(0, 0, 0, 0);
  const [active, current, newThisMonth, recent] = await Promise.all([
    db.patient.findMany({ where: { status: 'ACTIVE' }, include: withLatestSignature, orderBy: { lastName: 'asc' } }),
    currentVersionNumber(),
    db.patient.count({ where: { createdAt: { gte: startOfMonth } } }),
    db.patient.findMany({
      where: { status: 'ACTIVE' },
      include: withLatestSignature,
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);
  const decorated = active.map((p) => decorate(p, current));
  // zone-consent-invitation: remarks of patients on their personal details, until marked as done (design D9)
  const openNotes = await db.signatureSession.findMany({
    where: { status: 'SIGNED', patientNote: { not: null }, noteResolvedAt: null, patient: { status: 'ACTIVE' } },
    orderBy: { completedAt: 'desc' },
    take: 20,
    select: { id: true, patient: { select: { id: true, firstName: true, lastName: true } } },
  });
  return {
    activeCount: active.length,
    newThisMonth,
    pending: decorated.filter((p) => p.consent !== 'signed'),
    recent: recent.map((p) => decorate(p, current)),
    openNotes: openNotes.map((n) => n.patient),
  };
}

export async function findDuplicates(lastName: string, dateOfBirth: Date) {
  return db.patient.findMany({
    where: { lastName: { equals: lastName.trim(), mode: 'insensitive' }, dateOfBirth },
    select: { id: true, firstName: true, lastName: true, dateOfBirth: true, city: true, status: true },
  });
}

/** Loads a record for display and logs the view. */
export async function viewPatient(actor: Actor, id: string) {
  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      anamnesis: true,
      documents: {
        orderBy: { createdAt: 'desc' },
        include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 1 }, session: { include: { consents: true } } },
      },
      signatureSessions: { orderBy: { startedAt: 'desc' }, take: 1 },
    },
  });
  if (!patient) return null;
  await audit(actor, 'patient.viewed', { patientId: id });
  const [current, latest, unresolvedNote, finalizing] = await Promise.all([
    currentVersionNumber(),
    latestSignedVersion(db, id),
    // zone-consent-invitation: Anmerkung zu den Personalien, shown until a user marks it as done (design D9)
    db.signatureSession.findFirst({
      where: { patientId: id, status: 'SIGNED', patientNote: { not: null }, noteResolvedAt: null },
      orderBy: { completedAt: 'desc' },
      select: { id: true, patientNote: true, channel: true, completedAt: true },
    }),
    // Signed, PDF still being created (design D7, D9: "wird erstellt …")
    db.signatureSession.findMany({
      where: { patientId: id, status: 'SIGNED', document: null },
      orderBy: { completedAt: 'desc' },
      select: { id: true, channel: true, completedAt: true, textVersion: { select: { version: true } } },
    }),
  ]);
  return {
    ...patient,
    consent: consentStatusOf(latest, current),
    currentVersion: current,
    unresolvedNote,
    finalizing,
  };
}

export async function getPatient(id: string) {
  return db.patient.findUnique({ where: { id }, include: { anamnesis: true } });
}

export async function historyOf(patientId: string) {
  return db.auditEvent.findMany({
    // Views stay in the audit log but not in "Verlauf"; the same for page views of the patient zone
    where: {
      patientId,
      action: { notIn: ['patient.viewed', 'document.viewed', 'photo.viewed', 'zone.viewed', 'exerciseLog.viewed'] },
    },
    orderBy: { at: 'desc' },
    take: 300,
  });
}

function splitInput(input: PatientInput) {
  const patient: Record<string, unknown> = {};
  const anamnesis: Record<string, unknown> = {};
  for (const k of PATIENT_FIELDS) patient[k] = input[k];
  for (const k of ANAMNESIS_FIELDS) anamnesis[k] = input[k];
  return {
    patient: patient as Omit<Prisma.PatientUncheckedCreateInput, 'createdBy' | 'updatedBy'>,
    anamnesis: anamnesis as Omit<Prisma.AnamnesisUncheckedCreateInput, 'patientId'>,
  };
}

export async function createPatient(actor: Actor, input: PatientInput) {
  const { patient, anamnesis } = splitInput(input);
  return db.$transaction(async (tx) => {
    const created = await tx.patient.create({
      data: { ...patient, createdBy: actor.name, updatedBy: actor.name, anamnesis: { create: anamnesis } },
    });
    await audit(actor, 'patient.created', { patientId: created.id }, tx);
    return created;
  });
}

/** Text form of a field value for the change history. */
export function displayValue(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return formatDate(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'object' && 'toString' in (v as object)) return String(v);
  return String(v);
}

export function diff(
  before: Partial<Patient> & { anamnesis?: Anamnesis | null },
  input: PatientInput,
): { field: string; before: string | null; after: string | null }[] {
  const changes: { field: string; before: string | null; after: string | null }[] = [];
  for (const k of PATIENT_FIELDS) {
    const a = displayValue(before[k as keyof Patient]);
    const b = displayValue(input[k]);
    if (a !== b) changes.push({ field: k, before: a, after: b });
  }
  for (const k of ANAMNESIS_FIELDS) {
    const isBool = typeof input[k] === 'boolean';
    const prev = before.anamnesis?.[k as keyof Anamnesis] ?? (isBool ? false : null);
    const a = displayValue(prev);
    const b = displayValue(input[k]);
    if (a !== b) changes.push({ field: k, before: a, after: b });
  }
  return changes;
}

/** patient-records: Patient ändern, keeping each change with old value, new value, user and time */
export async function updatePatient(actor: Actor, id: string, input: PatientInput) {
  const existing = await db.patient.findUniqueOrThrow({ where: { id }, include: { anamnesis: true } });
  const changes = diff(existing, input);
  if (!changes.length) return existing;
  const { patient, anamnesis } = splitInput(input);
  return db.$transaction(async (tx) => {
    const updated = await tx.patient.update({
      where: { id },
      data: {
        ...patient,
        updatedBy: actor.name,
        anamnesis: { upsert: { create: anamnesis, update: anamnesis } },
      },
    });
    for (const c of changes) await audit(actor, 'patient.updated', { patientId: id, ...c }, tx);
    return updated;
  });
}

export async function setStatus(actor: Actor, id: string, status: PatientStatus, reason?: string | null) {
  return db.$transaction(async (tx) => {
    const p = await tx.patient.findUniqueOrThrow({ where: { id } });
    if (p.status === status) return p;
    const updated = await tx.patient.update({
      where: { id },
      data:
        status === 'INACTIVE'
          ? { status, deactivatedAt: new Date(), deactivationReason: reason || null, updatedBy: actor.name }
          : { status, deactivatedAt: null, deactivationReason: null, updatedBy: actor.name },
    });
    await audit(
      actor,
      status === 'INACTIVE' ? 'patient.deactivated' : 'patient.reactivated',
      { patientId: id, after: status === 'INACTIVE' ? reason || null : null },
      tx,
    );
    return updated;
  });
}

/** Values for the edit form (strings as typed by users). */
export function toFormValues(p: Patient & { anamnesis: Anamnesis | null }): Record<string, string | boolean> {
  const a = p.anamnesis;
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    firstName: p.firstName,
    lastName: p.lastName,
    gender: s(p.gender),
    dateOfBirth: formatDate(p.dateOfBirth),
    preferredLanguage: p.preferredLanguage,
    occupation: s(p.occupation),
    gp: s(p.gp),
    street: s(p.street),
    zip: s(p.zip),
    city: s(p.city),
    phone: s(p.phone),
    mobile: s(p.mobile),
    email: s(p.email),
    emergencyName: s(p.emergencyName),
    emergencyPhone: s(p.emergencyPhone),
    insurer: s(p.insurer),
    insuranceNumber: s(p.insuranceNumber),
    smoker: a?.smoker ?? 'NO',
    smokingYears: s(a?.smokingYears),
    packsPerDay: s(a?.packsPerDay),
    highBloodPressure: !!a?.highBloodPressure,
    highBloodLipids: !!a?.highBloodLipids,
    dizziness: !!a?.dizziness,
    osteoporosis: !!a?.osteoporosis,
    arthrosis: !!a?.arthrosis,
    rheumatism: !!a?.rheumatism,
    orthoOther: !!a?.orthoOther,
    orthoOtherText: s(a?.orthoOtherText),
    cardiovascular: !!a?.cardiovascular,
    diabetes: !!a?.diabetes,
    asthma: !!a?.asthma,
    allergies: !!a?.allergies,
    internalOther: !!a?.internalOther,
    internalOtherText: s(a?.internalOtherText),
    furtherDiagnoses: s(a?.furtherDiagnoses),
    medication: s(a?.medication),
    pregnancy: a?.pregnancy ?? 'NOT_APPLICABLE',
    inTreatment: a?.inTreatment ?? 'NO',
    treatingDoctor: s(a?.treatingDoctor),
  };
}
