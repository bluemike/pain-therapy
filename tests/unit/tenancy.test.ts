import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runInPractice, withPracticeContext } from '@pain-therapy/shared/practice-context';
import { rawDb } from '@/lib/db';
import { nextDocumentNumber } from '@/lib/signing';
import { applyPracticeAppRole } from '../../prisma/practice-app-role.mjs';
import { resetDatabase } from './db-reset';
import { TEST_PRACTICE_ID } from './test-practice';

/**
 * Iteration 12, tenancy (design D1): row-level security per practice, checked with the role practice_app that the
 * practice app uses in Azure. Two practices with one patient each; every read and write must stay in the practice
 * of the request.
 */

const PASSWORD = 'practice_app';
const OTHER = 'prc_other';

const [{ allowed }] = await rawDb.$queryRaw<{ allowed: boolean }[]>`
  SELECT rolsuper OR rolcreaterole AS allowed FROM pg_roles WHERE rolname = current_user`;
if (!allowed) console.warn('Skipping the tenancy test: the test database user may not create roles');

const patient = (lastName: string, practiceId: string) => ({
  practiceId,
  firstName: 'Test',
  lastName,
  dateOfBirth: new Date('1970-01-01'),
  createdBy: 'test',
  updatedBy: 'test',
});

describe.skipIf(!allowed)('row-level security per practice (Daten gehören genau einer Praxis)', () => {
  let base: PrismaClient;
  let app: PrismaClient;

  beforeAll(async () => {
    await resetDatabase();
    await applyPracticeAppRole(rawDb, PASSWORD);
    await rawDb.practice.create({
      data: {
        id: OTHER,
        slug: 'other',
        name: 'Physio Muster',
        addressLine: 'Physio Muster | Bahnhofstrasse 10 | 7000 Chur',
        defaultPlace: 'Chur',
        contactEmail: 'anna@example.test',
        documentPrefix: 'PM',
      },
    });
    await rawDb.patient.create({ data: patient('Eigene', TEST_PRACTICE_ID) });
    await rawDb.patient.create({ data: patient('Fremde', OTHER) });
    const url = new URL(process.env.DATABASE_URL!);
    url.username = 'practice_app';
    url.password = PASSWORD;
    base = new PrismaClient({ datasourceUrl: url.toString() });
    app = withPracticeContext(base, async () => null);
  });

  afterAll(async () => {
    await base?.$disconnect();
    await resetDatabase();
  });

  it('lists only the patients of the own practice (Fremde Patientin nicht sichtbar)', async () => {
    const own = await runInPractice(TEST_PRACTICE_ID, () => app.patient.findMany({ select: { lastName: true } }));
    expect(own.map((p) => p.lastName)).toEqual(['Eigene']);
    const other = await runInPractice(OTHER, () => app.patient.findMany({ select: { lastName: true } }));
    expect(other.map((p) => p.lastName)).toEqual(['Fremde']);
  });

  it('does not find a patient of another practice by id', async () => {
    const foreign = await rawDb.patient.findFirstOrThrow({ where: { practiceId: OTHER } });
    const found = await runInPractice(TEST_PRACTICE_ID, () => app.patient.findUnique({ where: { id: foreign.id } }));
    expect(found).toBeNull();
  });

  it('returns nothing without a practice (Abfrage ohne Praxis)', async () => {
    const count = await base.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.practice_id', '', true)`;
      return tx.patient.count();
    });
    expect(count).toBe(0);
  });

  it('rejects writing a row into another practice (Schreiben in fremde Praxis)', async () => {
    await expect(
      runInPractice(TEST_PRACTICE_ID, () => app.patient.create({ data: patient('Eingeschleust', OTHER) })),
    ).rejects.toThrow();
    expect(await rawDb.patient.count({ where: { lastName: 'Eingeschleust' } })).toBe(0);
  });

  it('gives new rows the practice of the request', async () => {
    const { practiceId, ...data } = patient('Neu', OTHER);
    void practiceId;
    const created = await runInPractice(OTHER, () => app.patient.create({ data, select: { id: true } }));
    const row = await rawDb.patient.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.practiceId).toBe(OTHER);
  });

  it('keeps the practice inside interactive transactions', async () => {
    const names = await runInPractice(OTHER, () =>
      app.$transaction(async (tx) =>
        (await tx.patient.findMany({ select: { lastName: true } })).map((p) => p.lastName),
      ),
    );
    expect(names.sort()).toEqual(['Fremde', 'Neu']);
  });

  it('keeps the practice for calls of the outer client inside an interactive transaction', async () => {
    // Like finalizeSignature(), which takes a document number through `db` while its transaction runs
    const names = await runInPractice(OTHER, () =>
      app.$transaction(async (tx) => {
        const inner = await tx.patient.count();
        const outer = await app.patient.findMany({ select: { lastName: true } });
        return { inner, outer: outer.map((p) => p.lastName).sort() };
      }),
    );
    expect(names).toEqual({ inner: 2, outer: ['Fremde', 'Neu'] });
  });

  it('numbers documents per practice with the practice prefix (Dokumentnummern pro Praxis)', async () => {
    const year = new Date().getUTCFullYear();
    expect(await runInPractice(OTHER, () => nextDocumentNumber())).toBe(`PM-${year}-00001`);
    expect(await runInPractice(TEST_PRACTICE_ID, () => nextDocumentNumber())).toBe(`PT-${year}-00001`);
    expect(await runInPractice(OTHER, () => nextDocumentNumber())).toBe(`PM-${year}-00002`);
  });

  /**
   * Task 7.2: a table added later with a practiceId but without a policy would be readable across practices. Only
   * these tables carry a practiceId without row-level security, on purpose: the sign-in looks up memberships and
   * invitations by email before a practice is known (src/lib/team.ts filters by practice), and the practice app has
   * no rights at all on PendingBlobDeletion. MailboxProvisioning (iteration 16) is an auth table like Invitation:
   * the platform admin sees all mailboxes, and src/lib/mailboxes.ts filters by practice.
   */
  it('protects every table with a practiceId by a policy, and practice_app cannot bypass it', async () => {
    const tables = await rawDb.$queryRaw<{ table: string; rls: boolean; policies: number; select: boolean }[]>`
      SELECT c.relname AS "table", c.relrowsecurity AS rls,
             (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid = c.oid) AS policies,
             has_table_privilege('practice_app', c.oid, 'SELECT') AS "select"
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attname = 'practiceId' AND NOT a.attisdropped)
      ORDER BY 1`;
    const exempt = ['Invitation', 'MailboxProvisioning', 'PendingBlobDeletion', 'PracticeMembership'];
    const unprotected = tables.filter((t) => !(t.rls && t.policies > 0)).map((t) => t.table);
    expect(unprotected).toEqual(exempt);
    expect(tables.find((t) => t.table === 'PendingBlobDeletion')?.select).toBe(false);
    expect(tables.length).toBeGreaterThan(20);

    const [role] = await rawDb.$queryRaw<{ bypass: boolean; superuser: boolean; owns: number }[]>`
      SELECT r.rolbypassrls AS bypass, r.rolsuper AS superuser,
             (SELECT count(*)::int FROM pg_class c WHERE c.relowner = r.oid) AS owns
      FROM pg_roles r WHERE r.rolname = 'practice_app'`;
    expect(role).toEqual({ bypass: false, superuser: false, owns: 0 });
  });

  it('lets practice_app read the therapy catalog but not change it', async () => {
    const [grants] = await rawDb.$queryRaw<{ read: boolean; write: boolean }[]>`
      SELECT bool_and(has_table_privilege('practice_app', t, 'SELECT')) AS read,
             bool_or(has_table_privilege('practice_app', t, 'INSERT,UPDATE,DELETE')) AS write
      FROM unnest(ARRAY['"BodyArea"', '"Region"', '"RegionPoint"', '"RegionExercise"', '"OsteopressurePoint"',
                        '"Exercise"', '"ExerciseSheet"', '"ExerciseVariant"', '"RollingTool"',
                        '"TreatmentPosition"']) AS t`;
    expect(grants).toEqual({ read: true, write: false });
  });

  it('does not let practice_app delete a practice or read the blob deletion list', async () => {
    await expect(base.$queryRaw`SELECT platform_purge_practice(${OTHER})`).rejects.toThrow(/permission denied/);
    await expect(base.$queryRaw`SELECT * FROM "PendingBlobDeletion"`).rejects.toThrow(/permission denied/);
  });
});
