import 'server-only';
import type { PracticeRole } from '@prisma/client';
import { z } from 'zod';
import { createInvitation, InvitationDeliveryError, normalizeEmail } from './auth/accounts';
import { MailboxError, prepareMailbox, provisionMailbox, type MailboxChoice } from './mailboxes';
import { normalizeMobile } from './phone';

/**
 * Invitation with channel and mailbox (iteration 16, design D1, D3): one form on the team page and on the platform
 * page. Name, e-mail or SMS, and the mailbox: none (own address), a new one at pain-therapy.online, or an existing one
 * (platform admin only).
 */

export type OnboardingErrorCode =
  'invalid' | 'mobileInvalid' | 'mailboxNeedsSms' | MailboxError['code'] | InvitationDeliveryError['code'];

export class OnboardingError extends Error {
  constructor(public code: OnboardingErrorCode) {
    super(code);
  }
}

/** Every code a page may show from this module, as `onboarding.error_<code>` */
export const ONBOARDING_ERRORS: OnboardingErrorCode[] = [
  'invalid',
  'mobileInvalid',
  'mailboxNeedsSms',
  'mailboxDisabled',
  'mailboxInvalid',
  'mailboxTaken',
  'mailboxMissing',
  'mailboxQuota',
  'mailboxUnavailable',
  'mailboxRejected',
  'smsFailed',
  'smsDayLimit',
  'smsInvitationLimit',
  'noMobile',
];

const formSchema = z.object({
  name: z.string().trim().min(1).max(100),
  channel: z.enum(['EMAIL', 'SMS']),
  mobile: z.string().trim().max(40),
  mailbox: z.enum(['NONE', 'NEW', 'EXISTING']),
  localPart: z.string().trim().toLowerCase().max(64),
  email: z.string().trim().toLowerCase().max(200),
});

export type InviteForm = {
  name: string;
  channel: 'EMAIL' | 'SMS';
  mobile: string | null;
  mailbox: MailboxChoice;
  /** Own address (mailbox NONE) */
  email: string | null;
};

/** Reads the shared invitation fields; throws OnboardingError */
export function parseInviteForm(fd: FormData): InviteForm {
  const raw = formSchema.safeParse({
    name: fd.get('name') ?? '',
    channel: fd.get('channel') ?? 'EMAIL',
    mobile: fd.get('mobile') ?? '',
    mailbox: fd.get('mailbox') ?? 'NONE',
    localPart: fd.get('localPart') ?? '',
    email: fd.get('email') ?? '',
  });
  if (!raw.success) throw new OnboardingError('invalid');
  const v = raw.data;
  const mobile = v.mobile ? normalizeMobile(v.mobile) : null;
  if (v.mobile && !mobile) throw new OnboardingError('mobileInvalid');
  if (v.channel === 'SMS' && !mobile) throw new OnboardingError('mobileInvalid');
  // Nobody reads a brand-new mailbox yet: its invitation has to go by SMS
  if (v.mailbox === 'NEW' && v.channel !== 'SMS') throw new OnboardingError('mailboxNeedsSms');
  if (v.mailbox === 'NONE') {
    if (!z.email().safeParse(v.email).success) throw new OnboardingError('invalid');
    return { name: v.name, channel: v.channel, mobile, mailbox: { mode: 'NONE' }, email: normalizeEmail(v.email) };
  }
  if (!v.localPart) throw new OnboardingError('mailboxInvalid');
  return {
    name: v.name,
    channel: v.channel,
    mobile,
    mailbox: { mode: v.mailbox, localPart: v.localPart },
    email: null,
  };
}

/** The sign-in address the invitation will use; checks the mailbox (quota, free, exists) */
export async function resolveInviteAddress(
  form: InviteForm,
  opts: { practiceId: string | null; byPlatform: boolean },
): Promise<string> {
  try {
    const address = await prepareMailbox(form.mailbox, opts);
    return address ?? form.email!;
  } catch (e) {
    if (e instanceof MailboxError) throw new OnboardingError(e.code);
    throw e;
  }
}

/**
 * Sends the invitation (SMS or e-mail) and creates the mailbox at Infomaniak. A failing mailbox does not stop the
 * invitation (design D3); a failing SMS does, and nothing stays behind.
 */
export async function sendInvite(input: {
  form: InviteForm;
  email: string;
  practiceId: string | null;
  roles: PracticeRole[];
  invitedBy: string;
}) {
  let inv: { id: string; url: string };
  try {
    inv = await createInvitation({
      email: input.email,
      name: input.form.name,
      practiceId: input.practiceId,
      roles: input.roles,
      invitedBy: input.invitedBy,
      channel: input.form.channel,
      mobile: input.form.mobile,
    });
  } catch (e) {
    if (e instanceof InvitationDeliveryError) throw new OnboardingError(e.code);
    throw e;
  }
  if (input.form.mailbox.mode !== 'NONE')
    await provisionMailbox({
      mode: input.form.mailbox.mode,
      address: input.email,
      practiceId: input.practiceId,
      invitationId: inv.id,
    });
  return inv;
}
