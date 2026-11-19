import { PrismaClient } from '@prisma/client';
import { withPracticeContext } from '@pain-therapy/shared/practice-context';

/**
 * Database clients of the practice app (iteration 12, design D1).
 *
 * - `db`: every call carries the practice of the signed-in user (or of runInPractice()), and row-level security limits
 *   it to that practice. Use it for everything with patient data.
 * - `rawDb`: no practice, connected as the table owner (DATABASE_ADMIN_URL, falls back to DATABASE_URL locally).
 *   Only for users, memberships, practices, the platform functions and for finding the practice of a row before
 *   switching into it (internal routes, jobs).
 * - `authDb`: the plain client of `db` without a practice (role practice_app), for the sign-in tables that have no
 *   practice (users, passkeys, codes, invitations). Used by the sign-in itself, where `db` would ask the session.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; rawPrisma?: PrismaClient };

const adminUrl = process.env.DATABASE_ADMIN_URL;

const base = globalForPrisma.prisma ?? new PrismaClient();
export const rawDb = globalForPrisma.rawPrisma ?? (adminUrl ? new PrismaClient({ datasourceUrl: adminUrl }) : base);

export const authDb = base;

export const db = withPracticeContext(base, async () => {
  const { currentPracticeId } = await import('./practice');
  return currentPracticeId();
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = base;
  globalForPrisma.rawPrisma = rawDb;
}
