import type {
  AccessLinkChannel,
  AccessLinkDelivery,
  AccessLinkPurpose,
  PatientAccessLink,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { linkExpiry, linkState, type LinkState } from '@pain-therapy/shared/access';
import { linkPurposeOf } from '@pain-therapy/shared/record';
import { signatureStateOf } from '@pain-therapy/shared/signing';
import { hashToken, linkUrl, newToken } from '@pain-therapy/shared/tokens';
import { db } from './db';
import { audit, SYSTEM_ACTOR } from './audit';
import { config } from './config';
import { emailConsentOf } from './email-consent';
import { formatDateZurich } from './format';
import { translator } from './i18n-server';
import { sendWithRetry } from './mail';
import { qrSvg, renderAccessSheetPdf } from './access-sheet-pdf';
import type { Actor } from './session';

/**
 * patient-access: Zugangslink ausstellen, senden, anzeigen, sperren (iteration 4, design D3, D4). The token leaves
 * this module only as the address of the link, for the email text, the QR code and the access sheet; it is never
 * stored or logged, the database keeps its SHA-256.
 */

export class AccessLinkError extends Error {
  constructor(public code: 'notFound' | 'inactive' | 'noProgram' | 'disabled' | 'notPending' | 'noEmail') {
    super(code);
  }
}

type Tx = Prisma.TransactionClient | PrismaClient;

/** The patient zone is offered only once PATIENT_ZONE_URL is set (its host name is bound, design D13) */
export const zoneEnabled = () => !!config.patientZone.url;

/**
 * Issues a new link and replaces the valid one of the patient (Neuer Link ersetzt den alten). Only for an active
 * patient with an active home program (iteration 4, design D2), a pending signature (iteration 5, design D3, D4) or a
 * treatment or document to look at in the zone (iteration 6, design D3).
 */
export async function issueAccessLink(
  actor: Pick<Actor, 'id' | 'name'>,
  patientId: string,
  tx: Tx = db,
  now = new Date(),
) {
  if (!zoneEnabled()) throw new AccessLinkError('disabled');
  const patient = await tx.patient.findUnique({ where: { id: patientId }, select: { status: true } });
  if (!patient) throw new AccessLinkError('notFound');
  if (patient.status !== 'ACTIVE') throw new AccessLinkError('inactive');
  if (!(await linkPurposeOf(tx, patientId, now)).purposeActive) throw new AccessLinkError('noProgram');
  const previous = await tx.patientAccessLink.findMany({
    where: { patientId, replacedAt: null, revokedAt: null },
    select: { id: true },
  });
  if (previous.length) {
    await tx.patientAccessLink.updateMany({
      where: { id: { in: previous.map((l) => l.id) } },
      data: { replacedAt: now },
    });
    for (const l of previous) await audit(actor, 'accessLink.replaced', { patientId, details: { linkId: l.id } }, tx);
  }
  const token = newToken();
  const link = await tx.patientAccessLink.create({
    data: { patientId, tokenHash: hashToken(token), createdBy: actor.name, createdAt: now, expiresAt: linkExpiry(now) },
  });
  await audit(
    actor,
    'accessLink.issued',
    { patientId, after: formatDateZurich(link.expiresAt), details: { linkId: link.id } },
    tx,
  );
  return { link, url: linkUrl(config.patientZone.url, token) };
}

/** Email, QR code and access sheet all need the patient's name, language and address */
async function patientOf(patientId: string) {
  const p = await db.patient.findUnique({
    where: { id: patientId },
    select: { id: true, firstName: true, lastName: true, email: true, preferredLanguage: true },
  });
  if (!p) throw new AccessLinkError('notFound');
  return p;
}

/**
 * "Link senden" in the record (Link senden aus der Akte): with consent to unencrypted email and an address the link
 * goes by email (sent afterwards by deliverAccessLink); otherwise the practice shows the QR code and can print the
 * access sheet.
 */
export async function sendAccessLink(actor: Actor, patientId: string) {
  const p = await patientOf(patientId);
  const consent = await emailConsentOf(patientId);
  const email = consent.granted && !!p.email;
  const { link, url, delivery } = await db.$transaction(async (tx) => {
    const issued = await issueAccessLink(actor, patientId, tx);
    const delivery = await tx.accessLinkDelivery.create({
      data: {
        linkId: issued.link.id,
        channel: email ? 'EMAIL' : 'SCREEN',
        recipient: email ? p.email : null,
        status: email ? 'PENDING' : null,
        requestedBy: actor.name,
      },
    });
    await audit(
      actor,
      email ? 'accessLink.sent' : 'accessLink.shown',
      { patientId, after: email ? p.email : null, details: { linkId: issued.link.id } },
      tx,
    );
    return { ...issued, delivery };
  });
  if (email) return { channel: 'EMAIL' as const, deliveryId: delivery.id, url, to: p.email! };
  const pdf = await renderAccessSheetPdf({ language: p.preferredLanguage, patient: p, url, expiresAt: link.expiresAt });
  return { channel: 'SCREEN' as const, linkId: link.id, qr: await qrSvg(url), accessSheet: pdf };
}

/**
 * zone-consent-invitation: Zur Unterschrift einladen (iteration 5, design D3). Only while a signature is pending.
 * Issues a new link (replacing the previous one) and sends it by email or shows it as QR code. The invitation email
 * goes to the stored address even without consent to unencrypted email: it holds only the practice name and the
 * link, and the consent is given with exactly this form (Einladung ohne E-Mail-Einwilligung).
 */
export async function inviteToSign(actor: Actor, patientId: string, channel: 'EMAIL' | 'SCREEN') {
  const p = await patientOf(patientId);
  if (!(await signatureStateOf(db, patientId)).pending) throw new AccessLinkError('notPending');
  if (channel === 'EMAIL' && !p.email) throw new AccessLinkError('noEmail');
  const { link, url, delivery } = await db.$transaction(async (tx) => {
    const issued = await issueAccessLink(actor, patientId, tx);
    const delivery = await tx.accessLinkDelivery.create({
      data: {
        linkId: issued.link.id,
        channel,
        purpose: 'SIGNATURE',
        recipient: channel === 'EMAIL' ? p.email : null,
        status: channel === 'EMAIL' ? 'PENDING' : null,
        requestedBy: actor.name,
      },
    });
    await audit(
      actor,
      'accessLink.invited',
      { patientId, after: channel === 'EMAIL' ? p.email : null, details: { linkId: issued.link.id, channel } },
      tx,
    );
    return { ...issued, delivery };
  });
  if (channel === 'EMAIL') return { channel: 'EMAIL' as const, deliveryId: delivery.id, url, to: p.email! };
  const pdf = await renderAccessSheetPdf({
    language: p.preferredLanguage,
    patient: p,
    url,
    expiresAt: link.expiresAt,
    purpose: 'SIGNATURE',
  });
  return { channel: 'SCREEN' as const, linkId: link.id, qr: await qrSvg(url), accessSheet: pdf };
}

/** Invitation to sign, in the patient's language: practice, request, link, date of birth; no health data */
export function signatureInviteEmail(language: 'de' | 'en', name: string, url: string) {
  const t = translator(language, 'signatureInviteEmail');
  return { subject: t('subject'), text: t('body', { name, url }) };
}

/** Text of the email with the link, in the patient's language (Text von der Praxis zu bestätigen, task 10.3) */
export function accessLinkEmail(language: 'de' | 'en', name: string, url: string, expiresAt: Date) {
  const t = translator(language, 'accessLinkEmail');
  return { subject: t('subject'), text: t('body', { name, url, date: formatDateZurich(expiresAt) }) };
}

/** Sends the link by email (no attachment) with the retries of the exercise sheet; status on the delivery row. */
export async function deliverAccessLink(deliveryId: string, url: string, opts: { retryDelayMs?: number } = {}) {
  const delivery = await db.accessLinkDelivery.findUnique({ where: { id: deliveryId }, include: { link: true } });
  if (!delivery || delivery.channel !== 'EMAIL' || delivery.status !== 'PENDING' || !delivery.recipient)
    return delivery;
  const p = await patientOf(delivery.link.patientId);
  const name = `${p.firstName} ${p.lastName}`;
  const mail =
    delivery.purpose === 'SIGNATURE'
      ? signatureInviteEmail(p.preferredLanguage, name, url)
      : accessLinkEmail(p.preferredLanguage, name, url, delivery.link.expiresAt);
  const result = await sendWithRetry(
    { to: delivery.recipient, ...mail },
    {
      retryDelayMs: opts.retryDelayMs,
      onFailedAttempt: async (attempt, lastError) => {
        await db.accessLinkDelivery.update({ where: { id: deliveryId }, data: { attempts: attempt, lastError } });
      },
    },
  );
  const details = {
    kind: delivery.purpose === 'SIGNATURE' ? 'signatureInvite' : 'accessLink',
    linkId: delivery.linkId,
  };
  if (result.ok) {
    await db.accessLinkDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SENT', attempts: result.attempts, sentAt: new Date(), lastError: null },
    });
    await audit(SYSTEM_ACTOR, 'email.sent', { patientId: p.id, after: delivery.recipient, details });
  } else {
    await db.accessLinkDelivery.update({ where: { id: deliveryId }, data: { status: 'FAILED' } });
    await audit(SYSTEM_ACTOR, 'email.failed', { patientId: p.id, after: result.lastError.slice(0, 300), details });
  }
  return db.accessLinkDelivery.findUnique({ where: { id: deliveryId } });
}

/** "Zugangsblatt drucken": the access sheet was opened for printing */
export async function accessSheetPrinted(
  actor: Actor,
  patientId: string,
  linkId: string,
  handoutId?: string,
  purpose: AccessLinkPurpose = 'EXERCISES',
) {
  const link = await db.patientAccessLink.findFirst({ where: { id: linkId, patientId } });
  if (!link) throw new AccessLinkError('notFound');
  await db.$transaction(async (tx) => {
    await tx.accessLinkDelivery.create({
      data: { linkId, channel: 'PRINT', purpose, handoutId: handoutId ?? null, requestedBy: actor.name },
    });
    await audit(
      actor,
      'accessLink.printed',
      { patientId, details: { linkId, handoutId: handoutId ?? null, purpose } },
      tx,
    );
  });
}

/**
 * "Link sperren" (Link sperren): the current link becomes invalid at once and every device session of the patient
 * ends, also those opened with an older, replaced link.
 */
export async function revokeAccessLink(actor: Actor, patientId: string, now = new Date()) {
  const link = await db.patientAccessLink.findFirst({
    where: { patientId, revokedAt: null, replacedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!link) return null;
  return db.$transaction(async (tx) => {
    const revoked = await tx.patientAccessLink.update({
      where: { id: link.id },
      data: { revokedAt: now, revokedBy: actor.name },
    });
    const ended = await tx.patientZoneSession.updateMany({
      where: { patientId, endedAt: null },
      data: { endedAt: now },
    });
    await audit(actor, 'accessLink.revoked', { patientId, details: { linkId: link.id, sessions: ended.count } }, tx);
    return revoked;
  });
}

/**
 * Status of the link for the record and the dashboard: sent (by email, shown as QR code or printed, not yet used),
 * active, locked, blocked, revoked, expired; `none` before the first link.
 */
export type LinkStatus = 'none' | 'sent' | 'shown' | 'printed' | 'active' | Exclude<LinkState, 'valid'>;

export function linkStatusOf(
  link: (PatientAccessLink & { deliveries: AccessLinkDelivery[] }) | null,
  ctx: { patientActive: boolean; purposeActive: boolean },
  now = new Date(),
): LinkStatus {
  if (!link) return 'none';
  const state = linkState(link, ctx, now);
  if (state !== 'valid') return state;
  if (link.lastUsedAt) return 'active';
  // Deliveries are newest first: the latest way the link went to the patient
  const latest = link.deliveries[0];
  return latest?.channel === 'PRINT' ? 'printed' : latest?.channel === 'SCREEN' ? 'shown' : 'sent';
}

/** Newest link of a patient with its deliveries, newest first */
export async function latestLinkOf(patientId: string) {
  return db.patientAccessLink.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    include: { deliveries: { orderBy: { createdAt: 'desc' } } },
  });
}

/**
 * zone-consent-invitation: Stand der Einladung (design D9) for the record and the dashboard. While a signature is
 * pending: not invited, invitation sent (channel and time), delivery failed, or link opened. Otherwise `signedOnline`
 * when the latest signature was made in the patient zone, else null. Only invitations after the latest signature
 * count, so an old invitation does not show for a new text version.
 */
export type InviteStatus =
  | { kind: 'notInvited' }
  | { kind: 'sent'; channel: AccessLinkChannel; at: Date }
  | { kind: 'failed'; at: Date }
  | { kind: 'opened'; at: Date }
  | { kind: 'signedOnline'; at: Date; version: number };

export async function inviteStatusOf(patientId: string, pending: boolean): Promise<InviteStatus | null> {
  const signed = await db.signatureSession.findFirst({
    where: { patientId, status: 'SIGNED' },
    orderBy: { completedAt: 'desc' },
    select: { channel: true, completedAt: true, textVersion: { select: { version: true } } },
  });
  if (!pending)
    return signed?.channel === 'PATIENT_ZONE' && signed.completedAt
      ? { kind: 'signedOnline', at: signed.completedAt, version: signed.textVersion.version }
      : null;
  const invite = await db.accessLinkDelivery.findFirst({
    where: {
      purpose: 'SIGNATURE',
      link: { patientId },
      ...(signed?.completedAt ? { createdAt: { gt: signed.completedAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { link: { select: { lastUsedAt: true, revokedAt: true, replacedAt: true } } },
  });
  if (!invite) return { kind: 'notInvited' };
  const { link } = invite;
  if (link.lastUsedAt && link.lastUsedAt > invite.createdAt) return { kind: 'opened', at: link.lastUsedAt };
  if (invite.status === 'FAILED') return { kind: 'failed', at: invite.updatedAt };
  return { kind: 'sent', channel: invite.channel, at: invite.sentAt ?? invite.createdAt };
}
