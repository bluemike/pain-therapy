import type { ConsentKind, Language } from '@prisma/client';
import { signatureSize, zonePlace } from '@pain-therapy/shared/signing';
import { fieldValuesOf, fillFields } from '@pain-therapy/shared/consent-fields';
import { notifyLimitReached } from './plans';
import { runInPractice } from '@pain-therapy/shared/practice-context';
import { db, rawDb } from './db';
import { audit, SYSTEM_ACTOR } from './audit';
import { blobFolder, requirePractice } from './practice';
import { formatDateTime } from './format';
import { sendWithRetry } from './mail';
import { practiceSender, replyToOf } from './practice-mail';
import { documentEmail, issueMailLink } from './patient-access';
import type { MailAccess } from './handouts';
import { renderSignedFormPdf } from './pdf';
import { signatureSvg, type Stroke } from './signature';
import { documentStore, sha256 } from './storage';
import type { Actor } from './session';

/**
 * Next human-readable document number <Kürzel>-YYYY-NNNNN of the current practice, shared by signed forms and
 * exercise sheets (iteration 12, design D5: counter and prefix per practice)
 */
export async function nextDocumentNumber(): Promise<string> {
  const practice = await requirePractice();
  const year = new Date().getUTCFullYear();
  const row = await db.documentCounter.upsert({
    where: { practiceId_year: { practiceId: practice.id, year } },
    create: { year, last: 1 },
    update: { last: { increment: 1 } },
  });
  return `${practice.documentPrefix}-${year}-${String(row.last).padStart(5, '0')}`;
}

/**
 * zone-consent-signing: PDF, Archiv und Zustellung, step 2 of 2 (design D7). Renders the PDF of a SIGNED session,
 * archives it immutably, creates SignedDocument and EmailDelivery. Idempotent: a session that already has a
 * document is left alone, and an advisory lock per session serialises concurrent calls (the zone and the job). Returns null when there is nothing to do. The caller starts the email with deliverEmail().
 */
export async function finalizeSignature(sid: string) {
  const result = await finalizeInTransaction(sid);
  // practice-plans (iteration 17, design D8): a new signed patient may reach the plan's limit; never blocks
  if (result) void notifyLimitReached((await requirePractice()).id);
  return result;
}

async function finalizeInTransaction(sid: string) {
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
      // consent-template (iteration 17, design D1): the practice details as they are now, kept with the session
      const practice = await requirePractice();
      const fieldValues = fieldValuesOf(practice);
      await tx.signatureSession.update({ where: { id: sid }, data: { fieldValues } });
      const pdf = await renderSignedFormPdf({
        language: session.language,
        documentNumber,
        textVersion: textVersion.version,
        title: fillFields(textVersion.title, fieldValues),
        body: fillFields(textVersion.body, fieldValues),
        patient,
        consents,
        note: session.patientNote,
        place: session.place ?? (zone ? zonePlace(session.language) : practice.defaultPlace),
        signedAtText: formatDateTime(session.completedAt ?? new Date()),
        signature: { paths, width: size.width, height: size.height },
        online:
          zone && session.zoneSession ? { confirmedAtText: formatDateTime(session.zoneSession.createdAt) } : undefined,
      });
      const hash = sha256(pdf);
      const blobPath = `${await blobFolder(patient.id)}/${documentNumber}.pdf`;
      await documentStore().put(blobPath, pdf, 'application/pdf');

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
      // zone-documents (iteration 9, design D4; iteration 12, design D7): the document is only in the zone, the
      // patient signed there and sees it at once, so no email goes out
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
      return { document };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}

/**
 * Rückfall (design D7): SIGNED sessions without a document that are older than a minute, e.g. because the practice
 * app restarted while the patient signed in the zone. Called by the job caj-pain-therapy-finalize every 5 minutes.
 */
export async function finalizePending(now = new Date()) {
  // Over all practices (owner connection), then each session in its own practice (iteration 12, design D1)
  const open = await rawDb.signatureSession.findMany({
    where: { status: 'SIGNED', document: null, completedAt: { lt: new Date(now.getTime() - 60_000) } },
    select: { id: true, practiceId: true },
    orderBy: { completedAt: 'asc' },
    take: 50,
  });
  let done = 0;
  for (const { id, practiceId } of open) {
    try {
      const result = await runInPractice(practiceId, () => finalizeSignature(id));
      if (result) done++;
    } catch (e) {
      console.error(`finalizeSignature ${id} failed`, e);
    }
  }
  return { found: open.length, done };
}

/**
 * Sends the link to a signed form, retrying up to 3 times (consent-documents: Zustellung, Fehlgeschlagener Versand).
 * Iteration 12, design D7: only the practice name and the link to «Dokumente», never the PDF; without a link nothing
 * is sent and the delivery fails.
 */
export async function deliverEmail(deliveryId: string, opts: { retryDelayMs?: number; access?: MailAccess } = {}) {
  const delivery = await db.emailDelivery.findUnique({
    where: { id: deliveryId },
    include: { document: { include: { patient: true } } },
  });
  if (!delivery || delivery.status !== 'PENDING' || !delivery.recipient) return delivery;
  const { document } = delivery;
  const sender = await practiceSender(delivery.replyTo);
  const result = opts.access
    ? await sendWithRetry(
        {
          to: delivery.recipient,
          ...sender,
          ...documentEmail(
            document.language as Language,
            `${document.patient.firstName} ${document.patient.lastName}`,
            opts.access.url,
            opts.access.expiresAt,
            sender.fromName,
          ),
        },
        {
          retryDelayMs: opts.retryDelayMs,
          onFailedAttempt: async (attempt, lastError) => {
            await db.emailDelivery.update({ where: { id: deliveryId }, data: { attempts: attempt, lastError } });
          },
        },
      )
    : ({ ok: false, attempts: 0, lastError: 'No link to the patient zone' } as const);
  const linkDelivery = { channel: 'EMAIL' as const, status: 'PENDING' as const, recipient: delivery.recipient };
  if (result.ok) {
    await db.emailDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SENT', attempts: result.attempts, sentAt: new Date(), lastError: null },
    });
    await db.accessLinkDelivery.updateMany({
      where: { ...linkDelivery, link: { patientId: document.patientId }, handoutId: null },
      data: { status: 'SENT', attempts: result.attempts, sentAt: new Date() },
    });
    await audit(SYSTEM_ACTOR, 'email.sent', {
      patientId: document.patientId,
      after: delivery.recipient,
      details: { document: document.documentNumber },
    });
    return db.emailDelivery.findUnique({ where: { id: deliveryId } });
  }
  const lastError = result.lastError.slice(0, 300);
  await db.emailDelivery.update({
    where: { id: deliveryId },
    data: { status: 'FAILED', attempts: result.attempts, lastError },
  });
  await db.accessLinkDelivery.updateMany({
    where: { ...linkDelivery, link: { patientId: document.patientId }, handoutId: null },
    data: { status: 'FAILED', attempts: result.attempts, lastError },
  });
  await audit(SYSTEM_ACTOR, 'email.failed', {
    patientId: document.patientId,
    after: lastError,
    details: { document: document.documentNumber },
  });
  return db.emailDelivery.findUnique({ where: { id: deliveryId } });
}

/**
 * "Erneut senden": a new email with a new zone link to the same archived form, to the current address, if consent was
 * given. Returns the link for deliverEmail (iteration 12, design D7).
 */
export async function requestResend(actor: Actor, documentId: string) {
  const doc = await db.signedDocument.findUniqueOrThrow({
    where: { id: documentId },
    include: { patient: true, session: { include: { consents: true } } },
  });
  const consent = doc.session.consents.find((c) => c.kind === 'UNENCRYPTED_EMAIL')?.granted ?? false;
  const status = !consent ? 'SKIPPED_NO_CONSENT' : !doc.patient.email ? 'SKIPPED_NO_ADDRESS' : 'PENDING';
  return db.$transaction(async (tx) => {
    const delivery = await tx.emailDelivery.create({
      data: {
        documentId,
        recipient: status === 'PENDING' ? doc.patient.email : null,
        status,
        requestedBy: actor.name,
        replyTo: replyToOf(actor),
      },
    });
    await audit(
      actor,
      'email.resend',
      { patientId: doc.patientId, after: doc.patient.email, details: { document: doc.documentNumber } },
      tx,
    );
    const access = status === 'PENDING' ? await issueMailLink(actor, doc.patientId, doc.patient.email!, tx) : null;
    return { delivery, access };
  });
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
