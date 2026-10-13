import { db } from '@/lib/db';

/**
 * Empties all tables of the test database, like global-setup.ts. Files that create their own data call it before
 * and after their tests, so tests in other files that count rows see an empty database whatever the file order.
 */
export async function resetDatabase() {
  const name = new URL(process.env.DATABASE_URL!).pathname.slice(1);
  if (!name.endsWith('_test')) throw new Error(`Refusing to empty ${name}`);
  const tables = await db.$queryRaw<
    { tablename: string }[]
  >`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
}
