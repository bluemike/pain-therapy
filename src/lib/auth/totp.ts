import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** TOTP after RFC 6238 (SHA-1, 6 digits, 30 s), as Google Authenticator, Microsoft Authenticator and 1Password use */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 160-bit secret in base32 */
export const newTotpSecret = () => base32Encode(randomBytes(20));

export function totpAt(secret: string, timeMs: number, stepS = 30): string {
  const counter = Math.floor(timeMs / 1000 / stepS);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const offset = h[h.length - 1]! & 15;
  const bin = (h.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(bin).padStart(6, '0');
}

/** Accepts the code of the current step and of one step before or after (clock drift of the phone) */
export function verifyTotp(secret: string, code: string, nowMs = Date.now()): boolean {
  const typed = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(typed)) return false;
  for (const drift of [0, -1, 1]) {
    const expected = totpAt(secret, nowMs + drift * 30_000);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(typed))) return true;
  }
  return false;
}

/** otpauth:// URI for the QR code of the authenticator app */
export function otpauthUri(secret: string, account: string, issuer = 'Pain Therapy'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}
