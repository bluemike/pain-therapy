'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { requirePractice } from '@/lib/practice';
import {
  inviteMember,
  inviteSchema,
  resetMember,
  revokeInvitation,
  rolesOf,
  setMemberActive,
  setMemberRoles,
  TeamError,
} from '@/lib/team';

/** team-management (iteration 12, design D3, D4): actions of the page «Team», only for the practice admin */

async function run(
  fn: (actor: Awaited<ReturnType<typeof requireUser>>, practiceId: string) => Promise<void>,
  flash: string,
) {
  const actor = await requireUser('manageConsentTexts');
  const { id } = await requirePractice();
  try {
    await fn(actor, id);
  } catch (e) {
    if (e instanceof TeamError) redirect(`/practice/team?error=${e.code}`);
    throw e;
  }
  redirect(`/practice/team?flash=${flash}`);
}

export async function inviteAction(fd: FormData) {
  const parsed = inviteSchema.safeParse({ email: fd.get('email'), name: fd.get('name'), roles: rolesOf(fd) });
  if (!parsed.success) redirect('/practice/team?error=invalid');
  await run((actor, practiceId) => inviteMember(actor, practiceId, parsed.data).then(() => undefined), 'invited');
}

export async function revokeAction(fd: FormData) {
  await run((actor, practiceId) => revokeInvitation(actor, practiceId, String(fd.get('id'))), 'revoked');
}

export async function rolesAction(fd: FormData) {
  await run((actor, practiceId) => setMemberRoles(actor, practiceId, String(fd.get('userId')), rolesOf(fd)), 'roles');
}

export async function activeAction(fd: FormData) {
  const active = fd.get('active') === 'true';
  await run(
    (actor, practiceId) => setMemberActive(actor, practiceId, String(fd.get('userId')), active),
    active ? 'reactivated' : 'deactivated',
  );
}

export async function resetAction(fd: FormData) {
  await run((actor, practiceId) => resetMember(actor, practiceId, String(fd.get('userId'))), 'reset');
}
