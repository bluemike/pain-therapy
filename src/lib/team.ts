import 'server-only';
import type { PracticeRole } from '@prisma/client';
import { authDb } from './db';
import { audit } from './audit';
import { InvitationDeliveryError, normalizeEmail, reissueInvitationForPrint, resetSignIn } from './auth/accounts';
import { resolveInviteAddress, sendInvite, OnboardingError, type InviteForm } from './onboarding';
import { mailboxStatesOf } from './mailboxes';
import type { Actor } from './session';

/**
 * team-management (iteration 12, design D3, D4): the practice admin invites people, gives roles, deactivates them and
 * resets their sign-in. A practice always keeps at least one active practice admin. Memberships, users and invitations
 * have no practice rows (no row-level security), so every function here filters by the practice itself.
 */

export class TeamError extends Error {
  constructor(public code: 'notFound' | 'lastAdmin' | 'self' | 'member' | 'otherPractice' | 'noRole') {
    super(code);
  }
}

/** Roles from the form checkboxes "Therapeut:in" and "Praxis-Admin" */
export function rolesOf(fd: FormData): PracticeRole[] {
  return (['THERAPIST', 'PRACTICE_ADMIN'] as const).filter((r) => fd.get(`role_${r}`) === 'on');
}

/** Members and open invitations of a practice for the page «Team» */
export async function teamOf(practiceId: string) {
  const [members, invitations] = await Promise.all([
    authDb.practiceMembership.findMany({
      where: { practiceId },
      orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
      select: {
        roles: true,
        active: true,
        user: { select: { id: true, name: true, email: true, activatedAt: true, lastLoginAt: true, mobile: true } },
      },
    }),
    authDb.invitation.findMany({
      where: { practiceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        expiresAt: true,
        invitedBy: true,
        channel: true,
        mobile: true,
        notifyEmail: true,
      },
    }),
  ]);
  const mailboxes = await mailboxStatesOf(practiceId);
  return {
    members: members.map((m) => ({
      ...m.user,
      roles: m.roles,
      active: m.active,
      activated: !!m.user.activatedAt,
      mailbox: mailboxes.get(m.user.email) ?? null,
    })),
    invitations: invitations.map((i) => ({ ...i, mailbox: mailboxes.get(i.email) ?? null })),
  };
}

async function membershipOf(practiceId: string, userId: string) {
  const m = await authDb.practiceMembership.findUnique({
    where: { userId_practiceId: { userId, practiceId } },
    select: { roles: true, active: true, user: { select: { email: true } } },
  });
  if (!m) throw new TeamError('notFound');
  return m;
}

/** Would the practice still have an active practice admin without this user (or with these roles for them)? */
async function keepsAdmin(practiceId: string, userId: string) {
  const others = await authDb.practiceMembership.count({
    where: { practiceId, active: true, userId: { not: userId }, roles: { has: 'PRACTICE_ADMIN' } },
  });
  return others > 0;
}

/**
 * Invites someone to the practice: a new address, an earlier member (back with new roles) or a deactivated one. A
 * person belongs to one practice, so an address with an active membership elsewhere is refused. Iteration 16: by SMS
 * or e-mail, with or without a mailbox at pain-therapy.online (the practice admin within the quota).
 */
export async function inviteMember(actor: Actor, practiceId: string, form: InviteForm, roles: PracticeRole[]) {
  if (!roles.length) throw new TeamError('noRole');
  const email = await resolveInviteAddress(form, { practiceId, byPlatform: false });
  await assertInvitableHere(practiceId, email);
  const inv = await sendInvite({ form, email, practiceId, roles, invitedBy: actor.name });
  await audit(actor, 'team.invited', {
    after: email,
    details: { roles, invitationId: inv.id, channel: form.channel, mailbox: form.mailbox.mode },
  });
  return inv;
}

async function assertInvitableHere(practiceId: string, rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const user = await authDb.user.findUnique({
    where: { email },
    select: { platformAdmin: true, memberships: { where: { active: true }, select: { practiceId: true } } },
  });
  if (user?.platformAdmin) throw new TeamError('otherPractice');
  if (user?.memberships.some((m) => m.practiceId === practiceId)) throw new TeamError('member');
  if (user?.memberships.length) throw new TeamError('otherPractice');
}

export async function revokeInvitation(actor: Actor, practiceId: string, invitationId: string) {
  const r = await authDb.invitation.updateMany({
    where: { id: invitationId, practiceId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!r.count) throw new TeamError('notFound');
  await audit(actor, 'team.invitationRevoked', { details: { invitationId } });
}

/** Iteration 19 (design D3): «Einladung drucken» for an open invitation of the practice; a new link replaces the old */
export async function printInvitation(actor: Actor, practiceId: string, invitationId: string) {
  const sheet = await reissueInvitationForPrint(invitationId, practiceId);
  if (!sheet) throw new TeamError('notFound');
  await audit(actor, 'team.invitationPrinted', { details: { invitationId } });
  return sheet;
}

/** New roles of a member; the last practice admin keeps the role */
export async function setMemberRoles(actor: Actor, practiceId: string, userId: string, roles: PracticeRole[]) {
  if (!roles.length) throw new TeamError('noRole');
  const m = await membershipOf(practiceId, userId);
  if (m.active && m.roles.includes('PRACTICE_ADMIN') && !roles.includes('PRACTICE_ADMIN'))
    if (!(await keepsAdmin(practiceId, userId))) throw new TeamError('lastAdmin');
  await authDb.practiceMembership.update({
    where: { userId_practiceId: { userId, practiceId } },
    data: { roles },
  });
  await audit(actor, 'team.rolesChanged', {
    before: m.roles.join(','),
    after: roles.join(','),
    details: { email: m.user.email },
  });
}

/**
 * Deactivate (sessions end at once, no sign-in any more) or reactivate a member. Not oneself, and not the last active
 * practice admin.
 */
export async function setMemberActive(actor: Actor, practiceId: string, userId: string, active: boolean) {
  if (userId === actor.id) throw new TeamError('self');
  const m = await membershipOf(practiceId, userId);
  if (!active && m.roles.includes('PRACTICE_ADMIN') && !(await keepsAdmin(practiceId, userId)))
    throw new TeamError('lastAdmin');
  await authDb.$transaction([
    authDb.practiceMembership.update({ where: { userId_practiceId: { userId, practiceId } }, data: { active } }),
    ...(active ? [] : [authDb.user.update({ where: { id: userId }, data: { signedOutAt: new Date() } })]),
  ]);
  await audit(actor, active ? 'team.reactivated' : 'team.deactivated', { details: { email: m.user.email } });
}

/** "Anmeldung zurücksetzen" for a member who lost their device: new invitation to the same address */
export async function resetMember(actor: Actor, practiceId: string, userId: string) {
  if (userId === actor.id) throw new TeamError('self');
  const m = await membershipOf(practiceId, userId);
  if (!m.active) throw new TeamError('notFound');
  try {
    await resetSignIn(userId, actor.name);
  } catch (e) {
    if (e instanceof InvitationDeliveryError) throw new OnboardingError(e.code);
    throw e;
  }
  await audit(actor, 'team.signInReset', { details: { email: m.user.email } });
}
