import type { AccessLinkDelivery, PatientAccessLink, Prisma, PrismaClient } from '@prisma/client';
import { linkExpiry, linkState, type LinkState } from '@pain-therapy/shared/access';
import { currentProgram } from '@pain-therapy/shared/program';
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
  constructor(public code: 'notFound' | 'inactive' | 'noProgram' | 'disabled') {
    super(code);
  }
}

type Tx = Prisma.TransactionClient | PrismaClient;

/** The patient zone is offered only once PATIENT_ZONE_URL is set (its host name is bound, design D13) */
export const zoneEnabled = () => !!config.patientZone.url;

/**
 * Issues a new link and replaces the valid one of the patient (Neuer Link ersetzt den alten). Only for an active
 * patient with an active home program (design D2).
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
  const program = await currentProgram(tx, patientId, now);
  if (!program?.active) throw new AccessLinkError('noProgram');
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
  const mail = accessLinkEmail(p.preferredLanguage, `${p.firstName} ${p.lastName}`, url, delivery.link.expiresAt);
  const result = await sendWithRetry(
    { to: delivery.recipient, ...mail },
    {
      retryDelayMs: opts.retryDelayMs,
      onFailedAttempt: async (attempt, lastError) => {
        await db.accessLinkDelivery.update({ where: { id: deliveryId }, data: { attempts: attempt, lastError } });
      },
    },
  );
  const details = { kind: 'accessLink', linkId: delivery.linkId };
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
export async function accessSheetPrinted(actor: Actor, patientId: string, linkId: string, handoutId?: string) {
  const link = await db.patientAccessLink.findFirst({ where: { id: linkId, patientId } });
  if (!link) throw new AccessLinkError('notFound');
  await db.$transaction(async (tx) => {
    await tx.accessLinkDelivery.create({
      data: { linkId, channel: 'PRINT', handoutId: handoutId ?? null, requestedBy: actor.name },
    });
    await audit(actor, 'accessLink.printed', { patientId, details: { linkId, handoutId: handoutId ?? null } }, tx);
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
  ctx: { patientActive: boolean; programActive: boolean },
  now = new Date(),
): LinkStatus {
  if (!link) return 'none';
  const state = linkState(link, ctx, now);
  if (state !== 'valid') return state;
  if (link.lastUsedAt) return 'active';
  const first = link.deliveries.at(-1);
  return first?.channel === 'EMAIL' ? 'sent' : first?.channel === 'PRINT' ? 'printed' : first ? 'shown' : 'sent';
}

/** Newest link of a patient with its deliveries, newest first */
export async function latestLinkOf(patientId: string) {
  return db.patientAccessLink.findFirst({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    include: { deliveries: { orderBy: { createdAt: 'desc' } } },
  });
}
