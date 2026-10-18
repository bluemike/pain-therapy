import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { internalToken } from '@pain-therapy/shared/internal-auth';
import { recordSignature, signaturePending } from '@pain-therapy/shared/signing';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { createPatient, dashboardData, viewPatient } from '@/lib/patients';
import { currentVersionNumber, publishVersion } from '@/lib/consent-texts';
import { EMPTY_PATIENT, patientSchema } from '@/lib/schemas';
import { openingBlocker } from '@/lib/treatments';
import {
  AccessLinkError,
  deliverAccessLink,
  inviteStatusOf,
  inviteToSign,
  latestLinkOf,
  linkStatusOf,
} from '@/lib/patient-access';
import { deliverEmail, finalizePending, finalizeSignature, resolvePatientNote } from '@/lib/signing';
import { sha256 } from '@/lib/storage';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import type { Actor } from '@/lib/session';
import { POST as finalizeRoute } from '@/app/api/internal/signatures/[sid]/finalize/route';
import { POST as finalizePendingRoute } from '@/app/api/internal/signatures/finalize-pending/route';
import { resetDatabase } from './db-reset';

/**
 * Iteration 5 in the practice app: invitation to sign in the patient zone (zone-consent-invitation) and the PDF of a
 * signature from the zone (zone-consent-signing: PDF, Archiv und Zustellung). Tasks 1.3, 2.1, 2.3, 2.4, 4.1, 4.2, 4.4.
 */

vi.mock('@/auth', () => ({ auth: async () => null }));
vi.mock('next/server', async (orig) => ({ ...(await orig<object>()), after: (fn: () => unknown) => void fn() }));

const actor: Actor = { id: 'u-1', name: 'Christina Franz', email: 'christina@ayanta.ch', roles: ['THERAPIST'] };
const ZONE = 'https://patient.example.ch';
const ZONE_ACTOR = { id: 'patient-zone', name: 'Patienten-Zone' };

let sent: OutgoingMail[] = [];
beforeAll(resetDatabase);
afterAll(resetDatabase);
beforeEach(() => {
  sent = [];
  config.patientZone.url = ZONE;
  setMailer({ send: async (m) => void sent.push(m) });
});
afterEach(() => {
  config.patientZone.url = '';
  setMailer(null);
});

let n = 0;
async function newPatient(opts: { language?: 'de' | 'en' } = {}) {
  n++;
  return createPatient(
    actor,
    patientSchema.parse({
      ...Object.fromEntries(Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? '' : v])),
      firstName: 'Anna',
      lastName: `Muster${n}`,
      dateOfBirth: '12.03.1978',
      preferredLanguage: opts.language ?? 'de',
      email: 'anna@example.ch',
    }),
  );
}

const strokes = [
  [
    [10, 10, 0.5],
    [40, 30, 0.5],
    [80, 20, 0.5],
  ],
] as [number, number, number][][];

/** What the patient zone does on "Unterschreiben": a session of channel PATIENT_ZONE, signed with recordSignature */
async function signInZone(patientId: string, opts: { note?: string; email?: boolean } = {}) {
  const version = await currentVersionNumber();
  const text = await db.consentTextVersion.findFirstOrThrow({ where: { version, language: 'de' } });
  const link = await db.patientAccessLink.create({
    data: { patientId, tokenHash: `h${Math.random()}`, createdBy: 'x', expiresAt: new Date(Date.now() + 1e9) },
  });
  const zoneSession = await db.patientZoneSession.create({
    data: {
      idHash: `s${Math.random()}`,
      linkId: link.id,
      patientId,
      expiresAt: new Date(Date.now() + 1e9),
      createdAt: new Date('2026-10-15T17:35:00Z'),
    },
  });
  const s = await db.signatureSession.create({
    data: {
      patientId,
      textVersionId: text.id,
      language: 'de',
      channel: 'PATIENT_ZONE',
      zoneSessionId: zoneSession.id,
      startedBy: 'patient-zone',
    },
  });
  await recordSignature(db, {
    sid: s.id,
    actor: ZONE_ACTOR,
    patientId,
    zoneSessionId: zoneSession.id,
    requireCurrentVersion: true,
    input: {
      note: opts.note ?? null,
      place: 'Online (Patienten-Zone)',
      readToEnd: true,
      liability: true,
      dataProcessing: true,
      unencryptedEmail: opts.email ?? false,
      strokes,
      width: 340,
      height: 180,
    },
  });
  return s.id;
}

describe('pending signature (Ausstehende Unterschrift)', () => {
  it('is pending without signature and for an older version, not without any text', () => {
    expect(signaturePending(null, 1)).toBe(true);
    expect(signaturePending(1, 2)).toBe(true);
    expect(signaturePending(2, 2)).toBe(false);
    expect(signaturePending(null, 0)).toBe(false);
  });

  it('counts a signature from the zone at once, before its PDF exists (design D2)', async () => {
    const p = await newPatient();
    expect(await openingBlocker(p.id)).toBe('consent');
    await signInZone(p.id);
    expect(await openingBlocker(p.id)).toBeNull();
    const rec = await viewPatient(actor, p.id);
    expect(rec?.consent).toBe('signed');
    expect(rec?.finalizing).toHaveLength(1);
    expect((await dashboardData()).pending.some((x) => x.id === p.id)).toBe(false);
  });
});

describe('invitation (Zur Unterschrift einladen)', () => {
  it('sends the invitation email without email consent, with link and no health data (Einladung ohne E-Mail-Einwilligung)', async () => {
    const p = await newPatient({ language: 'en' });
    const r = await inviteToSign(actor, p.id, 'EMAIL');
    expect(r.channel).toBe('EMAIL');
    if (r.channel !== 'EMAIL') return;
    const d = await deliverAccessLink(r.deliveryId, r.url, { retryDelayMs: 1 });
    expect(d).toMatchObject({ status: 'SENT', purpose: 'SIGNATURE' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'anna@example.ch', subject: 'Please sign the liability waiver' });
    expect(sent[0].text).toContain(r.url);
    expect(sent[0].text).toContain('date of birth');
    expect(sent[0].attachment).toBeUndefined();
    expect(sent[0].text).not.toMatch(/Haftungsausschluss\n|Diagnos/);
    expect(await inviteStatusOf(p.id, true)).toMatchObject({ kind: 'sent', channel: 'EMAIL' });
    const events = await db.auditEvent.findMany({ where: { patientId: p.id }, orderBy: { at: 'asc' } });
    expect(events.map((e) => e.action)).toEqual(
      expect.arrayContaining(['accessLink.issued', 'accessLink.invited', 'email.sent']),
    );
    expect(events.find((e) => e.action === 'email.sent')?.details).toMatchObject({ kind: 'signatureInvite' });
  });

  it('shows a QR code with the access sheet and replaces the previous link', async () => {
    const p = await newPatient();
    await inviteToSign(actor, p.id, 'EMAIL');
    const r = await inviteToSign(actor, p.id, 'SCREEN');
    expect(r.channel).toBe('SCREEN');
    if (r.channel !== 'SCREEN') return;
    expect(r.qr).toContain('<svg');
    expect(r.accessSheet.subarray(0, 5).toString()).toBe('%PDF-');
    const links = await db.patientAccessLink.findMany({ where: { patientId: p.id }, orderBy: { createdAt: 'asc' } });
    expect(links.map((l) => !!l.replacedAt)).toEqual([true, false]);
    expect(await inviteStatusOf(p.id, true)).toMatchObject({ kind: 'sent', channel: 'SCREEN' });
    // The link counts as valid while the signature is pending (Gültigkeit des Links)
    expect(linkStatusOf(await latestLinkOf(p.id), { patientActive: true, purposeActive: true })).toBe('shown');
  });

  it('is not offered once signed, and needs an address for email', async () => {
    const signed = await newPatient();
    await signInZone(signed.id);
    await expect(inviteToSign(actor, signed.id, 'SCREEN')).rejects.toThrow(AccessLinkError);
    // Older records may have no address (email is required only for new patients)
    const noMail = await newPatient();
    await db.patient.update({ where: { id: noMail.id }, data: { email: null } });
    await expect(inviteToSign(actor, noMail.id, 'EMAIL')).rejects.toThrow('noEmail');
    config.patientZone.url = '';
    await expect(inviteToSign(actor, noMail.id, 'SCREEN')).rejects.toThrow('disabled');
  });

  it('shows failed delivery, link opened and signed online (Stand der Einladung)', async () => {
    setMailer({
      send: async () => {
        throw new Error('Graph 503');
      },
    });
    const p = await newPatient();
    const r = await inviteToSign(actor, p.id, 'EMAIL');
    if (r.channel === 'EMAIL') await deliverAccessLink(r.deliveryId, r.url, { retryDelayMs: 1 });
    expect(await inviteStatusOf(p.id, true)).toMatchObject({ kind: 'failed' });
    const link = await latestLinkOf(p.id);
    await db.patientAccessLink.update({ where: { id: link!.id }, data: { lastUsedAt: new Date() } });
    expect(await inviteStatusOf(p.id, true)).toMatchObject({ kind: 'opened' });
    await signInZone(p.id);
    expect(await inviteStatusOf(p.id, false)).toMatchObject({ kind: 'signedOnline', version: 1 });
  });
});

describe('PDF of a signature from the zone (PDF, Archiv und Zustellung)', () => {
  it('creates exactly one PDF when called twice at the same time, and sends no email with it (iteration 9)', async () => {
    const p = await newPatient();
    const sid = await signInZone(p.id, { email: true, note: 'Neue Mobile-Nummer' });
    const [a, b] = await Promise.all([finalizeSignature(sid), finalizeSignature(sid)]);
    const done = [a, b].filter(Boolean);
    expect(done).toHaveLength(1);
    expect(await db.signedDocument.count({ where: { sessionId: sid } })).toBe(1);
    const { document, delivery } = done[0]!;
    const file = await readFile(path.join(process.env.STORAGE_LOCAL_DIR!, document.blobPath));
    expect(sha256(file)).toBe(document.sha256);
    // zone-documents: the patient finds the PDF under "Dokumente" in the zone
    expect(delivery).toBeNull();
    expect(await db.emailDelivery.count({ where: { documentId: document.id } })).toBe(0);
    expect(sent).toHaveLength(0);
    expect(await finalizeSignature(sid)).toBeNull();
    const rec = await viewPatient(actor, p.id);
    expect(rec?.finalizing).toHaveLength(0);
    expect(rec?.documents[0].session.channel).toBe('PATIENT_ZONE');
  });

  it('still emails the PDF with consent when no patient zone is configured', async () => {
    const p = await newPatient();
    const sid = await signInZone(p.id, { email: true });
    config.patientZone.url = '';
    const r = await finalizeSignature(sid);
    expect(r?.delivery).toMatchObject({
      status: 'PENDING',
      recipient: 'anna@example.ch',
      requestedBy: 'Patienten-Zone',
    });
    await deliverEmail(r!.delivery!.id, { retryDelayMs: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].attachment).toBeDefined();
  });

  it('records no consent without the zone and without consent (Ohne E-Mail-Einwilligung)', async () => {
    const p = await newPatient();
    const sid = await signInZone(p.id, { email: false });
    config.patientZone.url = '';
    const r = await finalizeSignature(sid);
    expect(r?.delivery?.status).toBe('SKIPPED_NO_CONSENT');
  });

  it('accepts only signed calls on the internal route', async () => {
    const p = await newPatient();
    const sid = await signInZone(p.id);
    const call = (auth?: string) =>
      finalizeRoute(
        new Request(`http://practice/api/internal/signatures/${sid}/finalize`, {
          method: 'POST',
          headers: auth ? { authorization: auth } : {},
        }),
        { params: Promise.resolve({ sid }) },
      );
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer ${internalToken(sid, 'wrong')}`)).status).toBe(401);
    expect((await call(`Bearer ${internalToken('other', config.internalSecret)}`)).status).toBe(401);
    const ok = await call(`Bearer ${internalToken(sid, config.internalSecret)}`);
    expect(ok.status).toBe(200);
    expect(await db.signedDocument.count({ where: { sessionId: sid } })).toBe(1);
    // A second call finds the document and changes nothing
    expect((await call(`Bearer ${internalToken(sid, config.internalSecret)}`)).status).toBe(404);
    // iPad sessions are not finalized through this route
    const ipadPatient = await newPatient();
    const ipad = await db.signatureSession.create({
      data: {
        patientId: ipadPatient.id,
        textVersionId: (await db.consentTextVersion.findFirstOrThrow({ where: { language: 'de' } })).id,
        language: 'de',
        channel: 'IPAD',
        startedBy: actor.name,
      },
    });
    const r = await finalizeRoute(
      new Request('http://practice/x', {
        method: 'POST',
        headers: { authorization: `Bearer ${internalToken(ipad.id, config.internalSecret)}` },
      }),
      { params: Promise.resolve({ sid: ipad.id }) },
    );
    expect(r.status).toBe(404);
  });

  it('processes signatures left without PDF (Praxis-App kurz nicht erreichbar)', async () => {
    const p = await newPatient();
    const sid = await signInZone(p.id);
    await db.signatureSession.update({ where: { id: sid }, data: { completedAt: new Date(Date.now() - 120_000) } });
    const unauthorized = await finalizePendingRoute(new Request('http://practice/x', { method: 'POST' }));
    expect(unauthorized.status).toBe(401);
    const res = await finalizePendingRoute(
      new Request('http://practice/x', {
        method: 'POST',
        headers: { authorization: `Bearer ${internalToken('finalize-pending', config.internalSecret)}` },
      }),
    );
    expect(await res.json()).toMatchObject({ done: 1 });
    expect(await db.signedDocument.count({ where: { sessionId: sid } })).toBe(1);
    expect((await finalizePending()).found).toBe(0);
  });
});

describe('remark on the personal details (Anmerkung zu den Personalien)', () => {
  it('shows the remark until marked as done, in the record and on the dashboard', async () => {
    const p = await newPatient();
    const sid = await signInZone(p.id, { note: 'Adresse stimmt nicht' });
    expect((await viewPatient(actor, p.id))?.unresolvedNote?.patientNote).toBe('Adresse stimmt nicht');
    expect((await dashboardData()).openNotes.some((x) => x.id === p.id)).toBe(true);
    await resolvePatientNote(actor, p.id, sid);
    expect((await viewPatient(actor, p.id))?.unresolvedNote).toBeNull();
    expect((await dashboardData()).openNotes.some((x) => x.id === p.id)).toBe(false);
    expect(await db.auditEvent.count({ where: { patientId: p.id, action: 'signing.noteResolved' } })).toBe(1);
  });
});

describe('new text version', () => {
  it('makes the signature pending again and allows a new invitation', async () => {
    const p = await newPatient();
    await signInZone(p.id);
    expect(await inviteStatusOf(p.id, false)).toMatchObject({ kind: 'signedOnline' });
    await publishVersion(actor, { titleDe: 'T', bodyDe: '## A\nText', titleEn: 'T', bodyEn: '## A\nText' });
    expect((await dashboardData()).pending.find((x) => x.id === p.id)?.consent).toBe('resign');
    // Invitations before the latest signature do not count
    expect(await inviteStatusOf(p.id, true)).toEqual({ kind: 'notInvited' });
    await expect(inviteToSign(actor, p.id, 'SCREEN')).resolves.toMatchObject({ channel: 'SCREEN' });
  });
});
