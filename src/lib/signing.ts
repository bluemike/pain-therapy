import type { Language } from '@prisma/client';
import { db } from './db';
import { audit, SYSTEM_ACTOR } from './audit';
import { config } from './config';
import { currentText } from './consent-texts';
import { formatDateTime } from './format';
import { translator } from './i18n-server';
import { getMailer } from './mail';
import { renderSignedFormPdf } from './pdf';
import { signatureSvg } from './signature';
import { documentStore, sha256 } from './storage';
import type { SigningInput } from './schemas';
import type { Actor } from './session';

export class SigningError extends Error {
  constructor(public code: 'notFound' | 'inactive' | 'noText' | 'notOpen') {
    super(code);
  }
}

/** consent-signing: Unterschriftsablauf starten */
export async function startSigning(actor: Actor, patientId: string) {
  const patient = await db.patient.findUnique({ where: { id: patientId } });
  if (!patient) throw new SigningError('notFound');
  if (patient.status !== 'ACTIVE') throw new SigningError('inactive');
  const text = await currentText(patient.preferredLanguage);
  if (!text) throw new SigningError('noText');
  return db.$transaction(async (tx) => {
    // An earlier session left open (e.g. the device was taken away) counts as aborted
    const open = await tx.signatureSession.findMany({ where: { patientId, status: 'OPEN' } });
    for (const o of open) {
      await tx.signatureSession.update({ where: { id: o.id }, data: { status: 'ABORTED', abortedAt: new Date() } });
      await audit(actor, 'signing.aborted', { patientId, details: { sessionId: o.id } }, tx);
    }
    const session = await tx.signatureSession.create({
      data: { patientId, textVersionId: text.id, language: patient.preferredLanguage, startedBy: actor.name },
    });
    await audit(actor, 'signing.started', { patientId, details: { sessionId: session.id, version: text.version } }, tx);
    return session;
  });
}

export async function getSession(sid: string) {
  return db.signatureSession.findUnique({
    where: { id: sid },
    include: {
      patient: true,
      textVersion: true,
      consents: true,
      document: { include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 1 } } },
    },
  });
}

/** Ends an unfinished session after the therapist signed back in (consent-signing: Abbruch). */
export async function abortIfOpen(actor: Actor, sid: string) {
  const s = await db.signatureSession.findUnique({ where: { id: sid } });
  if (!s || s.status !== 'OPEN') return s;
  return db.$transaction(async (tx) => {
    const updated = await tx.signatureSession.update({
      where: { id: sid },
      data: { status: 'ABORTED', abortedAt: new Date() },
    });
    await audit(actor, 'signing.aborted', { patientId: s.patientId, details: { sessionId: sid } }, tx);
    return updated;
  });
}

async function nextDocumentNumber(): Promise<string> {
  const year = new Date().getUTCFullYear();
  const row = await db.documentCounter.upsert({
    where: { year },
    create: { year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return `PT-${year}-${String(row.last).padStart(5, '0')}`;
}

/** consent-signing: Abschluss der Unterschrift, then consent-documents: PDF, Archiv, E-Mail */
export async function completeSigning(actor: Actor, sid: string, input: SigningInput) {
  const session = await getSession(sid);
  if (!session) throw new SigningError('notFound');
  if (session.status !== 'OPEN') throw new SigningError('notOpen');
  const { patient, textVersion } = session;
  const signedAt = new Date();
  const signedAtText = formatDateTime(signedAt);
  const { svg, paths } = signatureSvg(input.strokes, input.width, input.height);
  const documentNumber = await nextDocumentNumber();

  const pdf = await renderSignedFormPdf({
    language: session.language,
    documentNumber,
    textVersion: textVersion.version,
    title: textVersion.title,
    body: textVersion.body,
    patient,
    consents: { liability: true, dataProcessing: true, unencryptedEmail: input.unencryptedEmail },
    note: input.note,
    place: input.place,
    signedAtText,
    signature: { paths, width: input.width, height: input.height },
  });
  const hash = sha256(pdf);
  const blobPath = `${patient.id}/${documentNumber}.pdf`;
  await documentStore().put(blobPath, pdf, 'application/pdf');

  const emailStatus = !input.unencryptedEmail
    ? 'SKIPPED_NO_CONSENT'
    : !patient.email
      ? 'SKIPPED_NO_ADDRESS'
      : 'PENDING';
  const patientActor = {
    id: actor.id,
    name: `${patient.firstName} ${patient.lastName} (${actor.name}, Patientenmodus)`,
  };

  const result = await db.$transaction(async (tx) => {
    const updated = await tx.signatureSession.updateMany({
      where: { id: sid, status: 'OPEN' },
      data: {
        status: 'SIGNED',
        completedAt: signedAt,
        patientNote: input.note,
        place: input.place,
        signaturePoints: input.strokes,
        signatureSvg: svg,
      },
    });
    if (updated.count !== 1) throw new SigningError('notOpen');
    await tx.consent.createMany({
      data: [
        { sessionId: sid, kind: 'LIABILITY_WAIVER', granted: true },
        { sessionId: sid, kind: 'DATA_PROCESSING', granted: true },
        { sessionId: sid, kind: 'UNENCRYPTED_EMAIL', granted: input.unencryptedEmail },
      ],
    });
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
    const delivery = await tx.emailDelivery.create({
      data: {
        documentId: document.id,
        recipient: emailStatus === 'PENDING' ? patient.email : null,
        status: emailStatus,
        requestedBy: actor.name,
      },
    });
    await audit(
      patientActor,
      'signing.completed',
      {
        patientId: patient.id,
        after: documentNumber,
        details: {
          sessionId: sid,
          version: textVersion.version,
          unencryptedEmail: input.unencryptedEmail,
          sha256: hash,
        },
      },
      tx,
    );
    return { document, delivery };
  });
  return result;
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
  const delay = opts.retryDelayMs ?? config.mail.retryDelayMs;
  let lastError = '';
  for (let attempt = 1; attempt <= config.mail.maxAttempts; attempt++) {
    try {
      await getMailer().send(mail);
      await db.emailDelivery.update({
        where: { id: deliveryId },
        data: { status: 'SENT', attempts: attempt, sentAt: new Date(), lastError: null },
      });
      await audit(SYSTEM_ACTOR, 'email.sent', {
        patientId: document.patientId,
        after: delivery.recipient,
        details: { document: document.documentNumber },
      });
      return db.emailDelivery.findUnique({ where: { id: deliveryId } });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      await db.emailDelivery.update({ where: { id: deliveryId }, data: { attempts: attempt, lastError } });
      if (attempt < config.mail.maxAttempts) await new Promise((r) => setTimeout(r, delay * 2 ** (attempt - 1)));
    }
  }
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
