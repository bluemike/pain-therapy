import 'server-only';
import { PLATFORM_NAME } from '@pain-therapy/shared/brand';
import type { PracticeRole, Prisma } from '@prisma/client';
import { authDb } from '../db';
import { config } from '../config';
import { getMailer } from '../mail';
import { translator } from '../i18n-server';
import { assertSmsAllowed, sendSms } from '../sms';
import { presetFor } from '../profile-presets';
import { randomBytes } from 'node:crypto';
import { hashToken, hmac, normalizeRecoveryCode, randomToken, recoveryCode } from './crypto';

/**
 * Accounts of the practice app without Entra (iteration 12, design D2 to D4): who may sign in, with which roles in
 * which practice, recovery codes, invitations and the reset of a user's sign-in.
 */

/** Roles inside the app, as before iteration 12: PRACTICE_ADMIN of the membership is ADMIN */
export type AppRole = 'THERAPIST' | 'ADMIN';

export const appRolesOf = (roles: PracticeRole[]): AppRole[] =>
  [...new Set(roles.map((r) => (r === 'PRACTICE_ADMIN' ? 'ADMIN' : 'THERAPIST') as AppRole))].sort();

export type NoAccessReason = 'unknown' | 'inactive' | 'suspended' | 'noMembership' | 'signedOut';

export type Access =
  | {
      ok: true;
      userId: string;
      name: string;
      email: string;
      practiceId: string | null;
      roles: AppRole[];
      platformAdmin: boolean;
    }
  | { ok: false; reason: NoAccessReason };

/**
 * Whether a user may use the app now. Read on every request (roles and practice status come from the database, design
 * D2); `authTime` rejects sessions issued before the last sign-out or reset.
 */
export async function accessOf(userId: string, authTime?: number): Promise<Access> {
  const u = await authDb.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      activatedAt: true,
      signedOutAt: true,
      platformAdmin: true,
      memberships: {
        where: { active: true },
        select: { practiceId: true, roles: true, practice: { select: { status: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!u) return { ok: false, reason: 'unknown' };
  if (!u.activatedAt) return { ok: false, reason: 'inactive' };
  if (authTime !== undefined && u.signedOutAt && u.signedOutAt.getTime() >= authTime)
    return { ok: false, reason: 'signedOut' };
  // A user belongs to one practice (design D3); the data model would allow more
  const m = u.memberships[0];
  const base = { ok: true as const, userId: u.id, name: u.name, email: u.email, platformAdmin: u.platformAdmin };
  if (!m) return u.platformAdmin ? { ...base, practiceId: null, roles: [] } : { ok: false, reason: 'noMembership' };
  if (m.practice.status !== 'ACTIVE') return { ok: false, reason: 'suspended' };
  return { ...base, practiceId: m.practiceId, roles: appRolesOf(m.roles) };
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// --- Recovery codes -------------------------------------------------------------------------------------------------

/** 10 new codes, replacing the old ones; the plain codes exist only in the return value (shown once) */
export async function issueRecoveryCodes(userId: string, tx: Prisma.TransactionClient = authDb): Promise<string[]> {
  const codes = Array.from({ length: 10 }, recoveryCode);
  await tx.recoveryCode.deleteMany({ where: { userId } });
  await tx.recoveryCode.createMany({ data: codes.map((c) => ({ userId, codeHash: hmac(`recovery:${c}`) })) });
  return codes;
}

/** Uses up a recovery code; false for a wrong or used one */
export async function redeemRecoveryCode(userId: string, input: string): Promise<boolean> {
  const code = normalizeRecoveryCode(input);
  if (!code) return false;
  const r = await authDb.recoveryCode.updateMany({
    where: { userId, codeHash: hmac(`recovery:${code}`), usedAt: null },
    data: { usedAt: new Date() },
  });
  return r.count === 1;
}

export async function remainingRecoveryCodes(userId: string) {
  return authDb.recoveryCode.count({ where: { userId, usedAt: null } });
}

// --- Invitations ----------------------------------------------------------------------------------------------------

export type InvitationInput = {
  email: string;
  /** null: invitation as platform administrator */
  practiceId: string | null;
  roles: PracticeRole[];
  platformAdmin?: boolean;
  /** Name of the invited person, taken over by the new account */
  name?: string | null;
  /** Name of who invites, shown in the mail and on the page */
  invitedBy: string;
  /** Iteration 16/19 (design D1): SMS with the link to `mobile` (E.164), the mail, or both */
  channel?: 'EMAIL' | 'SMS' | 'BOTH';
  mobile?: string | null;
  /** Iteration 19 (design D1): where the mail and the e-mail code go when not to the sign-in address */
  notifyEmail?: string | null;
};

export class InvitationDeliveryError extends Error {
  constructor(public code: 'smsFailed' | 'smsDayLimit' | 'smsInvitationLimit' | 'noMobile' | 'noEmail') {
    super(code);
  }
}

const smsLimitCode = (e: { code?: string }) =>
  e.code === 'smsInvitationLimit' ? ('smsInvitationLimit' as const) : ('smsDayLimit' as const);

/**
 * Creates an invitation (7 days, single use) and sends its link by SMS, by mail or both. An older open invitation of
 * the same address to the same practice stops working. With both channels (iteration 19, design D1) the invitation
 * stays when one of them goes out (`smsFailed` tells the page); when none does, nothing stays behind.
 */
export async function createInvitation(
  input: InvitationInput,
): Promise<{ id: string; url: string; smsFailed?: boolean }> {
  const email = normalizeEmail(input.email);
  const channel = input.channel ?? 'EMAIL';
  const notify = input.notifyEmail ? normalizeEmail(input.notifyEmail) : null;
  const notifyEmail = notify && notify !== email ? notify : null;
  const bySms = channel !== 'EMAIL';
  const byMail = channel !== 'SMS';
  if (bySms && !input.mobile) throw new InvitationDeliveryError('noMobile');
  // SMS only: nothing is created when the SMS could not go out anyway
  const smsBlocked = bySms
    ? await assertSmsAllowed().then(
        () => null,
        (e: { code?: string }) => smsLimitCode(e),
      )
    : null;
  if (smsBlocked && !byMail) throw new InvitationDeliveryError(smsBlocked);
  const token = randomToken();
  const inv = await authDb.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { email, practiceId: input.practiceId, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return tx.invitation.create({
      data: {
        email,
        practiceId: input.practiceId,
        roles: input.roles,
        platformAdmin: input.platformAdmin ?? false,
        name: input.name?.trim() || null,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + config.auth.invitationTtlMs),
        invitedBy: input.invitedBy,
        channel,
        mobile: input.mobile ?? null,
        notifyEmail,
      },
      include: { practice: { select: { name: true, contactEmail: true } } },
    });
  });
  const url = `${config.auth.appUrl}/einladung/${token}`;
  const revoke = () => authDb.invitation.update({ where: { id: inv.id }, data: { revokedAt: new Date() } });

  let smsError = smsBlocked as InvitationDeliveryError['code'] | null;
  if (bySms && !smsBlocked) {
    const t = translator('de', 'authMail');
    // Short path for the 160 characters of one SMS (design D1)
    const first = (inv.name ?? '').split(/\s+/)[0] ?? '';
    const sent = await sendSms({
      to: input.mobile!,
      text: t('invitationSms', {
        practice: inv.practice?.name ?? PLATFORM_NAME,
        name: first ? ` ${first},` : '',
        url: `${config.auth.appUrl}/e/${token}`,
      }),
      purpose: 'INVITATION',
      invitationId: inv.id,
    }).then(
      (ok): InvitationDeliveryError['code'] | null => (ok ? null : 'smsFailed'),
      (e: { code?: string }) => smsLimitCode(e),
    );
    smsError = sent;
  }
  if (!byMail) {
    if (smsError) {
      await revoke();
      throw new InvitationDeliveryError(smsError);
    }
    return { id: inv.id, url };
  }
  try {
    await sendInvitationMail(inv, notifyEmail ?? email, url, input.invitedBy);
  } catch (e) {
    // With both channels the SMS alone is enough; without it nothing stays behind
    if (!bySms || smsError) {
      await revoke();
      if (smsError) throw new InvitationDeliveryError(smsError);
      throw e;
    }
    console.error('Invitation mail could not be sent', e instanceof Error ? e.message : e);
  }
  return smsError ? { id: inv.id, url, smsFailed: true } : { id: inv.id, url };
}

async function sendInvitationMail(
  inv: { name: string | null; practice: { name: string; contactEmail: string | null } | null },
  to: string,
  url: string,
  inviter: string,
) {
  const t = translator('de', 'authMail');
  const vars = { inviter, name: inv.name ? ` ${inv.name}` : '', url };
  // Iteration 13: own wording for the platform account; practice invitations come from the practice (display name,
  // reply to its contact address), the practice name in bold
  await getMailer().send(
    inv.practice
      ? {
          to,
          subject: t('invitationSubject', { practice: inv.practice.name }),
          text: t('invitationText', { ...vars, practice: inv.practice.name }),
          fromName: inv.practice.name,
          replyTo: inv.practice.contactEmail || undefined,
          bold: [inv.practice.name],
        }
      : {
          to,
          subject: t('invitationPlatformSubject'),
          text: t('invitationPlatformText', vars),
          bold: [PLATFORM_NAME],
        },
  );
}

// Iteration 19 (design D3): the printed sheet carries a short link to type, 12 characters without look-alikes
// (Crockford base32, 60 bits). The link alone is not enough: the code still goes to the stored number or address.
const SHORT_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** A new short token for the printed sheet, grouped for reading: 7KQ4-M2XD-9PRT */
export function shortInvitationToken(): string {
  const bytes = randomBytes(12);
  const raw = Array.from(bytes, (b) => SHORT_ALPHABET[b % 32]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}

/** The form of a token whose hash is stored: the long token as is, a short one normalized; null when neither */
export function invitationTokenKey(token: string): string | null {
  if (/^[A-Za-z0-9_-]{43}$/.test(token)) return token;
  const short = token.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return short.length === 12 && [...short].every((c) => SHORT_ALPHABET.includes(c)) ? `S:${short}` : null;
}

export type InvitationView =
  | {
      ok: true;
      id: string;
      email: string;
      practiceName: string | null;
      roles: PracticeRole[];
      platformAdmin: boolean;
      invitedBy: string;
      channel: 'EMAIL' | 'SMS' | 'BOTH';
      mobile: string | null;
      /** Iteration 19: address of the invitation mail and the e-mail code */
      notifyEmail: string;
      expiresAt: Date;
      /** A mailbox at pain-therapy.online comes with the invitation (iteration 16) */
      mailbox: boolean;
    }
  | { ok: false; reason: 'notFound' | 'expired' | 'used' };

export async function invitationByToken(token: string): Promise<InvitationView> {
  const key = invitationTokenKey(token);
  if (!key) return { ok: false, reason: 'notFound' };
  const inv = await authDb.invitation.findUnique({
    where: { tokenHash: hashToken(key) },
    include: { practice: { select: { name: true, status: true } }, mailbox: { select: { id: true } } },
  });
  return viewOf(inv);
}

export async function invitationById(id: string): Promise<InvitationView> {
  const inv = await authDb.invitation.findUnique({
    where: { id },
    include: { practice: { select: { name: true, status: true } }, mailbox: { select: { id: true } } },
  });
  return viewOf(inv);
}

function viewOf(
  inv:
    | (Prisma.InvitationGetPayload<object> & {
        practice: { name: string; status: string } | null;
        mailbox: { id: string } | null;
      })
    | null
    | undefined,
): InvitationView {
  if (!inv || inv.revokedAt) return { ok: false, reason: 'notFound' };
  if (inv.acceptedAt) return { ok: false, reason: 'used' };
  if (inv.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };
  return {
    ok: true,
    id: inv.id,
    email: inv.email,
    practiceName: inv.practice?.name ?? null,
    roles: inv.roles,
    platformAdmin: inv.platformAdmin,
    invitedBy: inv.invitedBy,
    channel: inv.channel,
    mobile: inv.mobile,
    notifyEmail: inv.notifyEmail ?? inv.email,
    expiresAt: inv.expiresAt,
    mailbox: !!inv.mailbox,
  };
}

export type PrintedInvitation = {
  name: string | null;
  email: string;
  practiceName: string | null;
  shortUrl: string;
  /** Short link without the scheme, to type */
  shortLabel: string;
  expiresAt: Date;
  mailbox: boolean;
};

/**
 * Iteration 19 (design D3): «Einladung drucken». Only the hash of a link is stored, so printing issues a new short
 * link for the open invitation; the links of the SMS and the mail stop working. `practiceId` limits the practice admin
 * to her practice (undefined: platform administrator). Null when the invitation is not open (any more).
 */
export async function reissueInvitationForPrint(
  invitationId: string,
  practiceId?: string,
): Promise<PrintedInvitation | null> {
  const token = shortInvitationToken();
  const r = await authDb.invitation.updateMany({
    where: {
      id: invitationId,
      ...(practiceId ? { practiceId } : {}),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { tokenHash: hashToken(invitationTokenKey(token)!) },
  });
  if (!r.count) return null;
  const inv = await authDb.invitation.findUniqueOrThrow({
    where: { id: invitationId },
    include: { practice: { select: { name: true } }, mailbox: { select: { id: true } } },
  });
  const shortUrl = `${config.auth.appUrl}/e/${token}`;
  return {
    name: inv.name,
    email: inv.email,
    practiceName: inv.practice?.name ?? null,
    shortUrl,
    shortLabel: shortUrl.replace(/^https?:\/\//, ''),
    expiresAt: inv.expiresAt,
    mailbox: !!inv.mailbox,
  };
}

/** The user of an invitation, created on the first confirmed email code (still inactive) */
export async function userForInvitation(invitationId: string): Promise<string> {
  const inv = await authDb.invitation.findUniqueOrThrow({ where: { id: invitationId } });
  const u = await authDb.user.upsert({
    where: { email: inv.email },
    create: {
      email: inv.email,
      name: inv.name ?? inv.email.split('@')[0] ?? inv.email,
      mobile: inv.mobile,
      ...presetFor(inv.email),
    },
    update: inv.mobile ? { mobile: inv.mobile } : {},
    select: { id: true },
  });
  return u.id;
}

/**
 * Called once the invited user has a second factor: the account becomes active, the membership (or the platform role)
 * starts, the invitation is used up. Returns the 10 recovery codes to show once.
 */
export async function acceptInvitation(invitationId: string, userId: string): Promise<string[]> {
  return authDb.$transaction(async (tx) => {
    const inv = await tx.invitation.findUniqueOrThrow({ where: { id: invitationId } });
    const used = await tx.invitation.updateMany({
      where: { id: invitationId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      data: { acceptedAt: new Date() },
    });
    if (used.count !== 1) throw new Error('Invitation is no longer valid');
    if (inv.practiceId)
      await tx.practiceMembership.upsert({
        where: { userId_practiceId: { userId, practiceId: inv.practiceId } },
        create: { userId, practiceId: inv.practiceId, roles: inv.roles },
        update: { roles: inv.roles, active: true },
      });
    await tx.user.update({
      where: { id: userId },
      data: { activatedAt: new Date(), ...(inv.platformAdmin ? { platformAdmin: true } : {}) },
    });
    // Iteration 16: the mailbox of the invitation belongs to the account from now on
    await tx.mailboxProvisioning.updateMany({ where: { invitationId }, data: { userId } });
    return issueRecoveryCodes(userId, tx);
  });
}

/**
 * "Anmeldung zurücksetzen" (therapist-login: Gerät verloren): removes passkeys, TOTP and recovery codes, ends all
 * sessions and sends a new invitation with the same roles. The caller checks that the actor may do this.
 */
export async function resetSignIn(userId: string, invitedBy: string): Promise<{ url: string }> {
  const u = await authDb.user.findUniqueOrThrow({
    where: { id: userId },
    include: { memberships: { where: { active: true }, orderBy: { createdAt: 'asc' } } },
  });
  await authDb.$transaction([
    authDb.passkey.deleteMany({ where: { userId } }),
    authDb.recoveryCode.deleteMany({ where: { userId } }),
    authDb.user.update({
      where: { id: userId },
      data: {
        totpSecretEnc: null,
        totpPendingEnc: null,
        totpEnabledAt: null,
        activatedAt: null,
        signedOutAt: new Date(),
      },
    }),
  ]);
  const m = u.memberships[0];
  const { url } = await createInvitation({
    email: u.email,
    practiceId: m?.practiceId ?? null,
    roles: m?.roles ?? [],
    platformAdmin: u.platformAdmin,
    name: u.name,
    invitedBy,
    // Iteration 16 (sms-invitation: Anmeldung zurücksetzen über denselben Kanal)
    ...(u.mobile ? { channel: 'SMS' as const, mobile: u.mobile } : {}),
  });
  return { url };
}

/** Which factors a user has, for the sign-in steps and the page "Anmeldung" */
export async function factorsOf(userId: string) {
  const u = await authDb.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      totpEnabledAt: true,
      passkeys: { select: { id: true, label: true, createdAt: true, lastUsedAt: true }, orderBy: { createdAt: 'asc' } },
      _count: { select: { recoveryCodes: { where: { usedAt: null } } } },
    },
  });
  return { totp: !!u.totpEnabledAt, passkeys: u.passkeys, recoveryCodesLeft: u._count.recoveryCodes };
}
