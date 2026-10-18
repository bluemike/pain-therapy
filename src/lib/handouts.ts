import type { Language, Prisma } from '@prisma/client';
import { db } from './db';
import { audit, SYSTEM_ACTOR } from './audit';
import { formatDateZurich } from './format';
import { localName } from './catalog';
import { mediaFileOf, timingOf, type SheetContent, type SheetSegments } from './exercise-sheets';
import { renderHandoutPdf, type HandoutItem, type HandoutPdfInput } from './handout-pdf';
import { executionTime, programTime, withVariant } from './home-program';
import { therapistLine } from './users';
import { translator } from './i18n-server';
import { sendWithRetry } from './mail';
import { nextDocumentNumber } from './signing';
import { documentStore, exerciseMediaStore, sha256 } from './storage';
import type { Actor } from './session';
import { emailConsentOf } from './email-consent';
import { AccessLinkError, issueAccessLink, zoneEnabled } from './patient-access';
import { qrPng, type AccessSheetInput } from './access-sheet-pdf';

/** exercise-handout: Übungsblatt erstellen, ablegen, senden oder drucken (design D5, D6). */

export class HandoutError extends Error {
  constructor(public code: 'notFound' | 'noPrescription' | 'noConsent' | 'noAddress') {
    super(code);
  }
}

export { emailConsentOf };

/** Everything the Abschluss page and the PDF need about one session */
export async function handoutContext(consultationId: string) {
  const c = await db.consultation.findUnique({
    where: { id: consultationId },
    include: {
      treatment: { include: { patient: true, region: true } },
      exercises: true,
      home: {
        include: { exercise: { include: { sheet: true, epdVariants: { where: { retiredAt: null } } } } },
      },
      handouts: {
        orderBy: { version: 'desc' },
        include: { deliveries: { orderBy: { createdAt: 'desc' }, take: 1 } },
      },
    },
  });
  if (!c) return null;
  const patient = c.treatment.patient;
  const consent = await emailConsentOf(patient.id);
  // In the order of the treatment form, like the block "Selbstausführung"
  const order = (code: string) => {
    const i = c.exercises.findIndex((x) => x.exerciseCode === code);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const prescriptions = [...c.home].sort((a, b) => order(a.exerciseCode) - order(b.exerciseCode));
  return {
    consultation: c,
    patient,
    prescriptions,
    consent,
    /** Sending is offered only with consent and an address (exercise-handout: Versand oder Ausdruck) */
    canEmail: consent.granted && !!patient.email,
  };
}
type Context = NonNullable<Awaited<ReturnType<typeof handoutContext>>>;

/** Total time of the prescriptions: FRM + chosen EPD × executions per week (home-schedule, iteration 8) */
export function programTotal(ctx: Pick<Context, 'prescriptions'>) {
  return programTime(
    ctx.prescriptions.map((p) => ({
      code: p.exerciseCode,
      schedule: { timesPerDay: p.timesPerDay, weekdays: p.weekdays },
      timing: withVariant(
        timingOf(p.exercise.sheet && !p.exercise.sheet.retiredAt ? p.exercise.sheet : null),
        p.exercise.epdVariants.find((v) => v.number === p.variant)?.seconds,
      ),
    })),
  );
}

/** Prescriptions with names in the patient's language, timing and media for the PDF */
async function handoutItems(ctx: Context, language: Language): Promise<HandoutItem[]> {
  const media = exerciseMediaStore();
  return Promise.all(
    ctx.prescriptions.map(async (p) => {
      const sheet = p.exercise.sheet && !p.exercise.sheet.retiredAt ? p.exercise.sheet : null;
      const variant = p.variant ? (p.exercise.epdVariants.find((v) => v.number === p.variant) ?? null) : null;
      const e = executionTime(withVariant(timingOf(sheet), variant?.seconds));
      const code = p.exerciseCode;
      // home-schedule (iteration 8, design D7): FRM band and the band of the chosen EPD; the main image for the
      // overview and the whole sheet while the bands are not uploaded
      const [mainImage, sheetImage, frmImage, epdImage] = sheet
        ? await Promise.all([
            media.get(sheet.mainImage),
            media.get(sheet.sheetImage),
            media.get(mediaFileOf(code, 'frm', sheet)),
            media.get(mediaFileOf(code, p.variant ? 'var' : 'std', sheet)),
          ])
        : [null, null, null, null];
      return {
        code,
        name: localName(p.exercise, language),
        variant: p.variant,
        timesPerDay: p.timesPerDay,
        weekdays: p.weekdays,
        note: p.note,
        seconds: e.seconds,
        stretchMissing: e.stretchMissing,
        timingMissing: !sheet,
        tools: sheet?.rollingTools ?? [],
        aids: variant ? variant.aids : (sheet?.standardAids ?? []),
        mainImage,
        sheetImage,
        frmImage,
        epdImage,
        segments: (sheet?.segments ?? null) as SheetSegments | null,
        content: (sheet?.content ?? null) as SheetContent | null,
      };
    }),
  );
}

/**
 * Renders the exercise sheet of a consultation; `documentNumber` and `version` are printed on every page. With
 * `accessSheet` the printed copy ends with the access sheet to the patient zone (never archived, design D4).
 */
export async function buildHandout(
  ctx: Context,
  documentNumber: string,
  version: number,
  accessSheet?: Omit<AccessSheetInput, 'language' | 'patient'>,
) {
  const language = ctx.patient.preferredLanguage;
  const items = await handoutItems(ctx, language);
  const total = programTotal(ctx);
  const input: HandoutPdfInput = {
    language,
    documentNumber,
    version,
    createdAt: new Date(),
    patient: ctx.patient,
    consultationAt: ctx.consultation.at,
    therapist: await therapistLine(ctx.consultation.createdBy, language),
    items,
    total,
    accessSheet: accessSheet
      ? { ...accessSheet, language, patient: ctx.patient, qr: await qrPng(accessSheet.url) }
      : undefined,
  };
  const pdf = await renderHandoutPdf(input);
  const snapshot = items.map(({ code, name, variant, timesPerDay, weekdays, note, seconds, stretchMissing }) => ({
    code,
    name,
    variant,
    timesPerDay,
    weekdays,
    note,
    seconds,
    stretchMissing,
  }));
  return { pdf, language, snapshot: { items: snapshot, total } };
}

/**
 * exercise-handout: Übungsblatt auf Knopfdruck. Renders, archives with a document number as the next version of this
 * consultation, and records the email (PENDING, sent by deliverHandout) or the printout.
 *
 * patient-access: Link mit dem Übungsblatt (iteration 4, design D4). With `withLink` a new link to the patient zone is
 * issued: by email it goes into the text of the email (`access.url` for deliverHandout), for a printout the result
 * has `printPdf`, a copy of the sheet with the access sheet as last page. The archived PDF never contains the link.
 * Without an active home program or with the patient zone not yet set up, the sheet goes without link.
 */
export async function createHandout(
  actor: Actor,
  consultationId: string,
  channel: 'EMAIL' | 'PRINT',
  opts: { withLink?: boolean } = {},
) {
  const ctx = await handoutContext(consultationId);
  if (!ctx) throw new HandoutError('notFound');
  if (!ctx.prescriptions.length) throw new HandoutError('noPrescription');
  if (channel === 'EMAIL' && !ctx.consent.granted) throw new HandoutError('noConsent');
  if (channel === 'EMAIL' && !ctx.patient.email) throw new HandoutError('noAddress');
  const version = (ctx.consultation.handouts[0]?.version ?? 0) + 1;
  const documentNumber = await nextDocumentNumber();
  const { pdf, language, snapshot } = await buildHandout(ctx, documentNumber, version);
  const hash = sha256(pdf);
  const blobPath = `${ctx.patient.id}/${documentNumber}.pdf`;
  await documentStore().put(blobPath, pdf, 'application/pdf');
  const details = {
    consultationId,
    number: ctx.consultation.number,
    regionId: ctx.consultation.treatment.regionId,
    treatmentId: ctx.consultation.treatmentId,
    version,
  };
  const result = await db.$transaction(async (tx) => {
    const handout = await tx.exerciseHandout.create({
      data: {
        documentNumber,
        patientId: ctx.patient.id,
        consultationId,
        version,
        language,
        prescriptions: snapshot as unknown as Prisma.InputJsonValue,
        blobPath,
        sha256: hash,
        sizeBytes: pdf.length,
        createdBy: actor.name,
      },
    });
    const delivery = await tx.handoutDelivery.create({
      data: {
        handoutId: handout.id,
        channel,
        recipient: channel === 'EMAIL' ? ctx.patient.email : null,
        status: channel === 'EMAIL' ? 'PENDING' : null,
        requestedBy: actor.name,
      },
    });
    await audit(
      actor,
      'handout.created',
      { patientId: ctx.patient.id, after: documentNumber, details: { ...details, channel, sha256: hash } },
      tx,
    );
    if (channel === 'PRINT')
      await audit(actor, 'handout.printed', { patientId: ctx.patient.id, after: documentNumber, details }, tx);
    let access: { url: string; linkId: string; expiresAt: Date } | null = null;
    if (opts.withLink && zoneEnabled()) {
      try {
        const issued = await issueAccessLink(actor, ctx.patient.id, tx);
        access = { url: issued.url, linkId: issued.link.id, expiresAt: issued.link.expiresAt };
      } catch (e) {
        if (!(e instanceof AccessLinkError)) throw e;
      }
    }
    if (access) {
      await tx.accessLinkDelivery.create({
        data: {
          linkId: access.linkId,
          channel,
          handoutId: handout.id,
          recipient: delivery.recipient,
          status: channel === 'EMAIL' ? 'PENDING' : null,
          requestedBy: actor.name,
        },
      });
      await audit(
        actor,
        channel === 'EMAIL' ? 'accessLink.sent' : 'accessLink.printed',
        {
          patientId: ctx.patient.id,
          after: channel === 'EMAIL' ? delivery.recipient : null,
          details: { linkId: access.linkId, handoutId: handout.id },
        },
        tx,
      );
    }
    return { handout, delivery, access };
  });
  // The printed copy with the access sheet is rendered once more, only for this printout
  const printPdf =
    channel === 'PRINT' && result.access
      ? (
          await buildHandout(ctx, documentNumber, version, {
            url: result.access.url,
            expiresAt: result.access.expiresAt,
          })
        ).pdf
      : null;
  return { ...result, printPdf };
}

/**
 * Sends a handout by email with the retries of the signed form; status and attempts on the delivery row. With
 * `accessUrl` the link to the patient zone is in the text, and the link's delivery row gets the same status.
 */
export async function deliverHandout(deliveryId: string, opts: { retryDelayMs?: number; accessUrl?: string } = {}) {
  const delivery = await db.handoutDelivery.findUnique({
    where: { id: deliveryId },
    include: { handout: { include: { patient: true, consultation: true } } },
  });
  if (!delivery || delivery.channel !== 'EMAIL' || delivery.status !== 'PENDING' || !delivery.recipient)
    return delivery;
  const { handout } = delivery;
  const t = translator(handout.language, 'handoutEmail');
  const data = await documentStore().get(handout.blobPath);
  if (sha256(data) !== handout.sha256) throw new Error(`Checksum mismatch for ${handout.documentNumber}`);
  const result = await sendWithRetry(
    {
      to: delivery.recipient,
      subject: t('subject', { number: handout.documentNumber }),
      text: opts.accessUrl
        ? t('bodyWithLink', {
            name: `${handout.patient.firstName} ${handout.patient.lastName}`,
            date: formatDateZurich(handout.consultation.at),
            url: opts.accessUrl,
          })
        : t('body', {
            name: `${handout.patient.firstName} ${handout.patient.lastName}`,
            date: formatDateZurich(handout.consultation.at),
          }),
      attachment: { name: `${handout.documentNumber}.pdf`, contentType: 'application/pdf', data },
    },
    {
      retryDelayMs: opts.retryDelayMs,
      onFailedAttempt: async (attempt, lastError) => {
        await db.handoutDelivery.update({ where: { id: deliveryId }, data: { attempts: attempt, lastError } });
      },
    },
  );
  const details = { document: handout.documentNumber };
  const linkDelivery = { handoutId: handout.id, channel: 'EMAIL' as const, status: 'PENDING' as const };
  if (result.ok) {
    await db.handoutDelivery.update({
      where: { id: deliveryId },
      data: { status: 'SENT', attempts: result.attempts, sentAt: new Date(), lastError: null },
    });
    if (opts.accessUrl)
      await db.accessLinkDelivery.updateMany({
        where: linkDelivery,
        data: { status: 'SENT', attempts: result.attempts, sentAt: new Date() },
      });
    await audit(SYSTEM_ACTOR, 'email.sent', { patientId: handout.patientId, after: delivery.recipient, details });
  } else {
    await db.handoutDelivery.update({ where: { id: deliveryId }, data: { status: 'FAILED' } });
    if (opts.accessUrl)
      await db.accessLinkDelivery.updateMany({
        where: linkDelivery,
        data: { status: 'FAILED', attempts: result.attempts, lastError: result.lastError.slice(0, 300) },
      });
    await audit(SYSTEM_ACTOR, 'email.failed', {
      patientId: handout.patientId,
      after: result.lastError.slice(0, 300),
      details,
    });
  }
  return db.handoutDelivery.findUnique({ where: { id: deliveryId } });
}

/** "Erneut senden": a new email of the same archived handout, to the current address, if consent is still given. */
export async function requestHandoutResend(actor: Actor, handoutId: string) {
  const h = await db.exerciseHandout.findUniqueOrThrow({ where: { id: handoutId }, include: { patient: true } });
  const consent = await emailConsentOf(h.patientId);
  const status = !consent.granted ? 'SKIPPED_NO_CONSENT' : !h.patient.email ? 'SKIPPED_NO_ADDRESS' : 'PENDING';
  const delivery = await db.handoutDelivery.create({
    data: {
      handoutId,
      channel: 'EMAIL',
      recipient: status === 'PENDING' ? h.patient.email : null,
      status,
      requestedBy: actor.name,
    },
  });
  await audit(actor, 'email.resend', {
    patientId: h.patientId,
    after: h.patient.email,
    details: { document: h.documentNumber },
  });
  return delivery;
}

/** Handouts of a patient for "Dokumente", newest first, with the latest delivery */
export async function handoutsOf(patientId: string) {
  return db.exerciseHandout.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    include: {
      consultation: { select: { id: true, number: true, treatmentId: true } },
      deliveries: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
}
