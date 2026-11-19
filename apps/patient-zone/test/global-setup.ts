import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import type { TestProject } from 'vitest/node';
import { applyPatientZoneRole } from '../../../prisma/patient-zone-role.mjs';
import { TEST_PRACTICE_ID, TEST_PRACTICE_SQL } from '../../../tests/unit/test-practice';

declare module 'vitest' {
  export interface ProvidedContext {
    adminUrl: string;
    zoneUrl: string;
  }
}

/**
 * Prepares the test database like tests/unit/global-setup.ts of the practice app (migrations, empty tables) and
 * applies the role patient_zone, so these tests run with the rights of the patient zone. Without CREATEROLE they
 * fall back to the test user and say so.
 */
export default async function setup(project: TestProject) {
  const adminUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5432/pain_therapy_test';
  const name = new URL(adminUrl).pathname.slice(1);
  if (!name.endsWith('_test')) throw new Error(`Refusing to use ${name} as test database (name must end in _test)`);
  const db = new PrismaClient({ datasourceUrl: adminUrl });
  // Empty first: a migration may refuse to run on existing patient data (iteration 8, design D11)
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (tables.length) await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  execSync('npx prisma migrate deploy', {
    cwd: path.resolve(__dirname, '../../..'),
    env: { ...process.env, DATABASE_URL: adminUrl },
    stdio: 'pipe',
  });
  // Iteration 12: every connection works in the test practice (tests/unit/test-practice.ts)
  await db.$executeRawUnsafe(`ALTER DATABASE "${name}" SET app.practice_id = '${TEST_PRACTICE_ID}'`);
  await db.$executeRawUnsafe(TEST_PRACTICE_SQL);
  let zoneUrl = adminUrl;
  try {
    const [{ allowed }] = await db.$queryRaw<{ allowed: boolean }[]>`
      SELECT rolsuper OR rolcreaterole AS allowed FROM pg_roles WHERE rolname = current_user`;
    if (allowed) {
      const password = process.env.PATIENT_ZONE_DB_PASSWORD ?? 'patient_zone';
      await applyPatientZoneRole(db, password);
      const url = new URL(adminUrl);
      url.username = 'patient_zone';
      url.password = password;
      zoneUrl = url.toString();
    } else console.warn('The test database user may not create roles: patient zone tests run without patient_zone');
  } finally {
    await db.$disconnect();
  }
  project.provide('adminUrl', adminUrl);
  project.provide('zoneUrl', zoneUrl);
}
