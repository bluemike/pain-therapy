import { cache } from 'react';
import { SESSION_COOKIE } from '@pain-therapy/shared/access';
import { hashToken, isTokenShaped } from '@pain-therapy/shared/tokens';
import { practiceOfSessionHash } from './db';

/** Practice of the device session cookie of this request (iteration 12, design D6); null outside a request */
export const sessionPracticeId = cache(async (): Promise<string | null> => {
  const { cookies } = await import('next/headers');
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!id || !isTokenShaped(id)) return null;
  return practiceOfSessionHash(hashToken(id));
});
