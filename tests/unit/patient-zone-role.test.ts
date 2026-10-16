import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { currentProgram } from '@pain-therapy/shared/program';
import { db } from '@/lib/db';
import { applyPatientZoneRole } from '../../prisma/patient-zone-role.mjs';

/**
 * patient-zone-app: Rechte der Rolle patient_zone (iteration 4, task 1.4; extended in iteration 5, task 1.4). Applies
 * prisma/patient-zone-role.sql to the test database like the migration job does, compares the grants with the
 * allowed list and checks as patient_zone that anamnesis, photos, archive paths and signature images cannot be read
 * and nothing can be deleted. Iteration 6 (task 2.2) adds treatments, consultations and documents, read only.
 */

const PASSWORD = process.env.PATIENT_ZONE_DB_PASSWORD ?? 'patient_zone';

/**
 * The allowed list of design D12 (HomePrescription without intensity, steps and note, design D7), extended by
 * iteration 5 design D8 for the signature in the patient zone and by iteration 6 design D4, D5 for the record
 */
const TABLES: Record<string, string[]> = {
  AuditEvent: ['INSERT'],
  Consent: ['INSERT'],
  ExerciseLogEntry: ['INSERT', 'SELECT', 'UPDATE'],
  PatientAccessLink: ['SELECT'],
  PatientZoneAttempt: ['INSERT', 'SELECT'],
  PatientZoneSession: ['INSERT', 'SELECT', 'UPDATE'],
  SignatureSession: ['INSERT'],
};
const COLUMNS: Record<string, string[]> = {
  'ConsentTextVersion.SELECT': ['body', 'id', 'language', 'title', 'version'],
  'Consultation.SELECT': ['at', 'comparison', 'diagnosis', 'id', 'number', 'painAfter', 'painBefore', 'treatmentId'],
  'ConsultationExercise.SELECT': ['consultationId', 'difficulty', 'exerciseCode', 'prescribed', 'variants'],
  'ConsultationPoint.SELECT': ['consultationId', 'left', 'pointId', 'right', 'sensitivity'],
  'ConsultationRolling.SELECT': ['area', 'consultationId', 'position', 'toolCode'],
  'Exercise.SELECT': ['code', 'nameDe', 'nameEn', 'sort'],
  'ExerciseHandout.SELECT': ['consultationId', 'createdAt', 'documentNumber', 'id', 'language', 'patientId', 'version'],
  'ExerciseSheet.SELECT': ['exerciseCode', 'mainImage', 'rollingSeconds', 'sides', 'stretchSecondsPerSide'],
  'HomePrescription.SELECT': ['consultationId', 'exerciseCode', 'repetition'],
  'OsteopressurePoint.SELECT': ['attachmentDe', 'group', 'id', 'muscleAttachmentLatin', 'sort'],
  'Patient.SELECT': [
    'city',
    'dateOfBirth',
    'email',
    'firstName',
    'id',
    'insuranceNumber',
    'insurer',
    'lastName',
    'mobile',
    'phone',
    'preferredLanguage',
    'status',
    'street',
    'zip',
  ],
  'PatientAccessLink.UPDATE': ['blockedAt', 'failedAttempts', 'lastUsedAt', 'lockedUntil'],
  'Region.SELECT': ['id', 'nameDe', 'nameEn'],
  'RollingTool.SELECT': ['code', 'nameDe', 'nameEn', 'sort'],
  'SignatureSession.SELECT': [
    'channel',
    'completedAt',
    'id',
    'language',
    'patientId',
    'startedAt',
    'status',
    'textVersionId',
    'zoneSessionId',
  ],
  'SignatureSession.UPDATE': [
    'abortedAt',
    'completedAt',
    'patientNote',
    'place',
    'signaturePoints',
    'signatureSvg',
    'status',
  ],
  'SignedDocument.SELECT': ['createdAt', 'documentNumber', 'id', 'language', 'patientId', 'sessionId', 'textVersion'],
  'Treatment.SELECT': ['diagnosis', 'id', 'painStart', 'patientId', 'regionId', 'startedAt'],
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
    // The record of iteration 6: treatments, consultations and the document list
    await expect(zone.$queryRaw`SELECT "diagnosis", "painStart" FROM "Treatment" LIMIT 1`).resolves.toBeDefined();
    await expect(
      zone.$queryRaw`SELECT "diagnosis", "painBefore", "painAfter", "comparison" FROM "Consultation" LIMIT 1`,
    ).resolves.toBeDefined();
    await expect(
      zone.$queryRaw`SELECT "documentNumber", "createdAt" FROM "SignedDocument" LIMIT 1`,
    ).resolves.toBeDefined();
    await expect(
      zone.$queryRaw`SELECT "documentNumber", "version" FROM "ExerciseHandout" LIMIT 1`,
    ).resolves.toBeDefined();
    await expect(currentProgram(zone, 'no-such-patient')).resolves.toBeNull();
  });

  it.each([
    ['who created a treatment', 'SELECT "createdBy", "updatedBy" FROM "Treatment"'],
    ['who created a consultation', 'SELECT "createdBy", "updatedBy" FROM "Consultation"'],
    ['changing a treatment', `UPDATE "Treatment" SET "diagnosis" = 'x'`],
    ['changing a consultation', `UPDATE "Consultation" SET "painAfter" = 0`],
    ['deleting a consultation point', 'DELETE FROM "ConsultationPoint"'],
    ['the archive path of a document', 'SELECT "blobPath", "sha256" FROM "SignedDocument"'],
    ['the archive path of an exercise sheet', 'SELECT "blobPath", "prescriptions", "createdBy" FROM "ExerciseHandout"'],
    ['exercise sheet deliveries', 'SELECT * FROM "HandoutDelivery"'],
    ['changing a document', `UPDATE "SignedDocument" SET "documentNumber" = 'x'`],
    ['the anamnesis', 'SELECT * FROM "Anamnesis"'],
    ['the emergency contact and GP', 'SELECT "emergencyName", "emergencyPhone", "gp" FROM "Patient"'],
    ['signature images', 'SELECT "signatureSvg", "signaturePoints" FROM "SignatureSession"'],
    ['the remark of an earlier signature', 'SELECT "patientNote" FROM "SignatureSession"'],
    ['consents', 'SELECT * FROM "Consent"'],
    ['email deliveries', 'SELECT * FROM "EmailDelivery"'],
    ['deleting signatures', 'DELETE FROM "SignatureSession"'],
    ['resolving a remark', 'UPDATE "SignatureSession" SET "noteResolvedAt" = now()'],
    ['the note of the therapist', 'SELECT "note" FROM "HomePrescription"'],
    ['photos', 'SELECT * FROM "ClinicalPhoto"'],
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
