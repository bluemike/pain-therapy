import { cache } from 'react';
import { hashToken, isTokenShaped } from '@pain-therapy/shared/tokens';
import { practiceDetails, practiceOfLinkHash } from './db';
import { sessionPracticeId } from './session-practice';

/** The practice of the patient (iteration 12, design D6): from the device session, else from a link token */

export type ZonePractice = NonNullable<Awaited<ReturnType<typeof practiceDetails>>>;

export const sessionPractice = cache(async (): Promise<ZonePractice | null> => {
  const id = await sessionPracticeId();
  return id ? practiceDetails({ id }) : null;
});

export async function practiceOfToken(token: string): Promise<ZonePractice | null> {
  if (!isTokenShaped(token)) return null;
  const id = await practiceOfLinkHash(hashToken(token));
  return id ? practiceDetails({ id }) : null;
}

export const logoUrlOf = (p: ZonePractice) => (p.logoType ? `/api/practice-logo/${p.id}?v=${p.updatedAt.getTime()}` : null);
