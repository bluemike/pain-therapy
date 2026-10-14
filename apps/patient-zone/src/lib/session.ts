import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@pain-therapy/shared/access';
import { resolveSession } from './access';

/** The device session of this request (cookie pz_session), resolved once per request */
export const getZoneSession = cache(async () => resolveSession((await cookies()).get(SESSION_COOKIE)?.value));
