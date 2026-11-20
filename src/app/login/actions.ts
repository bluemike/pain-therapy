'use server';

import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { authDb } from '@/lib/db';
import { config } from '@/lib/config';
import { accessOf, factorsOf, normalizeEmail } from '@/lib/auth/accounts';
import { requestCode, verifyCode } from '@/lib/auth/login-codes';
import { authenticationOptions } from '@/lib/auth/passkeys';
import {
  LOGIN_TICKET_COOKIE,
  clearTicket,
  clientIp,
  getTicket,
  safeCallback,
  setTicket,
  signInOrError,
} from '@/lib/auth/request';

/** Server actions of the sign-in page (therapist-login, design D2) */

export type StepResult = { ok: true; totp?: boolean } | { ok: false; error: string };

/** Step 1: code to the address. The same answer for addresses without an account. */
export async function requestCodeAction(email: string): Promise<StepResult> {
  const r = await requestCode(email, await clientIp());
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

/** Step 2: the code from the email; afterwards the account state may be told (the address is proven) */
export async function verifyCodeAction(email: string, code: string): Promise<StepResult> {
  const r = await verifyCode(email, code, await clientIp());
  if (!r.ok) return { ok: false, error: r.error };
  const user = await authDb.user.findUnique({ where: { email: normalizeEmail(email) }, select: { id: true } });
  if (!user) return { ok: false, error: 'expired' };
  const access = await accessOf(user.id);
  if (!access.ok) return { ok: false, error: access.reason };
  await setTicket(LOGIN_TICKET_COOKIE, r.ticket, config.auth.codeTtlMs / 1000);
  const factors = await factorsOf(user.id);
  return { ok: true, totp: factors.totp };
}

/** Step 3: authenticator or recovery code; redirects into the app on success */
export async function secondFactorAction(code: string, callbackUrl?: string): Promise<{ error: string }> {
  const ticket = await getTicket(LOGIN_TICKET_COOKIE);
  if (!ticket) return { error: 'expired' };
  return signInOrError(
    () => signIn('second-factor', { ticket, code, redirectTo: safeCallback(callbackUrl) }),
    () => clearTicket(LOGIN_TICKET_COOKIE),
  );
}

export async function passkeyOptionsAction(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return authenticationOptions();
}

export async function passkeySignInAction(
  response: AuthenticationResponseJSON,
  callbackUrl?: string,
): Promise<{ error: string }> {
  return signInOrError(() =>
    signIn('passkey', { response: JSON.stringify(response), redirectTo: safeCallback(callbackUrl) }),
  );
}

export async function devSignInAction(fd: FormData) {
  if (!config.devLogin) return;
  const r = await signInOrError(() =>
    signIn('dev', {
      name: fd.get('name'),
      email: fd.get('email'),
      role: fd.get('role'),
      practice: fd.get('practice'),
      redirectTo: safeCallback(String(fd.get('callbackUrl') ?? '')),
    }),
  );
  redirect(`/no-access?reason=${encodeURIComponent(r.error)}`);
}
