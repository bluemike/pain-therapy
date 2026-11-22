'use server';

import { revalidatePath } from 'next/cache';
import { requireSignedIn, requireUser } from '@/lib/session';
import { audit } from '@/lib/audit';
import { MailboxError, mailboxOf, requestNewAccess, revealAccess } from '@/lib/mailboxes';

/**
 * «Mein E-Mail-Postfach» (iteration 16, design D4): show the handed-over access once, or ask for a new one. Showing
 * needs a sign-in of the last 15 minutes, like changes under «Anmeldung», so a forgotten open session does not give
 * the password away.
 */

const RECENT_MS = 15 * 60 * 1000;

export type RevealResult =
  | {
      ok: true;
      address: string;
      password: string;
      profilePath: string;
      host: string;
      imapPort: number;
      smtpPort: number;
    }
  | { ok: false; error: 'reauth' | 'notFound' };

export async function revealAccessAction(): Promise<RevealResult> {
  const actor = await requireUser();
  const { authTime } = await requireSignedIn();
  if (Date.now() - authTime > RECENT_MS) return { ok: false, error: 'reauth' };
  try {
    const r = await revealAccess(actor.id, actor.name);
    await audit(actor, 'mailbox.accessShown', { details: { address: r.address } });
    revalidatePath('/postfach');
    return { ok: true, ...r };
  } catch (e) {
    if (e instanceof MailboxError) return { ok: false, error: 'notFound' };
    throw e;
  }
}

export async function requestAccessAction() {
  const actor = await requireUser();
  const mb = await mailboxOf(actor.id);
  if (!mb) return;
  await requestNewAccess(actor.id);
  await audit(actor, 'mailbox.accessRequested', { details: { address: mb.address } });
  revalidatePath('/postfach');
}
