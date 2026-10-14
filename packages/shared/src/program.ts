import type { PrismaClient } from '@prisma/client';
import { DAY_MS } from './time';
import type { Repetition } from './home-program';

/**
 * patient-access and exercise-log: das aktuelle Heimprogramm (iteration 4, design D2). The prescriptions of the most
 * recent consultation with at least one prescription, over all treatments of the patient. Active while that
 * consultation is at most 12 weeks old (confirmed by the practice on 14.10.2026) and the patient is active.
 */
export const PROGRAM_ACTIVE_WEEKS = 12;

export function programActive(consultationAt: Date, now = new Date()): boolean {
  return now.getTime() - consultationAt.getTime() <= PROGRAM_ACTIVE_WEEKS * 7 * DAY_MS;
}

export type CurrentProgram = {
  consultationId: string;
  consultationAt: Date;
  prescriptions: { exerciseCode: string; repetition: Repetition }[];
  active: boolean;
};

/**
 * Loads the current home program. Selects only the columns the role patient_zone may read
 * (prisma/patient-zone-role.sql), so the practice app and the patient zone share this query.
 */
export async function currentProgram(
  db: Pick<PrismaClient, 'consultation'>,
  patientId: string,
  now = new Date(),
): Promise<CurrentProgram | null> {
  const c = await db.consultation.findFirst({
    where: { treatment: { patientId }, home: { some: {} } },
    orderBy: [{ at: 'desc' }, { id: 'desc' }],
    select: { id: true, at: true, home: { select: { exerciseCode: true, repetition: true } } },
  });
  if (!c) return null;
  return {
    consultationId: c.id,
    consultationAt: c.at,
    prescriptions: c.home.map((h) => ({ exerciseCode: h.exerciseCode, repetition: h.repetition as Repetition })),
    active: programActive(c.at, now),
  };
}
