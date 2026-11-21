import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import type { LoginCodePurpose } from '@prisma/client';
import { authDb } from '../db';
import { config } from '../config';
import { getMailer } from '../mail';
import { translator } from '../i18n-server';
import { decrypt, hashToken, hmac, randomToken, sixDigits } from './crypto';
import { accessOf, normalizeEmail, redeemRecoveryCode, type NoAccessReason } from './accounts';
import { verifyTotp } from './totp';

/**
 * Email code as first factor (therapist-login, design D2): 6 digits, valid 10 minutes, single use, stored as HMAC.
 * After 5 wrong codes for an address (or 20 from one IP) no code is accepted for 15 minutes. A confirmed code yields a
 * ticket for the second step (authenticator code or recovery code, or the setup after an invitation).
 */

/** Codes sent per address within the lock window; more requests send nothing (no mail bombing) */
const MAX_CODES_PER_WINDOW = 5;

export async function isLocked(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - config.auth.lockMs);
  const [byEmail, byIp] = await Promise.all([
    authDb.loginFailure.count({ where: { email, createdAt: { gte: since } } }),
    authDb.loginFailure.count({ where: { ip, createdAt: { gte: since } } }),
  ]);
  return byEmail >= config.auth.maxFailures || byIp >= config.auth.maxFailuresPerIp;
}

/** Records a wrong code; true when this failure locks the address */
async function fail(email: string, ip: string): Promise<boolean> {
  await authDb.loginFailure.create({ data: { email, ip } });
  return isLocked(email, ip);
}

export type RequestResult = { ok: true } | { ok: false; error: 'locked' | 'invalidEmail' };

/**
 * Sends a code if the address has an account (LOGIN) or matches the invitation (INVITATION). The answer is the same
 * either way, so the form does not reveal which addresses have an account.
 */
export async function requestCode(
  rawEmail: string,
  ip: string,
  purpose: LoginCodePurpose = 'LOGIN',
  invitationId?: string,
): Promise<RequestResult> {
  const email = normalizeEmail(rawEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return { ok: false, error: 'invalidEmail' };
  if (await isLocked(email, ip)) return { ok: false, error: 'locked' };

  const eligible =
    purpose === 'LOGIN'
      ? !!(await authDb.user.findUnique({ where: { email }, select: { id: true } }))
      : !!(await authDb.invitation.findFirst({
          where: { id: invitationId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true },
        }));
  if (!eligible) return { ok: true };

  const since = new Date(Date.now() - config.auth.lockMs);
  const recent = await authDb.loginCode.count({ where: { email, createdAt: { gte: since } } });
  if (recent >= MAX_CODES_PER_WINDOW) return { ok: true };

  const code = sixDigits();
  await authDb.$transaction([
    // Only the newest code counts
    authDb.loginCode.updateMany({ where: { email, usedAt: null }, data: { usedAt: new Date() } }),
    authDb.loginCode.create({
      data: {
        email,
        purpose,
        invitationId: purpose === 'INVITATION' ? invitationId : null,
        codeHash: hmac(`code:${email}:${code}`),
        expiresAt: new Date(Date.now() + config.auth.codeTtlMs),
      },
    }),
  ]);
  const t = translator('de', 'authMail');
  try {
    await getMailer().send({
      to: email,
      subject: t('codeSubject', { code }),
      text: t('codeText', { code }),
      bold: [code],
    });
  } catch (e) {
    console.error('Sign-in code could not be sent', e instanceof Error ? e.message : e);
  }
  return { ok: true };
}

export type VerifyResult = { ok: true; ticket: string } | { ok: false; error: 'locked' | 'wrong' | 'expired' };

/** Checks the code; the ticket is valid 10 minutes for the next step */
export async function verifyCode(
  rawEmail: string,
  rawCode: string,
  ip: string,
  purpose: LoginCodePurpose = 'LOGIN',
): Promise<VerifyResult> {
  const email = normalizeEmail(rawEmail);
  const code = rawCode.replace(/\D/g, '');
  if (await isLocked(email, ip)) return { ok: false, error: 'locked' };
  const row = await authDb.loginCode.findFirst({
    where: { email, purpose, usedAt: null, verifiedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  const expected = row ? Buffer.from(row.codeHash) : null;
  const typed = Buffer.from(hmac(`code:${email}:${code}`));
  const match = !!expected && expected.length === typed.length && timingSafeEqual(expected, typed);
  if (!row || !match) return { ok: false, error: (await fail(email, ip)) ? 'locked' : 'wrong' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, error: 'expired' };
  const ticket = randomToken();
  const done = await authDb.loginCode.updateMany({
    where: { id: row.id, verifiedAt: null, usedAt: null },
    data: { verifiedAt: new Date(), ticketHash: hashToken(ticket) },
  });
  if (done.count !== 1) return { ok: false, error: 'expired' };
  await authDb.loginFailure.deleteMany({ where: { email } });
  return { ok: true, ticket };
}

/** The confirmed code behind a ticket, while it is valid and unused */
export async function ticketOf(ticket: string | undefined, purpose: LoginCodePurpose) {
  if (!ticket) return null;
  const row = await authDb.loginCode.findUnique({ where: { ticketHash: hashToken(ticket) } });
  if (!row || row.purpose !== purpose || row.usedAt || !row.verifiedAt) return null;
  // After an invitation the setup may take longer (installing an authenticator app)
  const ttl = purpose === 'INVITATION' ? 3 * config.auth.codeTtlMs : config.auth.codeTtlMs;
  if (row.verifiedAt.getTime() + ttl < Date.now()) return null;
  return row;
}

/** Uses up a ticket; false if it was used meanwhile */
export async function consumeTicket(ticket: string): Promise<boolean> {
  const r = await authDb.loginCode.updateMany({
    where: { ticketHash: hashToken(ticket), usedAt: null },
    data: { usedAt: new Date() },
  });
  return r.count === 1;
}

export type SecondFactorResult =
  | { ok: true; userId: string; method: 'totp' | 'recovery' }
  | { ok: false; error: 'expired' | 'locked' | 'wrong' | NoAccessReason };

/**
 * Second step after the email code: a code of the authenticator app, or one of the recovery codes (for a lost
 * device or a user who has only a passkey).
 */
export async function completeWithSecondFactor(ticket: string, input: string, ip: string): Promise<SecondFactorResult> {
  const row = await ticketOf(ticket, 'LOGIN');
  if (!row) return { ok: false, error: 'expired' };
  const email = row.email;
  if (await isLocked(email, ip)) return { ok: false, error: 'locked' };
  const user = await authDb.user.findUnique({ where: { email }, select: { id: true, totpSecretEnc: true } });
  if (!user) return { ok: false, error: 'expired' };

  const digits = input.replace(/\s/g, '');
  let method: 'totp' | 'recovery' | null = null;
  if (/^\d{6}$/.test(digits)) {
    if (user.totpSecretEnc && verifyTotp(decrypt(user.totpSecretEnc), digits)) method = 'totp';
  } else if (await redeemRecoveryCode(user.id, input)) {
    method = 'recovery';
  }
  if (!method) return { ok: false, error: (await fail(email, ip)) ? 'locked' : 'wrong' };

  const access = await accessOf(user.id);
  if (!access.ok) return { ok: false, error: access.reason };
  if (!(await consumeTicket(ticket))) return { ok: false, error: 'expired' };
  await authDb.loginFailure.deleteMany({ where: { email } });
  return { ok: true, userId: user.id, method };
}
