import 'server-only';
import type { PracticeRole, Prisma } from '@prisma/client';
import { authDb } from '../db';
import { config } from '../config';
import { getMailer } from '../mail';
import { translator } from '../i18n-server';
import { presetFor } from '../profile-presets';
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
};

/**
 * Creates an invitation (7 days, single use) and sends its link to the address. An older open invitation of the same
 * address to the same practice stops working.
 */
export async function createInvitation(input: InvitationInput): Promise<{ id: string; url: string }> {
  const email = normalizeEmail(input.email);
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
      },
      include: { practice: { select: { name: true } } },
    });
  });
  const url = `${config.auth.appUrl}/einladung/${token}`;
  const t = translator('de', 'authMail');
  await getMailer().send({
    to: email,
    subject: t('invitationSubject'),
    text: t('invitationText', {
      inviter: input.invitedBy,
      practice: inv.practice?.name ?? t('platform'),
      url,
    }),
  });
  return { id: inv.id, url };
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
    }
  | { ok: false; reason: 'notFound' | 'expired' | 'used' };

export async function invitationByToken(token: string): Promise<InvitationView> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return { ok: false, reason: 'notFound' };
  const inv = await authDb.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { practice: { select: { name: true, status: true } } },
  });
  return viewOf(inv);
}

export async function invitationById(id: string): Promise<InvitationView> {
  const inv = await authDb.invitation.findUnique({
    where: { id },
    include: { practice: { select: { name: true, status: true } } },
  });
  return viewOf(inv);
}

function viewOf(
  inv: (Prisma.InvitationGetPayload<object> & { practice: { name: string; status: string } | null }) | null | undefined,
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
  };
}

/** The user of an invitation, created on the first confirmed email code (still inactive) */
export async function userForInvitation(invitationId: string): Promise<string> {
  const inv = await authDb.invitation.findUniqueOrThrow({ where: { id: invitationId } });
  const u = await authDb.user.upsert({
    where: { email: inv.email },
    create: { email: inv.email, name: inv.name ?? inv.email.split('@')[0] ?? inv.email, ...presetFor(inv.email) },
    update: {},
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
