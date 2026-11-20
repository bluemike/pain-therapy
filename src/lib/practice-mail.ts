import { PLATFORM_NAME } from '@pain-therapy/shared/brand';
import type { OutgoingMail } from './mail';
import { currentPractice } from './practice';

/**
 * Sender of a patient mail (iteration 12, design D7): noreply@ with the practice name as display name, answers go to
 * the contact address of the practice. Without a practice the platform name.
 */
export async function practiceSender(): Promise<
  Required<Pick<OutgoingMail, 'fromName'>> & Pick<OutgoingMail, 'replyTo'>
> {
  const p = await currentPractice().catch(() => null);
  return p ? { fromName: p.name, replyTo: p.contactEmail || undefined } : { fromName: PLATFORM_NAME };
}

/** Link of a document mail: opens the tab «Dokumente» of the zone after the date of birth */
export const documentsUrl = (url: string) => `${url}?tab=dokumente`;
