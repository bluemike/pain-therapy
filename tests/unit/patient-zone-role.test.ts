import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { currentProgram } from '@pain-therapy/shared/program';
import { db } from '@/lib/db';
import { applyPatientZoneRole } from '../../prisma/patient-zone-role.mjs';

/**
 * patient-zone-app: Rechte der Rolle patient_zone (iteration 4, task 1.4). Applies prisma/patient-zone-role.sql to
 * the test database like the migration job does, compares the grants with the allowed list and checks as
 * patient_zone that diagnoses, anamnesis and contact data cannot be read and nothing can be deleted.
 */

const PASSWORD = process.env.PATIENT_ZONE_DB_PASSWORD ?? 'patient_zone';

/** The allowed list of design D12 (HomePrescription without intensity, steps and note, design D7) */
const TABLES: Record<string, string[]> = {
  AuditEvent: ['INSERT'],
  ExerciseLogEntry: ['INSERT', 'SELECT', 'UPDATE'],
  PatientAccessLink: ['SELECT'],
  PatientZoneAttempt: ['INSERT', 'SELECT'],
  PatientZoneSession: ['INSERT', 'SELECT', 'UPDATE'],
};
const COLUMNS: Record<string, string[]> = {
  'Consultation.SELECT': ['at', 'id', 'treatmentId'],
  'Exercise.SELECT': ['code', 'nameDe', 'nameEn'],
  'ExerciseSheet.SELECT': ['exerciseCode', 'mainImage', 'rollingSeconds', 'sides', 'stretchSecondsPerSide'],
  'HomePrescription.SELECT': ['consultationId', 'exerciseCode', 'repetition'],
  'Patient.SELECT': ['dateOfBirth', 'firstName', 'id', 'preferredLanguage', 'status'],
  'PatientAccessLink.UPDATE': ['blockedAt', 'failedAttempts', 'lastUsedAt', 'lockedUntil'],
  'Treatment.SELECT': ['id', 'patientId'],
};

// Creating a role needs CREATEROLE (the CI and docker compose users are superusers; Azure's admin has CREATEROLE)
const [{ allowed }] = await db.$queryRaw<{ allowed: boolean }[]>`
  SELECT rolsuper OR rolcreaterole AS allowed FROM pg_roles WHERE rolname = current_user`;
if (!allowed) console.warn('Skipping the patient_zone role test: the test database user may not create roles');

describe.skipIf(!allowed)('role patient_zone', () => {
  let zone: PrismaClient;

  beforeAll(async () => {
    await applyPatientZoneRole(db, PASSWORD);
    // Applying twice must give the same result (the migration job runs on every deployment)
    await applyPatientZoneRole(db, PASSWORD);
    const url = new URL(process.env.DATABASE_URL!);
    url.username = 'patient_zone';
    url.password = PASSWORD;
    zone = new PrismaClient({ datasourceUrl: url.toString() });
  });
  afterAll(async () => {
    await zone?.$disconnect();
  });

  it('has exactly the allowed table and column privileges', async () => {
    const tables = await db.$queryRaw<{ table: string; privilege: string }[]>`
      SELECT c.relname AS "table", a.privilege_type AS privilege
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) a
      WHERE n.nspname = 'public' AND a.grantee = 'patient_zone'::regrole ORDER BY 1, 2`;
    const byTable: Record<string, string[]> = {};
    for (const t of tables) (byTable[t.table] ??= []).push(t.privilege);
    expect(byTable).toEqual(TABLES);

    const columns = await db.$queryRaw<{ table: string; column: string; privilege: string }[]>`
      SELECT c.relname AS "table", at.attname AS "column", a.privilege_type AS privilege
      FROM pg_attribute at JOIN pg_class c ON c.oid = at.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace,
        aclexplode(at.attacl) a
      WHERE n.nspname = 'public' AND a.grantee = 'patient_zone'::regrole ORDER BY 1, 3, 2`;
    const byColumn: Record<string, string[]> = {};
    for (const c of columns) (byColumn[`${c.table}.${c.privilege}`] ??= []).push(c.column);
    expect(byColumn).toEqual(COLUMNS);
  });

  it('reads the allowed columns and the current home program', async () => {
    await expect(zone.$queryRaw`SELECT "id", "firstName", "dateOfBirth" FROM "Patient" LIMIT 1`).resolves.toBeDefined();
    await expect(currentProgram(zone, 'no-such-patient')).resolves.toBeNull();
  });

  it.each([
    ['the diagnosis of a consultation (Diagnose nicht lesbar)', 'SELECT "diagnosis" FROM "Consultation"'],
    ['the diagnosis of a treatment', 'SELECT "diagnosis" FROM "Treatment"'],
    ['pain values', 'SELECT "painBefore" FROM "Consultation"'],
    ['the anamnesis', 'SELECT * FROM "Anamnesis"'],
    ['contact data', 'SELECT "email", "phone", "mobile" FROM "Patient"'],
    ['the note of the therapist', 'SELECT "note" FROM "HomePrescription"'],
    ['photos', 'SELECT * FROM "ClinicalPhoto"'],
    ['documents', 'SELECT * FROM "SignedDocument"'],
    ['exercise sheets of the practice', 'SELECT * FROM "ExerciseHandout"'],
    ['the audit log', 'SELECT * FROM "AuditEvent"'],
    ['deleting entries', 'DELETE FROM "ExerciseLogEntry"'],
    ['deleting sessions', 'DELETE FROM "PatientZoneSession"'],
    ['deleting attempts', 'DELETE FROM "PatientZoneAttempt"'],
    ['revoking a link', 'UPDATE "PatientAccessLink" SET "revokedAt" = now()'],
    [
      'issuing a link',
      `INSERT INTO "PatientAccessLink" ("id", "patientId", "tokenHash", "createdBy", "expiresAt") VALUES ('x', 'x', 'x', 'x', now())`,
    ],
    ['changing a patient', `UPDATE "Patient" SET "firstName" = 'x'`],
  ])('is denied %s', async (_what, sql) => {
    await expect(zone.$executeRawUnsafe(sql)).rejects.toThrow(/permission denied/);
  });
});
