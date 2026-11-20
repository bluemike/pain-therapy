import 'server-only';
import type { PracticeRole } from '@prisma/client';
import { z } from 'zod';
import { authDb } from './db';
import { audit } from './audit';
import { createInvitation, normalizeEmail, resetSignIn } from './auth/accounts';
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

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  name: z.string().trim().min(1).max(100),
  roles: z.array(z.enum(['PRACTICE_ADMIN', 'THERAPIST'])).min(1),
});

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
        user: { select: { id: true, name: true, email: true, activatedAt: true, lastLoginAt: true } },
      },
    }),
    authDb.invitation.findMany({
      where: { practiceId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select: { id: true, email: true, name: true, roles: true, expiresAt: true, invitedBy: true },
    }),
  ]);
  return {
    members: members.map((m) => ({ ...m.user, roles: m.roles, active: m.active, activated: !!m.user.activatedAt })),
    invitations,
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
 * person belongs to one practice, so an address with an active membership elsewhere is refused.
 */
export async function inviteMember(actor: Actor, practiceId: string, input: z.infer<typeof inviteSchema>) {
  const email = normalizeEmail(input.email);
  const user = await authDb.user.findUnique({
    where: { email },
    select: { platformAdmin: true, memberships: { where: { active: true }, select: { practiceId: true } } },
  });
  if (user?.platformAdmin) throw new TeamError('otherPractice');
  if (user?.memberships.some((m) => m.practiceId === practiceId)) throw new TeamError('member');
  if (user?.memberships.length) throw new TeamError('otherPractice');
  const inv = await createInvitation({
    email,
    name: input.name,
    practiceId,
    roles: input.roles,
    invitedBy: actor.name,
  });
  await audit(actor, 'team.invited', { after: email, details: { roles: input.roles, invitationId: inv.id } });
  return inv;
}

export async function revokeInvitation(actor: Actor, practiceId: string, invitationId: string) {
  const r = await authDb.invitation.updateMany({
    where: { id: invitationId, practiceId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!r.count) throw new TeamError('notFound');
  await audit(actor, 'team.invitationRevoked', { details: { invitationId } });
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
  await resetSignIn(userId, actor.name);
  await audit(actor, 'team.signInReset', { details: { email: m.user.email } });
}
