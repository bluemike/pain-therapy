import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  randomInt,
} from 'node:crypto';
import { config } from '../config';

/**
 * Secrets of the sign-in (therapist-login, design D2): codes and tokens only as hashes, TOTP secrets encrypted with
 * AES-256-GCM.
 */

/** HMAC with AUTH_SECRET: a stolen database alone does not let anyone try the 10^6 email codes offline */
export function hmac(value: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('AUTH_SECRET is not set');
  return createHmac('sha256', secret).update(value).digest('base64url');
}

/** Hash of a random token with enough entropy (invitation link, ticket) */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url');

export const randomToken = () => randomBytes(32).toString('base64url');

export const sixDigits = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Letters and digits that cannot be confused when read from paper (no 0/O, 1/I/L) */
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** Recovery code like "K7QM-2HXP" */
export function recoveryCode(): string {
  let s = '';
  for (let i = 0; i < 8; i++) s += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Typed recovery code in canonical form: upper case, without spaces, with the dash */
export function normalizeRecoveryCode(input: string): string {
  const s = input.toUpperCase().replace(/[^0-9A-Z]/g, '');
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : '';
}

function key(): Buffer {
  if (config.auth.encryptionKey) {
    const k = Buffer.from(config.auth.encryptionKey, 'base64');
    if (k.length !== 32) throw new Error('AUTH_ENCRYPTION_KEY must be 32 bytes, base64');
    return k;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_ENCRYPTION_KEY is not set');
  return Buffer.from(hkdfSync('sha256', process.env.AUTH_SECRET ?? 'dev', 'pain-therapy', 'totp', 32));
}

/** "v1.<iv>.<tag>.<ciphertext>" in base64url */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv, c.getAuthTag(), data].map((x) => (typeof x === 'string' ? x : x.toString('base64url'))).join('.');
}

export function decrypt(box: string): string {
  const [v, iv, tag, data] = box.split('.');
  if (v !== 'v1' || !iv || !tag || data === undefined) throw new Error('Unknown secret format');
  const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(data, 'base64url')), d.final()]).toString('utf8');
}
