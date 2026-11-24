'use server';

import type { PublicKeyCredentialCreationOptionsJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { signIn } from '@/auth';
import { config } from '@/lib/config';
import { acceptInvitation, invitationByToken, userForInvitation } from '@/lib/auth/accounts';
import { requestInvitationEmailCode, requestInvitationSmsCode, ticketOf, verifyCode } from '@/lib/auth/login-codes';
import { authDb } from '@/lib/db';
import { deviceLabel, registerPasskey, registrationOptions } from '@/lib/auth/passkeys';
import { confirmTotpSetup, startTotpSetup } from '@/lib/auth/totp-setup';
import {
  INVITE_TICKET_COOKIE,
  clearTicket,
  clientIp,
  getTicket,
  setTicket,
  signInOrError,
  userAgent,
} from '@/lib/auth/request';

/**
 * Accepting an invitation (therapist-login: Erste Einrichtung, design D4): confirm the email code, set up a passkey
 * or the authenticator app, see the recovery codes once, then into the app.
 */

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type CodeVia = 'SMS' | 'EMAIL';

/** The channels an invitation offers for its code (iteration 19, design D2) */
function viaOk(inv: { channel: 'EMAIL' | 'SMS' | 'BOTH'; mobile: string | null }, via: CodeVia) {
  return via === 'SMS' ? inv.channel !== 'EMAIL' && !!inv.mobile : inv.channel !== 'SMS';
}

export async function inviteSendCodeAction(token: string, via: CodeVia): Promise<Result> {
  const inv = await invitationByToken(token);
  if (!inv.ok) return { ok: false, error: inv.reason };
  if (!viaOk(inv, via)) return { ok: false, error: 'noMobile' };
  // Iteration 16/19: by SMS to the number, by e-mail to the private or the sign-in address
  const r =
    via === 'SMS'
      ? await requestInvitationSmsCode(inv.id, await clientIp())
      : await requestInvitationEmailCode(inv.id, await clientIp());
  return r.ok ? { ok: true } : { ok: false, error: r.error };
}

export async function inviteVerifyCodeAction(token: string, code: string, via: CodeVia): Promise<Result> {
  const inv = await invitationByToken(token);
  if (!inv.ok) return { ok: false, error: inv.reason };
  if (!viaOk(inv, via)) return { ok: false, error: 'wrong' };
  const r = await verifyCode(inv.email, code, await clientIp(), via === 'SMS' ? 'INVITATION_SMS' : 'INVITATION');
  if (!r.ok) return { ok: false, error: r.error };
  await userForInvitation(inv.id);
  await setTicket(INVITE_TICKET_COOKIE, r.ticket, (3 * config.auth.codeTtlMs) / 1000);
  return { ok: true };
}

/** The invited user behind the ticket cookie, while the invitation is open */
async function invited(): Promise<{ userId: string; invitationId: string } | null> {
  const row = await ticketOf(await getTicket(INVITE_TICKET_COOKIE), 'INVITATION');
  if (!row?.invitationId) return null;
  return { userId: await userForInvitation(row.invitationId), invitationId: row.invitationId };
}

export async function invitePasskeyOptionsAction(): Promise<
  Result<{ options: PublicKeyCredentialCreationOptionsJSON }>
> {
  const who = await invited();
  if (!who) return { ok: false, error: 'expired' };
  return { ok: true, options: await registrationOptions(who.userId) };
}

export async function invitePasskeyAction(response: RegistrationResponseJSON): Promise<Result<{ codes: string[] }>> {
  const who = await invited();
  if (!who) return { ok: false, error: 'expired' };
  if (!(await registerPasskey(who.userId, response, deviceLabel(await userAgent()))))
    return { ok: false, error: 'passkey' };
  return accept(who);
}

export async function inviteTotpStartAction(): Promise<Result<{ secret: string; qrSvg: string }>> {
  const who = await invited();
  if (!who) return { ok: false, error: 'expired' };
  return { ok: true, ...(await startTotpSetup(who.userId)) };
}

export async function inviteTotpConfirmAction(code: string): Promise<Result<{ codes: string[] }>> {
  const who = await invited();
  if (!who) return { ok: false, error: 'expired' };
  if (!(await confirmTotpSetup(who.userId, code))) return { ok: false, error: 'wrong' };
  return accept(who);
}

async function accept(who: { userId: string; invitationId: string }): Promise<Result<{ codes: string[] }>> {
  try {
    return { ok: true, codes: await acceptInvitation(who.invitationId, who.userId) };
  } catch {
    return { ok: false, error: 'used' };
  }
}

/**
 * After the recovery codes: sign in with the ticket and go to the start page, or (iteration 16, design D4) to the
 * mailbox access when the invitation came with a mailbox at pain-therapy.online.
 */
export async function inviteFinishAction(): Promise<{ error: string }> {
  const ticket = await getTicket(INVITE_TICKET_COOKIE);
  if (!ticket) return { error: 'expired' };
  const row = await ticketOf(ticket, 'INVITATION');
  const mailbox = row?.invitationId
    ? await authDb.mailboxProvisioning.findUnique({ where: { invitationId: row.invitationId }, select: { id: true } })
    : null;
  return signInOrError(
    () => signIn('invitation', { ticket, redirectTo: mailbox ? '/postfach?neu=1' : '/' }),
    () => clearTicket(INVITE_TICKET_COOKIE),
  );
}
