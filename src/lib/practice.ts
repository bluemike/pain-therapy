import { cache } from 'react';
import type { Practice } from '@prisma/client';
import { explicitPracticeId } from '@pain-therapy/shared/practice-context';
import { rawDb } from './db';

/**
 * The practice of the current request (iteration 12, design D1, D3): the practice set by runInPractice(), else the
 * active membership of the signed-in user in an active practice. Resolved once per request; null outside a request
 * or without a membership, which makes every patient query return nothing.
 */
export const currentPracticeId = cache(async (): Promise<string | null> => {
  const explicit = explicitPracticeId();
  if (explicit) return explicit;
  const session = await import('@/auth').then(({ auth }) => auth()).catch(() => null);
  // The session reads the membership from the database on every request (src/auth.ts)
  if (session?.user?.id) return session.user.practiceId ?? null;
  return databaseDefaultPracticeId();
});

/** The database default of app.practice_id: set only on the test database (tests/unit/test-practice.ts) */
async function databaseDefaultPracticeId(): Promise<string | null> {
  const [row] = await rawDb.$queryRaw<{ p: string | null }[]>`
    SELECT NULLIF(current_setting('app.practice_id', true), '') AS p`;
  return row?.p ?? null;
}

/** Active membership of a user in an active practice; a user belongs to one practice */
export async function practiceIdOfUser(userId: string): Promise<string | null> {
  const m = await rawDb.practiceMembership.findFirst({
    where: { active: true, userId, practice: { status: 'ACTIVE' } },
    select: { practiceId: true },
    orderBy: { createdAt: 'asc' },
  });
  return m?.practiceId ?? null;
}

/** Settings of the current practice (address, contact, prefix …), or null without one */
export const currentPractice = cache(async (): Promise<Practice | null> => {
  const id = await currentPracticeId();
  return id ? rawDb.practice.findUnique({ where: { id } }) : null;
});

/** The current practice, or an error: for code that cannot work without one (document numbers, PDFs) */
export async function requirePractice(): Promise<Practice> {
  const p = await currentPractice();
  if (!p) throw new Error('No practice for this request');
  return p;
}

/** Practice of a signature session, for the internal routes and the finalize job that run without a user */
export async function practiceIdOfSignatureSession(sid: string): Promise<string | null> {
  const s = await rawDb.signatureSession.findUnique({ where: { id: sid }, select: { practiceId: true } });
  return s?.practiceId ?? null;
}
