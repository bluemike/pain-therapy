'use server';

import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { requirePractice } from '@/lib/practice';
import { OnboardingError, parseInviteForm } from '@/lib/onboarding';
import { MailboxError, retryMailbox } from '@/lib/mailboxes';
import { invitationSheet, type InvitationSheet } from '@/lib/invitation-sheet';
import {
  inviteMember,
  printInvitation,
  resetMember,
  revokeInvitation,
  rolesOf,
  setMemberActive,
  setMemberRoles,
  TeamError,
} from '@/lib/team';

/** team-management (iteration 12, design D3, D4): actions of the page «Team», only for the practice admin */

async function run(
  fn: (actor: Awaited<ReturnType<typeof requireUser>>, practiceId: string) => Promise<void | string>,
  flash: string,
) {
  const actor = await requireUser('manageConsentTexts');
  const { id } = await requirePractice();
  try {
    // A function may answer with another flash (iteration 19: the SMS of «beides» failed)
    flash = (await fn(actor, id)) || flash;
  } catch (e) {
    if (e instanceof TeamError || e instanceof OnboardingError || e instanceof MailboxError)
      redirect(`/practice/team?error=${e.code}`);
    throw e;
  }
  redirect(`/practice/team?flash=${flash}`);
}

/** Iteration 16/19: by SMS, e-mail or both, with or without a mailbox at pain-therapy.online */
export async function inviteAction(fd: FormData) {
  await run(
    (actor, practiceId) =>
      inviteMember(actor, practiceId, parseInviteForm(fd), rolesOf(fd)).then((inv) =>
        inv.smsFailed ? 'invitedSmsFailed' : undefined,
      ),
    'invited',
  );
}

/** Iteration 16 (design D3): «Erneut versuchen» for a mailbox Infomaniak did not create */
export async function retryMailboxAction(fd: FormData) {
  await run((_actor, practiceId) => retryMailbox(String(fd.get('id')), practiceId), 'mailboxRetried');
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

/** Iteration 19 (design D3): «Einladung drucken»; a new link replaces the one of the SMS and the mail */
export async function printInvitationAction(
  invitationId: string,
): Promise<{ ok: true; sheet: InvitationSheet } | { ok: false }> {
  const actor = await requireUser('manageConsentTexts');
  const { id } = await requirePractice();
  try {
    return { ok: true, sheet: await invitationSheet(await printInvitation(actor, id, invitationId)) };
  } catch (e) {
    if (e instanceof TeamError) return { ok: false };
    throw e;
  }
}
