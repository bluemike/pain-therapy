import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { db, rawDb } from '@/lib/db';
import { createPatient } from '@/lib/patients';
import { currentVersionNumber, publishVersion, templateOffered, unknownFieldsOf } from '@/lib/consent-texts';
import { EMPTY_PATIENT, patientSchema } from '@/lib/schemas';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import {
  assertCanCreatePatient,
  createPlan,
  lastChangeOf,
  listPlans,
  notifyLimitReached,
  planState,
  planUsageOf,
  setPlanActive,
  setPracticePlan,
  updatePlan,
  usageOf,
} from '@/lib/plans';
import { practicesOverview } from '@/lib/platform';
import type { Actor } from '@/lib/session';
import { syncCatalog } from '../../prisma/catalog/sync.mjs';
import { resetDatabase } from './db-reset';
import { TEST_PRACTICE_ID } from './test-practice';

/** Iteration 17: plans with a patient limit (design D7, D8), usage per practice (D5, D6), template offer (D3) */

const actor: Actor = { id: 'u-plan', name: 'Chrissie Franz', email: 'c@example.ch', roles: ['THERAPIST'] };
const platform: Actor = { id: 'u-platform', name: 'Plattform', email: 'admin@example.test', roles: [] };
const sent: OutgoingMail[] = [];

const patientInput = (n: number) =>
  patientSchema.parse({
    ...Object.fromEntries(Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? '' : v])),
    firstName: 'Anna',
    lastName: `Plan${n}`,
    dateOfBirth: '05.03.1980',
    email: `plan${n}@example.ch`,
  });

async function sign(patientId: string) {
  const version = await currentVersionNumber();
  const text = await db.consentTextVersion.findFirstOrThrow({ where: { version, language: 'de' } });
  await db.signatureSession.create({
    data: { patientId, textVersionId: text.id, language: 'de', status: 'SIGNED', startedBy: actor.name },
  });
}

async function treatment(patientId: string, sessionsAt: Date[]) {
  const region = await db.region.findFirstOrThrow();
  const t = await db.treatment.create({
    data: {
      patientId,
      startedAt: new Date('2026-11-01T10:00:00Z'),
      regionId: region.id,
      diagnosis: 'Test',
      painStart: 50,
      createdBy: actor.name,
      updatedBy: actor.name,
    },
  });
  for (const [i, at] of sessionsAt.entries())
    await db.consultation.create({
      data: { treatmentId: t.id, number: i + 1, at, diagnosis: '', createdBy: actor.name, updatedBy: actor.name },
    });
  return t;
}

beforeAll(async () => {
  await resetDatabase();
  await syncCatalog(db);
});
afterAll(resetDatabase);
beforeEach(() => {
  sent.length = 0;
  setMailer({ send: async (m) => void sent.push(m) });
});

describe('plans and usage (iteration 17)', () => {
  it('has Freemium (20) as default and Unlimited', async () => {
    const plans = await listPlans();
    expect(plans.map((p) => [p.id, p.patientLimit])).toEqual([
      ['freemium', 20],
      ['unlimited', null],
    ]);
    expect((await planUsageOf(TEST_PRACTICE_ID)).planId).toBe('freemium');
  });

  it('computes the state from 80 % and at the limit', () => {
    expect(planState(15, 20)).toBe('ok');
    expect(planState(16, 20)).toBe('near');
    expect(planState(20, 20)).toBe('reached');
    expect(planState(999, null)).toBe('ok');
  });

  it('counts only signed patients, treatments with a session and sessions not in the future', async () => {
    const signed = await createPatient(actor, patientInput(1));
    await sign(signed.id);
    await sign(signed.id); // a second signature is the same patient
    const unsigned = await createPatient(actor, patientInput(2));
    await treatment(signed.id, [new Date('2026-11-02T10:00:00Z'), new Date('2026-11-09T10:00:00Z')]);
    await treatment(signed.id, []); // started, no session
    await treatment(unsigned.id, [new Date('2999-01-01T10:00:00Z')]); // only a future session
    const usage = (await usageOf([TEST_PRACTICE_ID])).get(TEST_PRACTICE_ID);
    expect(usage).toEqual({ patients: 1, treatments: 1, sessions: 2 });
  });

  it('shows usage, last sign-in and last change in the platform overview, without reads', async () => {
    const before = (await lastChangeOf([TEST_PRACTICE_ID])).get(TEST_PRACTICE_ID);
    expect(before).toBeInstanceOf(Date);
    const row = (await practicesOverview()).find((p) => p.id === TEST_PRACTICE_ID)!;
    expect(row.usage).toEqual({ patients: 1, treatments: 1, sessions: 2 });
    expect(row.plan).toMatchObject({ id: 'freemium', patientLimit: 20, state: 'ok' });
    // A read (patient.viewed) is no change
    await new Promise((r) => setTimeout(r, 20));
    await db.auditEvent.create({ data: { userId: actor.id, userName: actor.name, action: 'patient.viewed' } });
    expect((await lastChangeOf([TEST_PRACTICE_ID])).get(TEST_PRACTICE_ID)).toEqual(before);
  });

  it('refuses new patients at the limit, mails the platform admin once, and lifts it with another plan', async () => {
    await rawDb.user.create({
      data: { email: 'admin@example.test', name: 'Plattform', platformAdmin: true, activatedAt: new Date() },
    });
    await updatePlan('freemium', { name: 'Freemium', patientLimit: 3 });
    for (const n of [3, 4]) await sign((await createPatient(actor, patientInput(n))).id);
    expect((await planUsageOf(TEST_PRACTICE_ID)).state).toBe('reached');
    await expect(createPatient(actor, patientInput(5))).rejects.toMatchObject({ message: 'planLimit' });
    expect(await notifyLimitReached(TEST_PRACTICE_ID)).toBe(true);
    expect(await notifyLimitReached(TEST_PRACTICE_ID)).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'admin@example.test' });
    expect(sent[0]!.subject).toContain('Freemium-Limite');

    expect(await setPracticePlan(platform, TEST_PRACTICE_ID, 'unlimited')).toBe(true);
    await expect(assertCanCreatePatient(TEST_PRACTICE_ID)).resolves.toMatchObject({ limit: null, state: 'ok' });
    const audit = await db.auditEvent.findFirst({ where: { action: 'practice.planChanged' } });
    expect(audit).toMatchObject({ before: 'freemium', after: 'unlimited' });
    expect((await rawDb.practice.findUniqueOrThrow({ where: { id: TEST_PRACTICE_ID } })).limitNotifiedAt).toBeNull();
  });

  it('creates plans, refuses a duplicate name and deactivating a plan in use', async () => {
    const p = await createPlan({ name: 'Premium 100', patientLimit: 100 });
    expect(p.id).toBe('premium-100');
    expect((await listPlans()).map((x) => x.id)).toEqual(['freemium', 'unlimited', 'premium-100']);
    await expect(createPlan({ name: 'premium 100', patientLimit: 5 })).rejects.toMatchObject({ code: 'nameTaken' });
    await expect(setPlanActive('unlimited', false)).rejects.toMatchObject({ code: 'inUse' });
    await setPlanActive('premium-100', false);
    await expect(setPracticePlan(platform, TEST_PRACTICE_ID, 'premium-100')).rejects.toMatchObject({
      code: 'notFound',
    });
  });
});

describe('consent template (iteration 17, design D1, D3)', () => {
  it('finds unknown fields before publishing', () => {
    expect(unknownFieldsOf({ bodyDe: '«Praxisnam» und «Adresse»', bodyEn: '«Address»' })).toEqual({
      bodyDe: ['Praxisnam'],
    });
  });

  it('offers the new template to an existing practice until it adopts it', async () => {
    await rawDb.practice.update({ where: { id: TEST_PRACTICE_ID }, data: { templateSeen: 1 } });
    expect(await templateOffered()).toBe(true);
    await publishVersion(
      actor,
      { titleDe: 'T', bodyDe: '«Praxisname»', titleEn: 'T', bodyEn: '«Practice name»' },
      {
        fromTemplate: true,
      },
    );
    expect(await templateOffered()).toBe(false);
  });
});
