import { createHash, createHmac, randomBytes } from 'node:crypto';

/**
 * patient-access: Zugangslink und Gerätesitzung (iteration 4, design D3, D5, D6). Tokens and session ids are 32 random
 * bytes (256 bits) in base64url; the database keeps only their SHA-256. Nothing here logs a token.
 */

export const TOKEN_BYTES = 32;

export function newToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** SHA-256 in hex, for the token of a link and the id of a device session */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Tokens as issued: 43 base64url characters. Anything else is rejected without a database lookup. */
export function isTokenShaped(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

/** HMAC-SHA-256 of an IP address with PATIENT_ZONE_SECRET, for the limit per IP address without storing the address */
export function hashIp(ip: string, secret: string): string {
  return createHmac('sha256', secret).update(ip.trim().toLowerCase(), 'utf8').digest('hex');
}

/** Address of a link in the patient zone, e.g. https://patient.pain-therapy.ayanta.ch/l/<token> */
export function linkUrl(zoneUrl: string, token: string): string {
  return `${zoneUrl.replace(/\/+$/, '')}/l/${token}`;
}

/** Replaces the token in "/l/<token>" by "…" before anything is logged (design D14) */
export function maskTokens(text: string): string {
  return text.replace(/\/l\/[A-Za-z0-9_-]+/g, '/l/…');
}
