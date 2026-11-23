import 'server-only';
import { cache } from 'react';
import { z } from 'zod';
import { runInPractice } from '@pain-therapy/shared/practice-context';
import { rawDb } from './db';
import { audit } from './audit';
import { sendWithRetry } from './mail';
import { config } from './config';
import type { Actor } from './session';

/**
 * practice-plans and platform-statistics (iteration 17, design D5 to D8). Counts run as aggregates over the owner
 * connection and return numbers only, never patient details.
 */

export type Usage = { patients: number; treatments: number; sessions: number };

/**
 * What counts (design D5): a patient once a consent form is signed (also when deactivated later), a treatment once it
 * has a session, a session once saved with a date not in the future. Started records do not count.
 */
export async function usageOf(practiceIds: string[], now = new Date()): Promise<Map<string, Usage>> {
  const out = new Map<string, Usage>(practiceIds.map((id) => [id, { patients: 0, treatments: 0, sessions: 0 }]));
  if (!practiceIds.length) return out;
  const [patients, treatments, sessions] = await Promise.all([
    rawDb.$queryRaw<{ practiceId: string; n: bigint }[]>`
      SELECT "practiceId", COUNT(DISTINCT "patientId") AS n FROM "SignatureSession"
      WHERE status = 'SIGNED' AND "practiceId" = ANY(${practiceIds}) GROUP BY "practiceId"`,
    rawDb.$queryRaw<{ practiceId: string; n: bigint }[]>`
      SELECT t."practiceId", COUNT(*) AS n FROM "Treatment" t
      WHERE t."practiceId" = ANY(${practiceIds})
        AND EXISTS (SELECT 1 FROM "Consultation" c WHERE c."treatmentId" = t.id AND c.at <= ${now})
      GROUP BY t."practiceId"`,
    rawDb.$queryRaw<{ practiceId: string; n: bigint }[]>`
      SELECT "practiceId", COUNT(*) AS n FROM "Consultation"
      WHERE "practiceId" = ANY(${practiceIds}) AND at <= ${now} GROUP BY "practiceId"`,
  ]);
  for (const r of patients) out.get(r.practiceId)!.patients = Number(r.n);
  for (const r of treatments) out.get(r.practiceId)!.treatments = Number(r.n);
  for (const r of sessions) out.get(r.practiceId)!.sessions = Number(r.n);
  return out;
}

/** Read-only actions that are no change (design D6) */
const READ_ONLY = /\.(viewed|shown|printed)$|^signing\.formOpened$/;

/**
 * Last change of each practice by its own members (design D6): records and the practice's audit log without reads and
 * without actions of the platform admin; diary entries of patients in the zone do not count.
 */
export async function lastChangeOf(practiceIds: string[]): Promise<Map<string, Date>> {
  const out = new Map<string, Date>();
  if (!practiceIds.length) return out;
  const rows = await rawDb.$queryRaw<{ practiceId: string; at: Date }[]>`
    SELECT "practiceId", MAX(at) AS at FROM (
      SELECT "practiceId", "updatedAt" AS at FROM "Patient" WHERE "practiceId" = ANY(${practiceIds})
      UNION ALL SELECT "practiceId", "updatedAt" FROM "Treatment" WHERE "practiceId" = ANY(${practiceIds})
      UNION ALL SELECT "practiceId", "updatedAt" FROM "Consultation" WHERE "practiceId" = ANY(${practiceIds})
      UNION ALL SELECT "practiceId", "completedAt" FROM "SignatureSession"
        WHERE "practiceId" = ANY(${practiceIds}) AND "completedAt" IS NOT NULL
      UNION ALL SELECT a."practiceId", a.at FROM "AuditEvent" a
        WHERE a."practiceId" = ANY(${practiceIds})
          AND a."userId" NOT IN ('patient-zone', 'system')
          AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = a."userId" AND u."platformAdmin")
          AND a.action !~ ${READ_ONLY.source}
    ) x GROUP BY "practiceId"`;
  for (const r of rows) if (r.at) out.set(r.practiceId, r.at);
  return out;
}

export type PlanUsage = {
  planId: string;
  planName: string;
  limit: number | null;
  patients: number;
  /** 'ok' below 80 %, 'near' from 80 %, 'reached' at the limit (design D8) */
  state: 'ok' | 'near' | 'reached';
};

export function planState(patients: number, limit: number | null): PlanUsage['state'] {
  if (limit === null) return 'ok';
  if (patients >= limit) return 'reached';
  return patients >= Math.ceil(limit * 0.8) ? 'near' : 'ok';
}

export async function planUsageOf(practiceId: string): Promise<PlanUsage> {
  const p = await rawDb.practice.findUniqueOrThrow({
    where: { id: practiceId },
    select: { plan: { select: { id: true, name: true, patientLimit: true } } },
  });
  const { patients } = (await usageOf([practiceId])).get(practiceId)!;
  return {
    planId: p.plan.id,
    planName: p.plan.name,
    limit: p.plan.patientLimit,
    patients,
    state: planState(patients, p.plan.patientLimit),
  };
}

export class PlanLimitError extends Error {
  constructor(public usage: PlanUsage) {
    super('planLimit');
  }
}

/** Creating a patient is refused at the limit (design D8); existing patients stay fully usable */
export async function assertCanCreatePatient(practiceId: string) {
  const usage = await planUsageOf(practiceId);
  if (usage.state === 'reached') throw new PlanLimitError(usage);
  return usage;
}

/**
 * One mail to the platform admins when a practice reaches its limit (design D8). Called after a signature; the mark
 * is reset on a plan change. Never throws: a failed mail must not affect the signed document.
 */
export async function notifyLimitReached(practiceId: string) {
  try {
    const usage = await planUsageOf(practiceId);
    if (usage.state !== 'reached') return false;
    const claimed = await rawDb.practice.updateMany({
      where: { id: practiceId, limitNotifiedAt: null },
      data: { limitNotifiedAt: new Date() },
    });
    if (!claimed.count) return false;
    const [practice, admins] = await Promise.all([
      rawDb.practice.findUniqueOrThrow({ where: { id: practiceId }, select: { name: true } }),
      rawDb.user.findMany({ where: { platformAdmin: true, activatedAt: { not: null } }, select: { email: true } }),
    ]);
    for (const a of admins)
      await sendWithRetry({
        to: a.email,
        subject: `${practice.name} hat die ${usage.planName}-Limite erreicht`,
        text: `${practice.name} hat die ${usage.planName}-Limite (${usage.limit} Patient:innen) erreicht.\n\nModell ändern: ${config.auth.appUrl}/platform`,
        bold: [practice.name],
      });
    return true;
  } catch (e) {
    console.error('notifyLimitReached', e);
    return false;
  }
}

// ---- Plan management (platform admin) ----

export class PlanError extends Error {
  constructor(public code: 'nameTaken' | 'inUse' | 'notFound') {
    super(code);
  }
}

export const planSchema = z.object({
  name: z.string().trim().min(1, 'required').max(60, 'tooLong'),
  patientLimit: z
    .string()
    .trim()
    .regex(/^(\d{1,6})?$/, 'number')
    .transform((v) => (v === '' ? null : Number(v))),
});
export type PlanInput = z.infer<typeof planSchema>;

export async function listPlans() {
  const plans = await rawDb.plan.findMany({
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { practices: { where: { deletedAt: null } } } } },
  });
  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    patientLimit: p.patientLimit,
    active: p.active,
    practices: p._count.practices,
  }));
}

const slugOf = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'plan';

export async function createPlan(input: PlanInput) {
  if (await rawDb.plan.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } } }))
    throw new PlanError('nameTaken');
  let id = slugOf(input.name);
  for (let i = 2; await rawDb.plan.findUnique({ where: { id } }); i++) id = `${slugOf(input.name)}-${i}`;
  const max = await rawDb.plan.aggregate({ _max: { sortOrder: true } });
  return rawDb.plan.create({
    data: { id, name: input.name, patientLimit: input.patientLimit, sortOrder: (max._max.sortOrder ?? 0) + 10 },
  });
}

export async function updatePlan(id: string, input: PlanInput) {
  const clash = await rawDb.plan.findFirst({
    where: { name: { equals: input.name, mode: 'insensitive' }, id: { not: id } },
  });
  if (clash) throw new PlanError('nameTaken');
  const r = await rawDb.plan.updateMany({
    where: { id },
    data: { name: input.name, patientLimit: input.patientLimit },
  });
  if (!r.count) throw new PlanError('notFound');
  // A higher limit may lift a reached state: the next reach mails again
  await rawDb.practice.updateMany({ where: { planId: id }, data: { limitNotifiedAt: null } });
}

/** Deactivates a plan no practice uses, or activates it again */
export async function setPlanActive(id: string, active: boolean) {
  if (!active) {
    const used = await rawDb.practice.count({ where: { planId: id, deletedAt: null } });
    if (used) throw new PlanError('inUse');
  }
  const r = await rawDb.plan.updateMany({ where: { id }, data: { active } });
  if (!r.count) throw new PlanError('notFound');
}

/** Assigns a plan to a practice; logged in the practice's audit log (design D7) */
export async function setPracticePlan(actor: Actor, practiceId: string, planId: string) {
  const [practice, plan] = await Promise.all([
    rawDb.practice.findUnique({ where: { id: practiceId }, select: { id: true, planId: true, deletedAt: true } }),
    rawDb.plan.findUnique({ where: { id: planId } }),
  ]);
  if (!practice || practice.deletedAt || !plan || !plan.active) throw new PlanError('notFound');
  if (practice.planId === planId) return false;
  await rawDb.practice.update({
    where: { id: practiceId },
    data: { planId, planChangedAt: new Date(), planChangedBy: actor.name, limitNotifiedAt: null },
  });
  await runInPractice(practiceId, () =>
    audit(actor, 'practice.planChanged', { before: practice.planId, after: planId }),
  );
  return true;
}

/** Plan and usage of the practice of this request, once per request; null without a practice */
export const currentPlanUsage = cache(async (): Promise<PlanUsage | null> => {
  const { currentPracticeId } = await import('./practice');
  const id = await currentPracticeId();
  return id ? planUsageOf(id) : null;
});
