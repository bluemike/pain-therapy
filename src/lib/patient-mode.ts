import { createHmac, timingSafeEqual } from 'node:crypto';

/** Signs a signature-session id so the session token can only enter patient mode through the server. */
export function signPatientMode(sid: string): string {
  return createHmac('sha256', process.env.AUTH_SECRET ?? 'dev-secret')
    .update(`patient-mode:${sid}`)
    .digest('hex');
}

export function verifyPatientMode(sid: unknown, sig: unknown): sid is string {
  if (typeof sid !== 'string' || typeof sig !== 'string') return false;
  const expected = Buffer.from(signPatientMode(sid));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** Paths a device in patient mode may open (consent-signing: Patientenmodus). */
export function isAllowedInPatientMode(pathname: string, sid: string): boolean {
  return (
    pathname === `/sign/${sid}` ||
    pathname === `/sign/${sid}/thanks` ||
    pathname === `/sign/${sid}/leave` ||
    pathname.startsWith('/api/auth/') ||
    pathname === '/api/health'
  );
}
