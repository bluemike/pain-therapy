/**
 * Iteration 12 (design D1): role practice_app of the practice app, limited by row-level security.
 * Applies prisma/practice-app-role.sql (idempotent). The password comes from PRACTICE_APP_DB_PASSWORD (Key Vault
 * secret practice-app-db-password in Azure) and is passed as a transaction-local setting, never in the SQL text.
 *
 *   node prisma/practice-app-role.mjs   (migration job, after `prisma migrate deploy`)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import prisma from '@prisma/client';

const { PrismaClient } = prisma;

const HERE = path.dirname(fileURLToPath(import.meta.url));

export async function applyPracticeAppRole(db, password = process.env.PRACTICE_APP_DB_PASSWORD ?? '') {
  const sql = await readFile(path.join(HERE, 'practice-app-role.sql'), 'utf8');
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('pain_therapy.practice_app_password', ${password}, true)`;
    await tx.$executeRawUnsafe(sql);
  });
}

async function main() {
  const db = new PrismaClient();
  try {
    if (!process.env.PRACTICE_APP_DB_PASSWORD)
      console.warn('PRACTICE_APP_DB_PASSWORD is not set: grants applied, password of practice_app unchanged');
    await applyPracticeAppRole(db);
    console.log('Role practice_app: grants applied');
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
