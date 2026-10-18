import type { PrismaClient } from '@prisma/client';
import { DAY_MS } from './time';
import type { Schedule } from './home-program';

/**
 * patient-access and exercise-log: das aktuelle Heimprogramm (iteration 4, design D2), since iteration 9 one per
 * treatment. Active while its consultation is at most 12 weeks old (confirmed by the practice on 14.10.2026) and the patient is active.
 */
export const PROGRAM_ACTIVE_WEEKS = 12;

export function programActive(consultationAt: Date, now = new Date()): boolean {
  return now.getTime() - consultationAt.getTime() <= PROGRAM_ACTIVE_WEEKS * 7 * DAY_MS;
}

export type CurrentProgram = {
  consultationId: string;
  consultationAt: Date;
  /** The treatment of the consultation and its pain area, the title in the patient zone (iteration 9, design D8) */
  treatmentId: string;
  region: { code: string; nameDe: string; nameEn: string };
  prescriptions: { exerciseCode: string; schedule: Schedule; variant: number | null }[];
  active: boolean;
};

/**
 * Home programs per treatment (iteration 9, design D8): for each treatment the prescriptions of its latest
 * consultation with at least one prescription, newest first. "Neueste Verordnung gewinnt" holds within a treatment
 * only. Selects only the columns the role patient_zone may read (prisma/patient-zone-role.sql), so the practice app
 * and the patient zone share this query.
 */
export async function currentPrograms(
  db: Pick<PrismaClient, 'consultation'>,
  patientId: string,
  now = new Date(),
): Promise<CurrentProgram[]> {
  const rows = await db.consultation.findMany({
    where: { treatment: { patientId }, home: { some: {} } },
    orderBy: [{ at: 'desc' }, { id: 'desc' }],
    distinct: ['treatmentId'],
    select: {
      id: true,
      at: true,
      treatmentId: true,
      treatment: { select: { region: { select: { code: true, nameDe: true, nameEn: true } } } },
      // In the order of the catalog (1A to 4G), like the paper form; the database order alone is not stable
      home: {
        select: { exerciseCode: true, timesPerDay: true, weekdays: true, variant: true },
        orderBy: { exercise: { sort: 'asc' } },
      },
    },
  });
  return rows.map((c) => ({
    consultationId: c.id,
    consultationAt: c.at,
    treatmentId: c.treatmentId,
    region: c.treatment.region,
    prescriptions: c.home.map((h) => ({
      exerciseCode: h.exerciseCode,
      schedule: { timesPerDay: h.timesPerDay, weekdays: h.weekdays },
      variant: h.variant,
    })),
    active: programActive(c.at, now),
  }));
}

/**
 * The newest home program over all treatments (iteration 4): the link status, the cockpit and the practice's diary
 * tab. Its activity decides whether any program is active, as the newest one is the youngest.
 */
export async function currentProgram(
  db: Pick<PrismaClient, 'consultation'>,
  patientId: string,
  now = new Date(),
): Promise<CurrentProgram | null> {
  return (await currentPrograms(db, patientId, now))[0] ?? null;
}
