import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { TEST_PRACTICE_ID, TEST_PRACTICE_SQL } from './test-practice';

/**
 * Prepares the dedicated test database: applies migrations, then empties all tables.
 * Refuses to run against any database whose name does not end in "_test".
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://app:app@localhost:5432/pain_therapy_test';
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith('_test')) throw new Error(`Refusing to use ${name} as test database (name must end in _test)`);
  const db = new PrismaClient({ datasourceUrl: url });
  const truncate = async () => {
    const tables = await db.$queryRaw<
      { tablename: string }[]
    >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'Plan')`;
    if (tables.length)
      await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  };
  // Empty first: a migration may refuse to run on existing patient data (iteration 8, design D11)
  await truncate();
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url }, stdio: 'pipe' });
  await truncate();
  // Iteration 12: every connection to the test database works in the test practice unless a test switches
  await db.$executeRawUnsafe(`ALTER DATABASE "${name}" SET app.practice_id = '${TEST_PRACTICE_ID}'`);
  await db.$executeRawUnsafe(TEST_PRACTICE_SQL);
  await db.$disconnect();
}
