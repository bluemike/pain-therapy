import type { Language } from '@prisma/client';
import { openToday, progress } from '@pain-therapy/shared/adherence';
import { executionTime, withVariant } from '@pain-therapy/shared/home-program';
import {
  dayReference,
  editable,
  logEntryFormSchema,
  performedAtProblem,
  type LogEntryInput,
} from '@pain-therapy/shared/log-entry';
import { zurichInputs } from '@pain-therapy/shared/time';
import { db } from './db';
import { zoneAudit } from './audit';
import type { ProgramSession } from './access';

/**
 * exercise-log: Heimprogramm, Ausführung erfassen, Schnelleintrag und Korrektur (iteration 4, design D7, D8), with the
 * day selection and the entries of the whole program of iteration 6 (zone-exercise-backfill, design D7). Every
 * function works for the patient of the session only.
 */

const ENTRY = {
  id: true,
  consultationId: true,
  exerciseCode: true,
  performedAt: true,
  done: true,
  rating: true,
  note: true,
  quick: true,
  createdAt: true,
  correctedAt: true,
  deletedAt: true,
} as const;

/** FRM and EPD texts of an exercise sheet (iteration 8, design D2), as written by catalog:sync */
export type Segments = {
  frm: { items: { n: number[]; text: string }[] };
  standard: { intro: string | null; steps: { label: string; text: string }[]; note: string | null };
  variants: { intro: string | null; items: { number: number; text: string }[] };
};

/**
 * The exercises of the current program with name, image, schedule, EPD, duration and progress on the day of `ref`
 * ("Heute" with now, a past day with dayReference()). Since iteration 8 (design D8) only the selected weekdays
 * have a target; with the guide of FRM and the chosen EPD.
 */
export async function today(s: ProgramSession, ref = new Date()) {
  const codes = s.program.prescriptions.map((p) => p.exerciseCode);
  const [exercises, entries] = await Promise.all([
    db.exercise.findMany({
      where: { code: { in: codes } },
      select: {
        code: true,
        nameDe: true,
        nameEn: true,
        sheet: {
          select: {
            mainImage: true,
            stretchSecondsPerSide: true,
            sides: true,
            rollingSeconds: true,
            segments: true,
            rollingTools: true,
            standardAids: true,
          },
        },
        epdVariants: { where: { retiredAt: null }, select: { number: true, aids: true, seconds: true } },
      },
    }),
    db.exerciseLogEntry.findMany({
      where: { patientId: s.patient.id, consultationId: s.program.consultationId, deletedAt: null },
      select: { exerciseCode: true, performedAt: true, done: true, rating: true },
    }),
  ]);
  const items = s.program.prescriptions.map((p) => {
    const x = exercises.find((e) => e.code === p.exerciseCode);
    const variant = p.variant ? x?.epdVariants.find((v) => v.number === p.variant) : undefined;
    return {
      code: p.exerciseCode,
      name: x ? nameIn(x, s.patient.preferredLanguage) : p.exerciseCode,
      schedule: p.schedule,
      variant: p.variant,
      hasImage: !!x?.sheet?.mainImage,
      seconds: executionTime(withVariant(x?.sheet ?? null, variant?.seconds)).seconds,
      progress: progress(p, entries, ref),
      guide: x?.sheet
        ? {
            segments: (x.sheet.segments ?? null) as Segments | null,
            tools: x.sheet.rollingTools,
            aids: variant ? variant.aids : x.sheet.standardAids,
          }
        : null,
    };
  });
  return { items, open: openToday(s.program.prescriptions, entries, ref) };
}

export const nameIn = (x: { nameDe: string; nameEn: string }, language: Language) =>
  language === 'en' ? x.nameEn : x.nameDe;

/** Entries of the whole current program, newest first, with the names of the exercises (design D7) */
export async function recentEntries(s: ProgramSession, now = new Date()) {
  const rows = await db.exerciseLogEntry.findMany({
    where: { patientId: s.patient.id, consultationId: s.program.consultationId, deletedAt: null },
    orderBy: [{ performedAt: 'desc' }, { createdAt: 'desc' }],
    select: { ...ENTRY, prescription: { select: { exercise: { select: { nameDe: true, nameEn: true } } } } },
  });
  return rows.map((e) => ({
    ...e,
    name: nameIn(e.prescription.exercise, s.patient.preferredLanguage),
    editable: editable(e.createdAt, now),
    inputs: zurichInputs(e.performedAt),
  }));
}

export type EntryError =
  | 'error'
  | 'doneRequired'
  | 'ratingRange'
  | 'ratingRequired'
  | 'ratingWithoutDone'
  | 'noteTooLong'
  | 'dateInvalid'
  | 'future'
  | 'beforeConsultation'
  | 'notEditable';

/** Reads the entry form; "gemacht: nein" drops a rating chosen before (the form hides it) */
export function parseEntryForm(fd: FormData): { ok: true; data: LogEntryInput } | { ok: false; error: EntryError } {
  const done = String(fd.get('done') ?? '');
  const parsed = logEntryFormSchema.safeParse({
    code: String(fd.get('code') ?? ''),
    done,
    rating: done === 'no' ? '' : String(fd.get('rating') ?? ''),
    date: String(fd.get('date') ?? ''),
    time: String(fd.get('time') ?? ''),
    note: String(fd.get('note') ?? ''),
  });
  if (!parsed.success) return { ok: false, error: (parsed.error.issues[0]?.message ?? 'error') as EntryError };
  return { ok: true, data: parsed.data };
}

/** Language-neutral summary of an entry for the audit log: "13.10.2026 20:30 · ✓ · 7/10 · «note»" */
export function summary(e: { performedAt: Date; done: boolean; rating: number | null; note: string | null }) {
  const { date, time } = zurichInputs(e.performedAt);
  const [y, m, d] = date.split('-');
  return [
    `${d}.${m}.${y} ${time}`,
    e.done ? '✓' : '–',
    e.rating ? `${e.rating}/10` : null,
    e.note ? `«${e.note}»` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Ausführung erfassen for an exercise of the current program */
export async function createEntry(
  s: ProgramSession,
  input: LogEntryInput,
  now = new Date(),
): Promise<EntryError | null> {
  if (!s.program.prescriptions.some((p) => p.exerciseCode === input.code)) return 'error';
  const problem = performedAtProblem(input.performedAt, s.program.consultationAt, now);
  if (problem) return problem;
  await db.$transaction(async (tx) => {
    const e = await tx.exerciseLogEntry.create({
      data: {
        patientId: s.patient.id,
        consultationId: s.program.consultationId,
        exerciseCode: input.code,
        sessionId: s.session.id,
        performedAt: input.performedAt,
        done: input.done,
        rating: input.rating,
        note: input.note,
        createdAt: now,
      },
      select: ENTRY,
    });
    await zoneAudit(
      'exerciseLog.created',
      {
        patientId: s.patient.id,
        linkId: s.session.linkId,
        after: summary(e),
        details: { entryId: e.id, exerciseCode: e.exerciseCode },
      },
      tx,
    );
  });
  return null;
}

/**
 * "Alle heutigen Übungen erledigt", or for a chosen past day "Alle Übungen dieses Tages erledigt" (design D7): the open
 * executions of the daily exercises of that day as done, without rating, at now for today and at 12:00 (on the day
 * of the consultation its time) for a past day. Entries already recorded stay unchanged.
 */
export async function quickEntry(s: ProgramSession, now = new Date(), day?: string) {
  const at = day ? dayReference(day, s.program.consultationAt, now) : now;
  if (performedAtProblem(at, s.program.consultationAt, now)) return 0;
  const entries = await db.exerciseLogEntry.findMany({
    where: { patientId: s.patient.id, consultationId: s.program.consultationId, deletedAt: null },
    select: { exerciseCode: true, performedAt: true, done: true, rating: true },
  });
  const open = openToday(s.program.prescriptions, entries, at);
  let count = 0;
  await db.$transaction(async (tx) => {
    for (const o of open)
      for (let i = 0; i < o.count; i++) {
        const e = await tx.exerciseLogEntry.create({
          data: {
            patientId: s.patient.id,
            consultationId: s.program.consultationId,
            exerciseCode: o.exerciseCode,
            sessionId: s.session.id,
            performedAt: at,
            done: true,
            quick: true,
            createdAt: now,
          },
          select: ENTRY,
        });
        await zoneAudit(
          'exerciseLog.created',
          {
            patientId: s.patient.id,
            linkId: s.session.linkId,
            after: summary(e),
            details: { entryId: e.id, exerciseCode: e.exerciseCode, quick: true },
          },
          tx,
        );
        count++;
      }
  });
  return count;
}

/** An own entry that may still be changed (recorded less than 24 hours ago, not deleted) */
async function ownEditable(s: ProgramSession, id: string, now: Date) {
  const e = await db.exerciseLogEntry.findFirst({
    where: { id, patientId: s.patient.id, deletedAt: null },
    select: { ...ENTRY, prescription: { select: { consultation: { select: { at: true } } } } },
  });
  return e && editable(e.createdAt, now) ? e : null;
}

/** Korrektur innerhalb von 24 Stunden, with before and after in the audit log */
export async function correctEntry(
  s: ProgramSession,
  id: string,
  input: LogEntryInput,
  now = new Date(),
): Promise<EntryError | null> {
  const e = await ownEditable(s, id, now);
  if (!e || e.exerciseCode !== input.code) return 'notEditable';
  const problem = performedAtProblem(input.performedAt, e.prescription.consultation.at, now);
  if (problem) return problem;
  await db.$transaction(async (tx) => {
    const after = await tx.exerciseLogEntry.update({
      where: { id },
      data: {
        performedAt: input.performedAt,
        done: input.done,
        rating: input.rating,
        note: input.note,
        correctedAt: now,
      },
      select: ENTRY,
    });
    await zoneAudit(
      'exerciseLog.corrected',
      {
        patientId: s.patient.id,
        linkId: s.session.linkId,
        before: summary(e),
        after: summary(after),
        details: { entryId: id, exerciseCode: e.exerciseCode },
      },
      tx,
    );
  });
  return null;
}

/** Löschen innerhalb von 24 Stunden: only marks the entry as deleted; it stays in the database */
export async function deleteEntry(s: ProgramSession, id: string, now = new Date()): Promise<EntryError | null> {
  const e = await ownEditable(s, id, now);
  if (!e) return 'notEditable';
  await db.$transaction(async (tx) => {
    await tx.exerciseLogEntry.update({ where: { id }, data: { deletedAt: now }, select: { id: true } });
    await zoneAudit(
      'exerciseLog.deleted',
      {
        patientId: s.patient.id,
        linkId: s.session.linkId,
        before: summary(e),
        details: { entryId: id, exerciseCode: e.exerciseCode },
      },
      tx,
    );
  });
  return null;
}

/** The image bands of FRM, Standardübung and Varianten (iteration 8, design D2) */
export const BANDS = ['frm', 'std', 'var'] as const;
export type Band = (typeof BANDS)[number];

/**
 * Image of an exercise of the current program only (Nur das eigene Heimprogramm): the main image or, since iteration
 * 8, the FRM band and the band of the prescribed EPD (Standardübung or Varianten)
 */
export async function mainImageOf(s: ProgramSession, code: string, band?: Band) {
  const p = s.program.prescriptions.find((x) => x.exerciseCode === code);
  if (!p) return null;
  if (band === 'std' && p.variant) return null;
  if (band === 'var' && !p.variant) return null;
  const sheet = await db.exerciseSheet.findUnique({ where: { exerciseCode: code }, select: { mainImage: true } });
  if (!sheet) return null;
  return band ? `${code}-${band}.png` : sheet.mainImage;
}
