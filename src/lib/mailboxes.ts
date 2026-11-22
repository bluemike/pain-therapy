import 'server-only';
import { randomBytes } from 'node:crypto';
import { PLATFORM_NAME } from '@pain-therapy/shared/brand';
import type { MailboxMode } from '@prisma/client';
import { authDb } from './db';
import { config } from './config';
import { decrypt, encrypt, hashToken, randomToken } from './auth/crypto';
import { InfomaniakError, mailService, mailboxesEnabled } from './infomaniak';
import { mailProfile } from './mail-profile';
import { sendSms } from './sms';
import { translator } from './i18n-server';
import { RESERVED_LOCAL_PARTS as RESERVED, validLocalPart } from './mailbox-address';

export { suggestLocalPart, validLocalPart } from './mailbox-address';

/**
 * Mailboxes at pain-therapy.online (iteration 16, design D3 to D5): created with an invitation, deleted again when the
 * invitation is never accepted, and the hand-over of a device password from the platform admin to the person, shown
 * once behind the passkey together with an Apple profile.
 */

export class MailboxError extends Error {
  constructor(
    public code:
      | 'mailboxDisabled'
      | 'mailboxInvalid'
      | 'mailboxTaken'
      | 'mailboxMissing'
      | 'mailboxQuota'
      | 'mailboxUnavailable'
      | 'mailboxRejected'
      | 'notFound'
      | 'reauth',
  ) {
    super(code);
  }
}

export const addressOf = (localPart: string) => `${localPart}@${config.mailboxes.domain}`;
export const isPlatformDomain = (email: string) => email.toLowerCase().endsWith(`@${config.mailboxes.domain}`);

function infomaniakFailure(e: unknown): never {
  if (e instanceof InfomaniakError) {
    if (e.code === 'disabled') throw new MailboxError('mailboxDisabled');
    if (e.code === 'taken') throw new MailboxError('mailboxTaken');
  }
  throw new MailboxError('mailboxUnavailable');
}

async function listMailboxes(): Promise<string[]> {
  try {
    return await mailService().list();
  } catch (e) {
    infomaniakFailure(e);
  }
}

/** Whether the address is free everywhere; with a suggestion (…2, …3) when it is not */
export async function checkAddress(localPart: string): Promise<{ free: boolean; suggestion: string | null }> {
  const existing = new Set(await listMailboxes());
  const used = async (lp: string) => {
    if (existing.has(lp) || RESERVED.has(lp)) return true;
    const address = addressOf(lp);
    const [row, user, inv] = await Promise.all([
      authDb.mailboxProvisioning.findFirst({ where: { address, status: { not: 'DELETED' } }, select: { id: true } }),
      authDb.user.findUnique({ where: { email: address }, select: { id: true } }),
      authDb.invitation.findFirst({
        where: { email: address, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      }),
    ]);
    return !!(row || user || inv);
  };
  if (!(await used(localPart))) return { free: true, suggestion: null };
  for (let n = 2; n < 20; n++) {
    const candidate = `${localPart.slice(0, 62)}${n}`;
    if (!(await used(candidate))) return { free: false, suggestion: candidate };
  }
  return { free: false, suggestion: null };
}

/** Mailboxes the practice has had created (mode NEW, not deleted), for the quota (design D5) */
export async function practiceMailboxCount(practiceId: string) {
  return authDb.mailboxProvisioning.count({ where: { practiceId, mode: 'NEW', status: { not: 'DELETED' } } });
}

export type MailboxChoice = { mode: 'NONE' } | { mode: MailboxMode; localPart: string };

/**
 * Before an invitation: checks the chosen mailbox and returns the sign-in address. Throws MailboxError. The practice
 * admin is limited by the quota of the practice and may not choose an existing mailbox (design D3, D5).
 */
export async function prepareMailbox(
  choice: MailboxChoice,
  opts: { practiceId: string | null; byPlatform: boolean },
): Promise<string | null> {
  if (choice.mode === 'NONE') return null;
  if (!mailboxesEnabled()) throw new MailboxError('mailboxDisabled');
  const lp = choice.localPart.trim().toLowerCase();
  if (!validLocalPart(lp)) throw new MailboxError('mailboxInvalid');
  if (choice.mode === 'EXISTING') {
    if (!opts.byPlatform) throw new MailboxError('mailboxInvalid');
    if (!(await listMailboxes()).includes(lp)) throw new MailboxError('mailboxMissing');
    return addressOf(lp);
  }
  if (!opts.byPlatform && opts.practiceId) {
    const p = await authDb.practice.findUnique({ where: { id: opts.practiceId }, select: { mailboxQuota: true } });
    if ((await practiceMailboxCount(opts.practiceId)) >= (p?.mailboxQuota ?? 0)) throw new MailboxError('mailboxQuota');
  }
  if (!(await checkAddress(lp)).free) throw new MailboxError('mailboxTaken');
  return addressOf(lp);
}

/** The API needs a password; it does not work for IMAP (test of 22.11.2026) and is thrown away */
const throwawayPassword = () => `${randomBytes(24).toString('base64url')}Aa1!`;

/**
 * After the invitation exists: records the mailbox and, for a new one, creates it at Infomaniak. A failure does not
 * stop the invitation; the row says FAILED and the team page offers a retry.
 */
export async function provisionMailbox(input: {
  mode: MailboxMode;
  address: string;
  practiceId: string | null;
  invitationId: string;
  userId?: string | null;
}) {
  const old = await authDb.mailboxProvisioning.findUnique({ where: { address: input.address } });
  // An existing mailbox (or one created before for the same person) moves to the new invitation
  const row = old
    ? await authDb.mailboxProvisioning.update({
        where: { id: old.id },
        data: {
          invitationId: input.invitationId,
          practiceId: input.practiceId,
          userId: input.userId ?? old.userId,
          ...(old.status === 'DELETED'
            ? { status: input.mode === 'EXISTING' ? 'CREATED' : 'FAILED', mode: input.mode }
            : {}),
        },
      })
    : await authDb.mailboxProvisioning.create({
        data: {
          address: input.address,
          mode: input.mode,
          status: input.mode === 'EXISTING' ? 'CREATED' : 'FAILED',
          practiceId: input.practiceId,
          invitationId: input.invitationId,
          userId: input.userId ?? null,
        },
      });
  if (row.mode === 'NEW' && row.status !== 'CREATED') await createAtInfomaniak(row.id);
  return authDb.mailboxProvisioning.findUniqueOrThrow({ where: { id: row.id } });
}

async function createAtInfomaniak(id: string) {
  const row = await authDb.mailboxProvisioning.findUniqueOrThrow({ where: { id } });
  const lp = row.address.split('@')[0]!;
  try {
    await mailService().create(lp, throwawayPassword());
    await authDb.mailboxProvisioning.update({ where: { id }, data: { status: 'CREATED', lastError: null } });
  } catch (e) {
    const taken = e instanceof InfomaniakError && e.code === 'taken';
    await authDb.mailboxProvisioning.update({
      where: { id },
      data: {
        status: taken ? 'CREATED' : 'FAILED',
        lastError: taken ? null : (e instanceof Error ? e.message : String(e)).slice(0, 300),
      },
    });
  }
}

/** «Erneut versuchen» on the team page; only rows of the practice (or any for the platform admin) */
export async function retryMailbox(id: string, practiceId: string | null) {
  const row = await authDb.mailboxProvisioning.findUnique({ where: { id } });
  if (!row || (practiceId && row.practiceId !== practiceId) || row.status !== 'FAILED')
    throw new MailboxError('notFound');
  await createAtInfomaniak(id);
}

/** On accepting the invitation: the mailbox belongs to the new account from now on */
export async function linkMailboxToUser(invitationId: string, userId: string) {
  await authDb.mailboxProvisioning.updateMany({ where: { invitationId }, data: { userId } });
}

/**
 * Housekeeping, run by the pages that show mailboxes and by the 5-minute job: handed-over passwords and profile links
 * expire, and new mailboxes of invitations that were never accepted are deleted at Infomaniak.
 */
export async function sweepMailboxes(now = new Date()) {
  await authDb.mailboxProvisioning.updateMany({
    where: { access: 'READY', handoverExpiresAt: { lt: now } },
    data: { access: 'EXPIRED', handoverEnc: null, handoverExpiresAt: null },
  });
  await authDb.mailboxProvisioning.updateMany({
    where: { profileExpiresAt: { lt: now } },
    data: { profileEnc: null, profileTokenHash: null, profileExpiresAt: null },
  });
  // An existing mailbox stays at Infomaniak; only our row (and a handed-over password) goes with its invitation
  await authDb.mailboxProvisioning.deleteMany({
    where: {
      mode: 'EXISTING',
      userId: null,
      invitation: { acceptedAt: null, OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }] },
    },
  });
  const orphans = await authDb.mailboxProvisioning.findMany({
    where: {
      mode: 'NEW',
      status: 'CREATED',
      userId: null,
      invitation: { acceptedAt: null, OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: now } }] },
    },
    select: { id: true, address: true },
  });
  for (const o of orphans) {
    try {
      await mailService().remove(o.address.split('@')[0]!);
    } catch (e) {
      if (!(e instanceof InfomaniakError && e.code === 'notFound')) {
        await authDb.mailboxProvisioning.update({
          where: { id: o.id },
          data: { lastError: (e instanceof Error ? e.message : String(e)).slice(0, 300) },
        });
        continue;
      }
    }
    await authDb.mailboxProvisioning.update({
      where: { id: o.id },
      data: { status: 'DELETED', access: 'OPEN', handoverEnc: null, lastError: null, invitationId: null },
    });
  }
}

/** Mailbox of a user for «Mein E-Mail-Postfach» */
export async function mailboxOf(userId: string) {
  return authDb.mailboxProvisioning.findFirst({
    where: { userId, status: 'CREATED' },
    select: {
      id: true,
      address: true,
      access: true,
      handedOverAt: true,
      deliveredAt: true,
      requestedAt: true,
      handoverExpiresAt: true,
    },
  });
}

/**
 * The platform admin hands over a device password created in the Manager (design D4): checked with an IMAP login,
 * kept encrypted for 14 days, and an SMS tells the person that it is ready.
 */
export async function handOverAccess(id: string, password: string) {
  const pw = password.trim();
  const row = await authDb.mailboxProvisioning.findUnique({
    where: { id },
    include: { user: { select: { id: true, mobile: true, activatedAt: true } } },
  });
  if (!row || row.status !== 'CREATED') throw new MailboxError('notFound');
  if (pw.length < 8 || pw.length > 200) throw new MailboxError('mailboxRejected');
  let ok = false;
  try {
    ok = await mailService().checkLogin(row.address, pw);
  } catch (e) {
    infomaniakFailure(e);
  }
  if (!ok) throw new MailboxError('mailboxRejected');
  await authDb.mailboxProvisioning.update({
    where: { id },
    data: {
      access: 'READY',
      handoverEnc: encrypt(pw),
      handedOverAt: new Date(),
      handoverExpiresAt: new Date(Date.now() + config.mailboxes.handoverTtlMs),
    },
  });
  if (row.user?.activatedAt && row.user.mobile) {
    const t = translator('de', 'authMail');
    await sendSms({
      to: row.user.mobile,
      text: t('mailboxReadySms', { url: `${config.auth.appUrl}/postfach` }),
      purpose: 'MAILBOX_READY',
      userId: row.user.id,
    }).catch((e) => console.error('Mailbox notice not sent', e instanceof Error ? e.message : e));
  }
  return { address: row.address };
}

/** «Neuen Zugang anfordern» under «Mein Profil»: a new task for the platform admin */
export async function requestNewAccess(userId: string) {
  const row = await mailboxOf(userId);
  if (!row) throw new MailboxError('notFound');
  if (row.access === 'READY') return;
  await authDb.mailboxProvisioning.update({
    where: { id: row.id },
    data: { access: 'OPEN', requestedAt: new Date() },
  });
}

/**
 * Shows the handed-over password once (design D4): decrypts it, deletes it and prepares the Apple profile behind a
 * one-time link valid 10 minutes.
 */
export async function revealAccess(userId: string, name: string) {
  const row = await authDb.mailboxProvisioning.findFirst({
    where: { userId, status: 'CREATED', access: 'READY', handoverExpiresAt: { gt: new Date() } },
  });
  if (!row?.handoverEnc) throw new MailboxError('notFound');
  const password = decrypt(row.handoverEnc);
  const token = randomToken();
  const { imapHost, imapPort, smtpPort, domain } = config.mailboxes;
  const profile = mailProfile({
    address: row.address,
    password,
    name,
    host: imapHost,
    imapPort,
    smtpPort,
    label: PLATFORM_NAME,
    idPrefix: domain.split('.').reverse().join('.'),
  });
  const done = await authDb.mailboxProvisioning.updateMany({
    where: { id: row.id, access: 'READY' },
    data: {
      access: 'DELIVERED',
      deliveredAt: new Date(),
      handoverEnc: null,
      handoverExpiresAt: null,
      requestedAt: null,
      profileTokenHash: hashToken(token),
      profileEnc: encrypt(profile),
      profileExpiresAt: new Date(Date.now() + config.mailboxes.profileTtlMs),
    },
  });
  if (done.count !== 1) throw new MailboxError('notFound');
  return {
    address: row.address,
    password,
    profilePath: `/api/mail-profile/${token}`,
    host: imapHost,
    imapPort,
    smtpPort,
  };
}

/** The Apple profile behind a one-time link; null when used or expired */
export async function takeProfile(token: string, userId: string): Promise<{ address: string; xml: string } | null> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const row = await authDb.mailboxProvisioning.findUnique({ where: { profileTokenHash: hashToken(token) } });
  if (!row?.profileEnc || row.userId !== userId || !row.profileExpiresAt || row.profileExpiresAt.getTime() < Date.now())
    return null;
  const taken = await authDb.mailboxProvisioning.updateMany({
    where: { id: row.id, profileTokenHash: row.profileTokenHash },
    data: { profileEnc: null, profileTokenHash: null, profileExpiresAt: null },
  });
  if (taken.count !== 1) return null;
  return { address: row.address, xml: decrypt(row.profileEnc) };
}

/** For the platform page: usage at Infomaniak (null when unreachable) and every mailbox the app knows */
export async function mailboxOverview() {
  let used: number | null = null;
  try {
    used = mailboxesEnabled() ? (await mailService().list()).length : null;
  } catch {
    used = null;
  }
  const rows = await authDb.mailboxProvisioning.findMany({
    where: { status: { not: 'DELETED' } },
    orderBy: [{ access: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      address: true,
      mode: true,
      status: true,
      access: true,
      lastError: true,
      requestedAt: true,
      handoverExpiresAt: true,
      practice: { select: { id: true, name: true } },
      user: {
        select: {
          name: true,
          activatedAt: true,
          memberships: { select: { active: true, practiceId: true } },
        },
      },
      invitation: { select: { name: true, acceptedAt: true, revokedAt: true, expiresAt: true } },
    },
  });
  const now = Date.now();
  return {
    used,
    total: Number(process.env.MAILBOX_TOTAL ?? 10),
    enabled: mailboxesEnabled(),
    rows: rows.map((r) => {
      const member = r.user?.memberships.find((m) => m.practiceId === r.practice?.id);
      const invitationOpen =
        !!r.invitation && !r.invitation.acceptedAt && !r.invitation.revokedAt && r.invitation.expiresAt.getTime() > now;
      return {
        id: r.id,
        address: r.address,
        mode: r.mode,
        status: r.status,
        access: r.access,
        lastError: r.lastError,
        requestedAt: r.requestedAt,
        handoverExpiresAt: r.handoverExpiresAt,
        practice: r.practice,
        person: r.user?.name ?? r.invitation?.name ?? r.address,
        memberInactive: !!r.user && member?.active === false,
        invitationOpen,
        /** Something for the platform admin to do */
        task: r.status === 'CREATED' && (r.access === 'OPEN' || r.access === 'EXPIRED') && (!!r.user || invitationOpen),
      };
    }),
  };
}

/** Mailbox states for the team page, by sign-in address */
export async function mailboxStatesOf(practiceId: string) {
  const rows = await authDb.mailboxProvisioning.findMany({
    where: { practiceId, status: { not: 'DELETED' } },
    select: { id: true, address: true, status: true, access: true },
  });
  return new Map(rows.map((r) => [r.address, r]));
}
