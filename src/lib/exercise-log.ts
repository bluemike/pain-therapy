import { adherence, type Adherence } from '@pain-therapy/shared/adherence';
import { PROGRAM_ACTIVE_WEEKS, currentProgram, programActive } from '@pain-therapy/shared/program';
import { signatureStateOf } from '@pain-therapy/shared/signing';
import type { Repetition } from '@pain-therapy/shared/home-program';
import { DAY_MS } from '@pain-therapy/shared/time';
import { db } from './db';
import { audit } from './audit';
import { latestLinkOf, linkStatusOf, type LinkStatus } from './patient-access';
import type { Actor } from './session';

/**
 * adherence-overview: Kachel "Heimprogramm" and Reiter "Übungstagebuch" (iteration 4, design D10). The practice
 * only reads the entries of the patient; nothing here changes them.
 */

/** Entries shown in the tab, newest first */
const ENTRIES_SHOWN = 200;

/** Reiter "Übungstagebuch": adherence of the current program, all entries and the link status. Opening is logged. */
export async function exerciseLogOf(actor: Actor, patientId: string, now = new Date()) {
  const patient = await db.patient.findUniqueOrThrow({ where: { id: patientId }, select: { status: true } });
  const program = await currentProgram(db, patientId, now);
  const [consultation, entries, link, signature] = await Promise.all([
    program
      ? db.consultation.findUnique({
          where: { id: program.consultationId },
          select: {
            id: true,
            number: true,
            at: true,
            treatmentId: true,
            treatment: { select: { region: { select: { id: true, nameDe: true, nameEn: true } } } },
            home: { include: { exercise: { select: { code: true, nameDe: true, nameEn: true } } } },
            exercises: { select: { exerciseCode: true } },
          },
        })
      : null,
    db.exerciseLogEntry.findMany({
      where: { patientId },
      orderBy: { performedAt: 'desc' },
      take: ENTRIES_SHOWN,
      include: { prescription: { include: { exercise: { select: { nameDe: true, nameEn: true } } } } },
    }),
    latestLinkOf(patientId),
    signatureStateOf(db, patientId),
  ]);
  await audit(actor, 'exerciseLog.viewed', { patientId });
  const active = patient.status === 'ACTIVE' && !!program?.active;
  // In the order of the treatment form, like the exercise sheet
  const order = (code: string) => consultation?.exercises.findIndex((x) => x.exerciseCode === code) ?? 0;
  const prescriptions = [...(consultation?.home ?? [])].sort((a, b) => order(a.exerciseCode) - order(b.exerciseCode));
  return {
    program: program && consultation ? { ...program, consultation, prescriptions } : null,
    active,
    adherence:
      program && consultation
        ? adherence(
            prescriptions.map((p) => ({ exerciseCode: p.exerciseCode, repetition: p.repetition as Repetition })),
            entries.filter((e) => e.consultationId === program.consultationId),
            program.consultationAt,
            now,
          )
        : null,
    entries,
    link,
    linkStatus: linkStatusOf(
      link,
      // A pending signature also keeps the link valid (iteration 5, design D4)
      { patientActive: patient.status === 'ACTIVE', purposeActive: !!program?.active || signature.pending },
      now,
    ),
  };
}

export type HomeProgramRow = {
  patient: { id: string; firstName: string; lastName: string };
  adherence: Adherence;
  linkStatus: LinkStatus;
};

/**
 * Kachel "Heimprogramm": all active patients with an active home program, flagged patients first, then by name. The
 * current program is the newest consultation with prescriptions, which is among those of the last 12 weeks.
 */
export async function homeProgramOverview(now = new Date()): Promise<HomeProgramRow[]> {
  const since = new Date(now.getTime() - PROGRAM_ACTIVE_WEEKS * 7 * DAY_MS);
  const consultations = await db.consultation.findMany({
    where: { at: { gte: since }, home: { some: {} }, treatment: { patient: { status: 'ACTIVE' } } },
    orderBy: [{ at: 'desc' }, { id: 'desc' }],
    select: {
      id: true,
      at: true,
      home: { select: { exerciseCode: true, repetition: true } },
      treatment: { select: { patient: { select: { id: true, firstName: true, lastName: true } } } },
    },
  });
  const current = new Map<string, (typeof consultations)[number]>();
  for (const c of consultations)
    if (!current.has(c.treatment.patient.id) && programActive(c.at, now)) current.set(c.treatment.patient.id, c);
  if (!current.size) return [];
  const ids = [...current.values()].map((c) => c.id);
  const [entries, links] = await Promise.all([
    db.exerciseLogEntry.findMany({
      where: { consultationId: { in: ids } },
      select: {
        consultationId: true,
        exerciseCode: true,
        performedAt: true,
        done: true,
        rating: true,
        deletedAt: true,
      },
    }),
    db.patientAccessLink.findMany({
      where: { patientId: { in: [...current.keys()] } },
      orderBy: { createdAt: 'desc' },
      include: { deliveries: { orderBy: { createdAt: 'desc' } } },
    }),
  ]);
  const rows = [...current.values()].map((c) => {
    const patient = c.treatment.patient;
    const link = links.find((l) => l.patientId === patient.id) ?? null;
    return {
      patient,
      adherence: adherence(
        c.home.map((h) => ({ exerciseCode: h.exerciseCode, repetition: h.repetition as Repetition })),
        entries.filter((e) => e.consultationId === c.id),
        c.at,
        now,
      ),
      linkStatus: linkStatusOf(link, { patientActive: true, purposeActive: true }, now),
    };
  });
  return rows.sort(
    (a, b) =>
      Number(!a.adherence.flags.length) - Number(!b.adherence.flags.length) ||
      a.patient.lastName.localeCompare(b.patient.lastName, 'de') ||
      a.patient.firstName.localeCompare(b.patient.firstName, 'de'),
  );
}
