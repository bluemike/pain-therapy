import { PLATFORM_NAME } from '@pain-therapy/shared/brand';
import type { OutgoingMail } from './mail';
import { currentPractice } from './practice';

/**
 * Sender of a patient mail (iteration 12, design D7): noreply@ with the practice name as display name. Answers go to
 * the therapist who sent it (iteration 16: her own address, e.g. christina.franz@ayanta.ch), otherwise to the contact
 * address of the practice. Without a practice the platform name.
 */
export async function practiceSender(
  replyTo?: string | null,
): Promise<Required<Pick<OutgoingMail, 'fromName'>> & Pick<OutgoingMail, 'replyTo'>> {
  const p = await currentPractice().catch(() => null);
  if (!p) return { fromName: PLATFORM_NAME, replyTo: replyTo || undefined };
  return { fromName: p.name, replyTo: replyTo || p.contactEmail || undefined };
}

/** Reply-To stored with a delivery: the sign-in address of the therapist who requested it */
export const replyToOf = (actor: { email?: string | null }) => actor.email?.trim().toLowerCase() || null;

/** Link of a document mail: opens the tab «Dokumente» of the zone after the date of birth */
export const documentsUrl = (url: string) => `${url}?tab=dokumente`;
