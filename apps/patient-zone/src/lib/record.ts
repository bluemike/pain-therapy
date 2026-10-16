import type { Language, Repetition } from '@prisma/client';
import { db } from './db';
import { nameIn } from './entries';
import type { ZoneSession } from './access';

/**
 * zone-record and zone-documents (iteration 6, design D4, D5): the patient's own treatments, consultations and
 * documents, read only. Every query filters by the patient of the device session; an id of another patient is
 * treated like an unknown one. Selects only the columns the role patient_zone may read (prisma/patient-zone-role.sql):
 * no photos, anamnesis, staff names, archive paths or deliveries.
 */

const region = { select: { id: true, nameDe: true, nameEn: true } } as const;

/** "Behandlungen": newest first, with the number and date of the last consultation */
export async function treatmentsOf(s: ZoneSession) {
  const rows = await db.treatment.findMany({
    where: { patientId: s.patient.id },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      startedAt: true,
      diagnosis: true,
      painStart: true,
      region,
      consultations: { select: { at: true }, orderBy: { at: 'desc' } },
    },
  });
  const lang = s.patient.preferredLanguage;
  return rows.map((t) => ({
    id: t.id,
    startedAt: t.startedAt,
    region: nameIn(t.region, lang),
    diagnosis: t.diagnosis,
    painStart: t.painStart,
    consultations: t.consultations.length,
    lastAt: t.consultations[0]?.at ?? null,
  }));
}

export type ZoneConsultation = {
  id: string;
  number: number;
  at: Date;
  diagnosis: string;
  painBefore: number | null;
  painAfter: number | null;
  comparison: string | null;
  points: { id: string; name: string; left: boolean; right: boolean }[];
  exercises: { code: string; name: string }[];
  rolling: { area: string | null; tool: string | null }[];
  home: { code: string; repetition: Repetition }[];
  /** Current (newest) exercise sheet of the consultation */
  sheet: string | null;
};

/** One treatment with all consultations, newest first; null for an unknown id or one of another patient */
export async function treatmentOf(s: ZoneSession, id: string) {
  const t = await db.treatment.findFirst({
    where: { id, patientId: s.patient.id },
    select: {
      id: true,
      startedAt: true,
      diagnosis: true,
      painStart: true,
      region,
      consultations: {
        orderBy: { number: 'desc' },
        select: {
          id: true,
          number: true,
          at: true,
          diagnosis: true,
          painBefore: true,
          painAfter: true,
          comparison: true,
          points: {
            select: {
              left: true,
              right: true,
              point: { select: { id: true, attachmentDe: true, muscleAttachmentLatin: true, sort: true } },
            },
          },
          exercises: { select: { exercise: { select: { code: true, nameDe: true, nameEn: true, sort: true } } } },
          rolling: {
            orderBy: { position: 'asc' },
            select: { area: true, tool: { select: { nameDe: true, nameEn: true } } },
          },
          home: {
            orderBy: { exercise: { sort: 'asc' } },
            select: { exerciseCode: true, repetition: true },
          },
          handouts: {
            where: { patientId: s.patient.id },
            orderBy: { version: 'desc' },
            take: 1,
            select: { documentNumber: true },
          },
        },
      },
    },
  });
  if (!t) return null;
  const lang = s.patient.preferredLanguage;
  const consultations: ZoneConsultation[] = t.consultations.map((c) => ({
    id: c.id,
    number: c.number,
    at: c.at,
    diagnosis: c.diagnosis,
    painBefore: c.painBefore,
    painAfter: c.painAfter,
    comparison: c.comparison,
    points: c.points
      .sort((a, b) => a.point.sort - b.point.sort)
      .map((p) => ({ id: p.point.id, name: pointName(p.point, lang), left: p.left, right: p.right })),
    exercises: c.exercises
      .map((x) => x.exercise)
      .sort((a, b) => a.sort - b.sort)
      .map((x) => ({ code: x.code, name: nameIn(x, lang) })),
    rolling: c.rolling
      .filter((r) => r.area || r.tool)
      .map((r) => ({ area: r.area, tool: r.tool ? nameIn(r.tool, lang) : null })),
    home: c.home.map((h) => ({ code: h.exerciseCode, repetition: h.repetition })),
    sheet: c.handouts[0]?.documentNumber ?? null,
  }));
  return {
    id: t.id,
    startedAt: t.startedAt,
    region: nameIn(t.region, lang),
    diagnosis: t.diagnosis,
    painStart: t.painStart,
    consultations,
  };
}

/** The catalog has the attachment only in German; the Latin name serves English-speaking patients */
const pointName = (p: { attachmentDe: string; muscleAttachmentLatin: string }, lang: Language) =>
  lang === 'en' ? p.muscleAttachmentLatin : p.attachmentDe;

/**
 * "Dokumente": signed disclaimers (with signatures still being turned into a PDF) and exercise sheets, newest first.
 * The newest version of the sheet of a consultation is the current one.
 */
export async function documentsOf(s: ZoneSession) {
  const patientId = s.patient.id;
  const [signed, pending, sheets] = await Promise.all([
    db.signedDocument.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      select: {
        documentNumber: true,
        textVersion: true,
        createdAt: true,
        session: { select: { channel: true, completedAt: true } },
      },
    }),
    // Signed, the PDF not yet created (design D4: "wird erstellt")
    db.signatureSession.findMany({
      where: { patientId, status: 'SIGNED', document: null },
      orderBy: { completedAt: 'desc' },
      select: { id: true, completedAt: true },
    }),
    db.exerciseHandout.findMany({
      where: { patientId },
      orderBy: [{ createdAt: 'desc' }, { version: 'desc' }],
      select: {
        documentNumber: true,
        consultationId: true,
        version: true,
        createdAt: true,
        consultation: { select: { number: true, at: true } },
      },
    }),
  ]);
  const newest = new Map<string, number>();
  for (const h of sheets) newest.set(h.consultationId, Math.max(newest.get(h.consultationId) ?? 0, h.version));
  return {
    disclaimers: signed.map((d) => ({
      documentNumber: d.documentNumber,
      textVersion: d.textVersion,
      date: d.session.completedAt ?? d.createdAt,
      channel: d.session.channel,
    })),
    pending: pending.map((p) => ({ id: p.id, date: p.completedAt })),
    sheets: sheets.map((h) => ({
      documentNumber: h.documentNumber,
      consultation: h.consultation.number,
      version: h.version,
      date: h.createdAt,
      current: newest.get(h.consultationId) === h.version,
    })),
  };
}

/** A document of the patient by its number, or null (also for a number of another patient) */
export async function documentOf(s: ZoneSession, documentNumber: string) {
  if (!/^[A-Z]{2}-\d{4}-\d{5,}$/.test(documentNumber)) return null;
  const where = { documentNumber, patientId: s.patient.id };
  const [signed, sheet] = await Promise.all([
    db.signedDocument.findFirst({ where, select: { documentNumber: true, patientId: true } }),
    db.exerciseHandout.findFirst({ where, select: { documentNumber: true, patientId: true } }),
  ]);
  const doc = signed ?? sheet;
  return doc ? { documentNumber: doc.documentNumber, path: `${doc.patientId}/${doc.documentNumber}.pdf` } : null;
}
