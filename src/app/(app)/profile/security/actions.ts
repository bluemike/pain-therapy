'use server';

import { revalidatePath } from 'next/cache';
import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { authDb } from '@/lib/db';
import { requireSignedIn } from '@/lib/session';
import { issueRecoveryCodes } from '@/lib/auth/accounts';
import { deviceLabel, registerPasskey, registrationOptions } from '@/lib/auth/passkeys';
import { confirmTotpSetup, startTotpSetup } from '@/lib/auth/totp-setup';
import { userAgent } from '@/lib/auth/request';

/**
 * Page "Anmeldung" (therapist-login): own passkeys, authenticator app and recovery codes. Changes need a sign-in of the
 * last 15 minutes, so a forgotten open session cannot add a factor for someone else.
 */

const RECENT_MS = 15 * 60 * 1000;

type R<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function recentUser(): Promise<{ id: string } | null> {
  const u = await requireSignedIn();
  return Date.now() - u.authTime <= RECENT_MS ? u : null;
}

export async function addPasskeyOptionsAction(): Promise<R<{ options: PublicKeyCredentialCreationOptionsJSON }>> {
  const u = await recentUser();
  if (!u) return { ok: false, error: 'reauth' };
  return { ok: true, options: await registrationOptions(u.id) };
}

export async function addPasskeyAction(response: RegistrationResponseJSON): Promise<R> {
  const u = await recentUser();
  if (!u) return { ok: false, error: 'reauth' };
  if (!(await registerPasskey(u.id, response, deviceLabel(await userAgent())))) return { ok: false, error: 'passkey' };
  revalidatePath('/profile/security');
  return { ok: true };
}

export async function totpStartAction(): Promise<R<{ secret: string; qrSvg: string }>> {
  const u = await recentUser();
  if (!u) return { ok: false, error: 'reauth' };
  return { ok: true, ...(await startTotpSetup(u.id)) };
}

export async function totpConfirmAction(code: string): Promise<R> {
  const u = await recentUser();
  if (!u) return { ok: false, error: 'reauth' };
  if (!(await confirmTotpSetup(u.id, code))) return { ok: false, error: 'wrong' };
  revalidatePath('/profile/security');
  return { ok: true };
}

/** Removing a passkey or the authenticator keeps at least one factor */
async function factorCount(userId: string) {
  const u = await authDb.user.findUniqueOrThrow({
    where: { id: userId },
    select: { totpEnabledAt: true, _count: { select: { passkeys: true } } },
  });
  return u._count.passkeys + (u.totpEnabledAt ? 1 : 0);
}

export async function removePasskeyAction(id: string): Promise<R> {
  const u = await recentUser();
  if (!u) return { ok: false, error: 'reauth' };
  if ((await factorCount(u.id)) <= 1) return { ok: false, error: 'lastFactor' };
  await authDb.passkey.deleteMany({ where: { id, userId: u.id } });
  revalidatePath('/profile/security');
  return { ok: true };
}

export async function removeTotpAction(): Promise<R> {
  const u = await recentUser();
  if (!u) return { ok: false, error: 'reauth' };
  if ((await factorCount(u.id)) <= 1) return { ok: false, error: 'lastFactor' };
  await authDb.user.update({
    where: { id: u.id },
    data: { totpSecretEnc: null, totpPendingEnc: null, totpEnabledAt: null },
  });
  revalidatePath('/profile/security');
  return { ok: true };
}

export async function newRecoveryCodesAction(): Promise<R<{ codes: string[] }>> {
  const u = await recentUser();
  if (!u) return { ok: false, error: 'reauth' };
  const codes = await issueRecoveryCodes(u.id);
  revalidatePath('/profile/security');
  return { ok: true, codes };
}
