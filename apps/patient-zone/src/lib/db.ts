import type { PrismaClient } from '@prisma/client';
import { createPrismaClient } from '@pain-therapy/shared/db';
import { withPracticeContext } from '@pain-therapy/shared/practice-context';

/**
 * Database access with the role patient_zone (DATABASE_URL, design D12). The role reads only some columns, so every
 * query selects its columns explicitly; inserts into AuditEvent go without RETURNING (createMany).
 *
 * Iteration 12 (design D6): row-level security limits the role to one practice per request. The practice comes from
 * runInPractice() (pages and actions that start from a link token, see access.ts) or else from the device session
 * cookie of the request.
 */
const globalForPrisma = globalThis as unknown as { zoneDb?: PrismaClient };

const base = globalForPrisma.zoneDb ?? createPrismaClient();

/** Practice of a link token hash or device session hash, readable before any practice is set (owner functions) */
export async function practiceOfLinkHash(tokenHash: string): Promise<string | null> {
  const [row] = await base.$queryRaw<{ p: string | null }[]>`SELECT zone_practice_of_link(${tokenHash}) AS p`;
  return row?.p ?? null;
}

export async function practiceOfSessionHash(idHash: string): Promise<string | null> {
  const [row] = await base.$queryRaw<{ p: string | null }[]>`SELECT zone_practice_of_session(${idHash}) AS p`;
  return row?.p ?? null;
}

export const db = withPracticeContext(base, async () => {
  const { sessionPracticeId } = await import('./session-practice');
  return sessionPracticeId();
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.zoneDb = base;
