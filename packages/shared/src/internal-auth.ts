import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * zone-consent-signing: PDF, Archiv und Zustellung (iteration 5, design D7). The patient zone and the finalize job call
 * the internal routes of the practice app with `Authorization: Bearer <HMAC-SHA-256>` of the subject (the signature
 * session id, or "finalize-pending") under ZONE_INTERNAL_SECRET. scripts/finalize-pending.mjs computes the same.
 */
export function internalToken(subject: string, secret: string): string {
  return createHmac('sha256', secret).update(`finalize:${subject}`, 'utf8').digest('hex');
}

/** Constant-time check of the Authorization header; false without a secret */
export function verifyInternalToken(subject: string, secret: string, authorization: string | null): boolean {
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const expected = Buffer.from(internalToken(subject, secret));
  const given = Buffer.from(authorization.slice(7).trim());
  return expected.length === given.length && timingSafeEqual(expected, given);
}
