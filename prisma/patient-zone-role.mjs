/**
 * patient-zone-app: Rechte der Rolle patient_zone (iteration 4, design D12).
 * Applies prisma/patient-zone-role.sql (role and grants, idempotent) and deletes confirmation attempts older than
 * 30 days (design D5). The password of the role comes from PATIENT_ZONE_DB_PASSWORD (Key Vault secret
 * patient-zone-db-password in Azure); it is passed as a transaction-local setting, never as part of the SQL text.
 *
 * Plain JavaScript so it runs in the production image without a build step:
 *   node prisma/patient-zone-role.mjs   (migration job, after `prisma migrate deploy`)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import prisma from '@prisma/client';

const { PrismaClient } = prisma;

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Days after which PatientZoneAttempt rows are deleted */
export const ATTEMPT_RETENTION_DAYS = 30;

/** Creates or updates the role patient_zone and resets its grants; returns the number of deleted attempts. */
export async function applyPatientZoneRole(db, password = process.env.PATIENT_ZONE_DB_PASSWORD ?? '') {
  const sql = await readFile(path.join(HERE, 'patient-zone-role.sql'), 'utf8');
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('pain_therapy.patient_zone_password', ${password}, true)`;
    await tx.$executeRawUnsafe(sql);
  });
  return db.$executeRawUnsafe(
    `DELETE FROM "PatientZoneAttempt" WHERE "at" < now() - interval '${ATTEMPT_RETENTION_DAYS} days'`,
  );
}

async function main() {
  const db = new PrismaClient();
  try {
    if (!process.env.PATIENT_ZONE_DB_PASSWORD)
      console.warn('PATIENT_ZONE_DB_PASSWORD is not set: grants applied, password of patient_zone unchanged');
    const deleted = await applyPatientZoneRole(db);
    console.log(`Role patient_zone: grants applied, ${deleted} confirmation attempts older than 30 days deleted`);
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
