import 'server-only';
import QRCode from 'qrcode';
import { authDb } from '../db';
import { decrypt, encrypt } from './crypto';
import { newTotpSecret, otpauthUri, verifyTotp } from './totp';

/** Setting up the authenticator app: a pending secret, confirmed by the first code (therapist-login, design D2) */

export async function startTotpSetup(userId: string): Promise<{ secret: string; qrSvg: string }> {
  const u = await authDb.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const secret = newTotpSecret();
  await authDb.user.update({ where: { id: userId }, data: { totpPendingEnc: encrypt(secret) } });
  const qrSvg = await QRCode.toString(otpauthUri(secret, u.email), { type: 'svg', margin: 1 });
  return { secret, qrSvg };
}

/** Confirms the pending secret with a code; replaces an earlier authenticator */
export async function confirmTotpSetup(userId: string, code: string): Promise<boolean> {
  const u = await authDb.user.findUniqueOrThrow({ where: { id: userId }, select: { totpPendingEnc: true } });
  if (!u.totpPendingEnc) return false;
  const secret = decrypt(u.totpPendingEnc);
  if (!verifyTotp(secret, code)) return false;
  await authDb.user.update({
    where: { id: userId },
    data: { totpSecretEnc: encrypt(secret), totpPendingEnc: null, totpEnabledAt: new Date() },
  });
  return true;
}
