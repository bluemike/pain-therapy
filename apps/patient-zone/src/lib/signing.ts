import { randomUUID } from 'node:crypto';
import { ZONE_ACTOR } from '@pain-therapy/shared/access';
import { internalToken } from '@pain-therapy/shared/internal-auth';
import {
  recordSignature,
  SignatureRecordError,
  signingSchema,
  zonePlace,
  type SigningInput,
} from '@pain-therapy/shared/signing';
import { z } from 'zod';
import { db } from './db';
import { zoneAudit } from './audit';
import { config } from './config';
import type { ZoneSession } from './access';

/**
 * zone-consent-signing: the consent form in the patient zone (iteration 5, design D5, D7, D8). Request independent,
 * so the rules are tested without a browser (test/signing.test.ts); the pages and the server action add the rest.
 * Every query selects only columns the role patient_zone may read, and writes go without RETURNING.
 */

/** The personal details shown for checking (Inhalt des Formulars), never stored or shown anywhere else */
export async function personalDetails(s: ZoneSession) {
  return db.patient.findUniqueOrThrow({
    where: { id: s.patient.id },
    select: {
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      street: true,
      zip: true,
      city: true,
      phone: true,
      mobile: true,
      email: true,
      insurer: true,
      insuranceNumber: true,
    },
  });
}

/** Current text in the patient's language */
async function currentText(language: 'de' | 'en') {
  return db.consentTextVersion.findFirst({
    where: { language },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, title: true, body: true, language: true },
  });
}

/**
 * Sitzung des Formulars (design D5): reuses the open session of this device session when it is of the current text,
 * otherwise aborts it and opens a new one with the current version ("Version während des Lesens geändert").
 * Returns null without a published text.
 */
export async function openForm(s: ZoneSession, now = new Date()) {
  const text = await currentText(s.patient.preferredLanguage);
  if (!text) return null;
  const open = await db.signatureSession.findMany({
    where: { zoneSessionId: s.session.id, status: 'OPEN' },
    select: { id: true, textVersionId: true },
    orderBy: { startedAt: 'desc' },
  });
  const reuse = open.find((o) => o.textVersionId === text.id);
  const stale = open.filter((o) => o !== reuse).map((o) => o.id);
  if (stale.length)
    await db.signatureSession.updateMany({
      where: { id: { in: stale }, status: 'OPEN' },
      data: { status: 'ABORTED', abortedAt: now },
    });
  if (reuse) return { sid: reuse.id, text };
  const sid = randomUUID();
  await db.$transaction(async (tx) => {
    await tx.signatureSession.createMany({
      data: [
        {
          id: sid,
          patientId: s.patient.id,
          textVersionId: text.id,
          language: s.patient.preferredLanguage,
          channel: 'PATIENT_ZONE',
          zoneSessionId: s.session.id,
          startedBy: ZONE_ACTOR.id,
          startedAt: now,
        },
      ],
    });
    await zoneAudit(
      'signing.formOpened',
      { patientId: s.patient.id, linkId: s.session.linkId, details: { sessionId: sid, version: text.version } },
      tx,
    );
  });
  return { sid, text };
}

/** What the phone sends: the iPad schema without the place (set here) and a remark of at most 500 characters */
export const zoneSigningSchema = signingSchema.omit({ place: true }).extend({
  note: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === '' ? null : v)),
});

export type SignResult = { ok: true } | { ok: false; error: 'invalid' | 'outdated' | 'notFound' };

/**
 * Abschluss in der Patienten-Zone: stores the signature for the patient of this device session only (recordSignature
 * checks session, patient and current version). A second submit of a session that is already signed counts as
 * success, so a double tap on a slow connection still ends on the thank-you page with exactly one signature.
 */
export async function submitSignature(
  s: ZoneSession,
  sid: string,
  payload: unknown,
  now = new Date(),
): Promise<SignResult> {
  const parsed = zoneSigningSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: 'invalid' };
  const input: SigningInput = { ...parsed.data, place: zonePlace(s.patient.preferredLanguage) };
  try {
    await recordSignature(db, {
      sid,
      input,
      actor: ZONE_ACTOR,
      patientId: s.patient.id,
      zoneSessionId: s.session.id,
      requireCurrentVersion: true,
      now,
    });
    return { ok: true };
  } catch (e) {
    if (!(e instanceof SignatureRecordError)) throw e;
    if (e.code === 'notOpen') {
      const again = await db.signatureSession.findFirst({
        where: { id: sid, zoneSessionId: s.session.id, status: 'SIGNED' },
        select: { id: true },
      });
      if (again) return { ok: true };
    }
    return { ok: false, error: e.code === 'outdated' ? 'outdated' : 'notFound' };
  }
}

/**
 * Asks the practice app to create, archive and send the PDF now (design D7). Failures only get logged: the job
 * caj-pain-therapy-finalize picks the signature up within 5 minutes, and the patient already sees "Vielen Dank".
 */
export async function requestFinalize(sid: string) {
  if (!config.practiceInternalUrl || !config.internalSecret) return;
  try {
    const res = await fetch(
      `${config.practiceInternalUrl}/api/internal/signatures/${encodeURIComponent(sid)}/finalize`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${internalToken(sid, config.internalSecret)}` },
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!res.ok) console.warn(`finalize request for a signature failed: ${res.status}`);
  } catch (e) {
    console.warn(`finalize request for a signature failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}
