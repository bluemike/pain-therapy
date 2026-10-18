import type { ConsentKind, Language } from '@prisma/client';
import { ZONE_ACTOR } from '@pain-therapy/shared/access';
import { signatureSize, zonePlace } from '@pain-therapy/shared/signing';
import { config } from './config';
import { db } from './db';
import { audit, SYSTEM_ACTOR } from './audit';
import { formatDateTime } from './format';
import { translator } from './i18n-server';
import { sendWithRetry } from './mail';
import { renderSignedFormPdf } from './pdf';
import { signatureSvg, type Stroke } from './signature';
import { documentStore, sha256 } from './storage';
import type { Actor } from './session';

/** Next human-readable document number PT-YYYY-NNNNN, shared by signed forms and exercise sheets */
export async function nextDocumentNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const row = await db.documentCounter.upsert({
    where: { year },
    create: { year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return `PT-${year}-${String(row.last).padStart(5, '0')}`;
}

/**
 * zone-consent-signing: PDF, Archiv und Zustellung, step 2 of 2 (design D7). Renders the PDF of a SIGNED session,
 * archives it immutably, creates SignedDocument and EmailDelivery. Idempotent: a session that already has a
 * document is left alone, and an advisory lock per session serialises concurrent calls (the zone and the job). Returns null when there is nothing to do. The caller starts the email with deliverEmail().
 */
export async function finalizeSignature(sid: string) {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`finalize:${sid}`}))::text`;
      const session = await tx.signatureSession.findUnique({
        where: { id: sid },
        include: { patient: true, textVersion: true, consents: true, document: true, zoneSession: true },
      });
      if (!session || session.status !== 'SIGNED' || session.document) return null;
      const { patient, textVersion } = session;
      const consent = (kind: ConsentKind) => session.consents.find((c) => c.kind === kind)?.granted ?? false;
      const consents = {
        liability: consent('LIABILITY_WAIVER'),
        dataProcessing: consent('DATA_PROCESSING'),
        unencryptedEmail: consent('UNENCRYPTED_EMAIL'),
      };
      const zone = session.channel === 'PATIENT_ZONE';
      const strokes = (session.signaturePoints ?? []) as Stroke[];
      const size = signatureSize(session.signatureSvg);
      const { paths } = signatureSvg(strokes, size.width, size.height);
      // Taken outside the transaction: a failed run leaves a gap in the numbers, never a number used twice
      const documentNumber = await nextDocumentNumber();
      const pdf = await renderSignedFormPdf({
        language: session.language,
        documentNumber,
        textVersion: textVersion.version,
        title: textVersion.title,
        body: textVersion.body,
        patient,
        consents,
        note: session.patientNote,
        place: session.place ?? (zone ? zonePlace(session.language) : ''),
        signedAtText: formatDateTime(session.completedAt ?? new Date()),
        signature: { paths, width: size.width, height: size.height },
        online:
          zone && session.zoneSession ? { confirmedAtText: formatDateTime(session.zoneSession.createdAt) } : undefined,
      });
      const hash = sha256(pdf);
      const blobPath = `${patient.id}/${documentNumber}.pdf`;
      await documentStore().put(blobPath, pdf, 'application/pdf');

      const emailStatus = !consents.unencryptedEmail
        ? 'SKIPPED_NO_CONSENT'
        : !patient.email
          ? 'SKIPPED_NO_ADDRESS'
          : 'PENDING';
      const requestedBy = zone ? ZONE_ACTOR.name : session.startedBy;
      const document = await tx.signedDocument.create({
        data: {
          documentNumber,
          patientId: patient.id,
          sessionId: sid,
          textVersion: textVersion.version,
          language: session.language,
          blobPath,
          sha256: hash,
          sizeBytes: pdf.length,
        },
      });
      // zone-documents (iteration 9, design D4): with the patient zone the document is only there, no email with it
      const delivery = config.patientZone.url
        ? null
        : await tx.emailDelivery.create({
            data: {
              documentId: document.id,
              recipient: emailStatus === 'PENDING' ? patient.email : null,
              status: emailStatus,
              requestedBy,
            },
          });
      await audit(
        SYSTEM_ACTOR,
        'document.archived',
        {
          patientId: patient.id,
          after: documentNumber,
          details: { sessionId: sid, sha256: hash, channel: session.channel },
        },
        tx,
      );
      return { document, delivery };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

/**
 * Rückfall (design D7): SIGNED sessions without a document that are older than a minute, e.g. because the practice
 * app restarted while the patient signed in the zone. Called by the job caj-pain-therapy-finalize every 5 minutes.
 */
export async function finalizePending(now = new Date()) {
  const open = await db.signatureSession.findMany({
    where: { status: 'SIGNED', document: null, completedAt: { lt: new Date(now.getTime() - 60_000) } },
    select: { id: true },
    orderBy: { completedAt: 'asc' },
    take: 50,
  });
  let done = 0;
  for (const { id } of open) {
    try {
      const result = await finalizeSignature(id);
      if (result) {
        done++;
        if (result.delivery?.status === 'PENDING') await deliverEmail(result.delivery.id).catch(console.error);
      }
    } catch (e) {
      console.error(`finalizeSignature ${id} failed`, e);
    }
  }
  return { found: open.length, done };
}

/** Sends the signed PDF, retrying up to 3 times (consent-documents: Zustellung, Fehlgeschlagener Versand). */
export async function deliverEmail(deliveryId: string, opts: { retryDelayMs?: number } = {}) {
  const delivery = await db.emailDelivery.findUnique({
    where: { id: deliveryId },
    include: { document: { include: { patient: true, session: true } } },
  });
  if (!delivery || delivery.status !== 'PENDING' || !delivery.recipient) return delivery;
  const { document } = delivery;
  const lang = document.language as Language;
  const t = translator(lang, 'email');
  const data = await documentStore().get(document.blobPath);
  if (sha256(data) !== document.sha256) throw new Error(`Checksum mismatch for ${document.documentNumber}`);
  const mail = {
    to: delivery.recipient,
    subject: t('subject', { number: document.documentNumber }),
    text: t('body', {
      name: `${document.patient.firstName} ${document.patient.lastName}`,
      date: formatDateTime(document.session.completedAt ?? document.createdAt).slice(0, 10),
    }),
    attachment: { name: `${document.documentNumber}.pdf`, contentType: 'application/pdf', data },
  };
  const result = await sendWithRetry(mail, {
    retryDelayMs: opts.retryDelayMs,
    onFailedAttempt: async (attempt, lastError) => {
      await db.emailDelivery.update({ where: { id: deliveryId }, data: { attempts: attempt, lastError } });
    },
  });
  if (result.ok) {
    await db.emailDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SENT', attempts: result.attempts, sentAt: new Date(), lastError: null },
    });
    await audit(SYSTEM_ACTOR, 'email.sent', {
      patientId: document.patientId,
      after: delivery.recipient,
      details: { document: document.documentNumber },
    });
    return db.emailDelivery.findUnique({ where: { id: deliveryId } });
  }
  const { lastError } = result;
  await db.emailDelivery.update({ where: { id: deliveryId }, data: { status: 'FAILED' } });
  await audit(SYSTEM_ACTOR, 'email.failed', {
    patientId: document.patientId,
    after: lastError.slice(0, 300),
    details: { document: document.documentNumber },
  });
  return db.emailDelivery.findUnique({ where: { id: deliveryId } });
}

/** "Erneut senden": a new delivery for the same archived PDF, to the current address, if consent was given. */
export async function requestResend(actor: Actor, documentId: string) {
  const doc = await db.signedDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { patient: true, session: { include: { consents: true } } },
  });
  const consent = doc.session.consents.find((c) => c.kind === 'UNENCRYPTED_EMAIL')?.granted ?? false;
  const status = !consent ? 'SKIPPED_NO_CONSENT' : !doc.patient.email ? 'SKIPPED_NO_ADDRESS' : 'PENDING';
  const delivery = await db.emailDelivery.create({
    data: { documentId, recipient: status === 'PENDING' ? doc.patient.email : null, status, requestedBy: actor.name },
  });
  await audit(actor, 'email.resend', {
    patientId: doc.patientId,
    after: doc.patient.email,
    details: { document: doc.documentNumber },
  });
  return delivery;
}

/** zone-consent-invitation: Anmerkung zu den Personalien "Erledigt" (design D9) */
export async function resolvePatientNote(actor: Actor, patientId: string, sid: string) {
  await db.$transaction(async (tx) => {
    const done = await tx.signatureSession.updateMany({
      where: { id: sid, patientId, status: 'SIGNED', noteResolvedAt: null, patientNote: { not: null } },
      data: { noteResolvedAt: new Date(), noteResolvedBy: actor.name },
    });
    if (done.count) await audit(actor, 'signing.noteResolved', { patientId, details: { sessionId: sid } }, tx);
  });
}
