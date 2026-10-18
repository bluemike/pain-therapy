import type { z } from 'zod';
import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { linkState } from '@pain-therapy/shared/access';
import { currentProgram, currentPrograms } from '@pain-therapy/shared/program';
import { zurichInputs } from '@pain-therapy/shared/time';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { createPatient, historyOf, setStatus } from '@/lib/patients';
import { currentVersionNumber } from '@/lib/consent-texts';
import { consultationSchema, EMPTY_PATIENT, patientSchema, sheetSchema, treatmentSchema } from '@/lib/schemas';
import { createConsultation, createTreatment, TreatmentError, updateConsultation } from '@/lib/treatments';
import { createHandout, deliverHandout } from '@/lib/handouts';
import {
  AccessLinkError,
  accessSheetPrinted,
  deliverAccessLink,
  latestLinkOf,
  linkStatusOf,
  revokeAccessLink,
  sendAccessLink,
} from '@/lib/patient-access';
import { exerciseLogOf, homeProgramOverview } from '@/lib/exercise-log';
import { setMailer, type OutgoingMail } from '@/lib/mail';
import type { Actor } from '@/lib/session';
import { syncCatalog } from '../../prisma/catalog/sync.mjs';
import { writePlaceholderMedia } from '../fixtures/exercise-media';
import { resetDatabase } from './db-reset';

/**
 * Iteration 4 in the practice app: link to the patient zone (patient-access), link with the exercise sheet,
 * Kachel "Heimprogramm" and Reiter "Übungstagebuch" (adherence-overview).
 */

vi.mock('@/auth', () => ({ auth: async () => null }));

const actor: Actor = { id: 'u-1', name: 'Christina Franz', email: 'christina@ayanta.ch', roles: ['THERAPIST'] };
const MEDIA = process.env.STORAGE_EXERCISE_LOCAL_DIR!;
const ZONE = 'https://patient.example.ch';
const DAY = 24 * 60 * 60 * 1000;

async function pdfText(buf: Buffer) {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    text += (await page.getTextContent()).items.map((it) => ('str' in it ? it.str : '')).join('') + ' ';
  }
  return { pages: doc.numPages, text };
}

/** Local input "YYYY-MM-DDTHH:mm" (Swiss time) some days before now */
const daysAgo = (days: number) => {
  const { date, time } = zurichInputs(new Date(Date.now() - days * DAY));
  return `${date}T${time}`;
};

async function signedPatient(lastName: string, emailConsent: boolean) {
  const p = await createPatient(
    actor,
    patientSchema.parse({
      ...Object.fromEntries(Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? '' : v])),
      firstName: 'Anna',
      lastName,
      dateOfBirth: '05.03.1980',
      preferredLanguage: 'de',
      email: 'anna@example.ch',
    }),
  );
  const version = await currentVersionNumber();
  const text = await db.consentTextVersion.findFirstOrThrow({ where: { version, language: 'de' } });
  const s = await db.signatureSession.create({
    data: {
      patientId: p.id,
      textVersionId: text.id,
      language: 'de',
      status: 'SIGNED',
      startedBy: actor.name,
      completedAt: new Date(Date.now() - 30 * DAY),
      consents: {
        create: [
          { kind: 'LIABILITY_WAIVER', granted: true },
          { kind: 'DATA_PROCESSING', granted: true },
          { kind: 'UNENCRYPTED_EMAIL', granted: emailConsent },
        ],
      },
    },
  });
  await db.signedDocument.create({
    data: {
      documentNumber: `PT-ZONE-${lastName}`,
      patientId: p.id,
      sessionId: s.id,
      textVersion: version,
      language: 'de',
      blobPath: 'x.pdf',
      sha256: '0',
      sizeBytes: 1,
    },
  });
  return p;
}

const consultationInput = (at: string, sheet: Partial<z.input<typeof sheetSchema>>) =>
  consultationSchema.parse({
    at,
    diagnosis: 'Lumbalgie',
    painBefore: '',
    painAfter: '',
    comparison: '',
    sheet: JSON.stringify({ points: [], exercises: [], ...sheet }),
  });

const prescribed = (code: string) => ({ code, prescribed: true, difficulty: 'MEDIUM' as const, variant: null });
const PROGRAM: Partial<z.input<typeof sheetSchema>> = {
  exercises: [prescribed('2A'), prescribed('2D')],
  home: [
    { code: '2A', timesPerDay: 1, weekdays: 127, note: null },
    { code: '2D', timesPerDay: 1, weekdays: 31, note: null },
  ],
};

/** Patient with a home program from a consultation `ago` days back (active for 12 weeks) */
async function withProgram(lastName: string, opts: { emailConsent?: boolean; ago?: number } = {}) {
  const p = await signedPatient(lastName, opts.emailConsent ?? false);
  const t = await createTreatment(
    actor,
    p.id,
    treatmentSchema.parse({ startedAt: daysAgo(120), regionId: '6', diagnosis: 'Lumbalgie', painStart: '60' }),
  );
  const c = await createConsultation(actor, t.id, consultationInput(daysAgo(opts.ago ?? 1), PROGRAM));
  return { p, t, c };
}

const tokenOf = (url: string) => url.split('/l/')[1];
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** Whatever the practice stores about a link must never contain its token */
async function expectTokenNotStored(token: string) {
  const audit = await db.auditEvent.findMany();
  expect(JSON.stringify(audit)).not.toContain(token);
  const links = await db.patientAccessLink.findMany();
  expect(JSON.stringify(links)).not.toContain(token);
  const deliveries = await db.accessLinkDelivery.findMany();
  expect(JSON.stringify(deliveries)).not.toContain(token);
}

let sent: OutgoingMail[] = [];

beforeAll(async () => {
  await resetDatabase();
  await writePlaceholderMedia(MEDIA);
  await syncCatalog(db);
});
afterAll(async () => {
  await resetDatabase();
  await rm(MEDIA, { recursive: true, force: true });
});
beforeEach(() => {
  config.patientZone.url = ZONE;
  sent = [];
  setMailer({ send: async (m) => void sent.push(m) });
});
afterEach(() => {
  config.patientZone.url = '';
  setMailer(null);
});

describe('access link from the record (Link senden aus der Akte)', () => {
  it('sends the link by email with consent; only the hash is stored', async () => {
    const { p } = await withProgram('Mail', { emailConsent: true });
    const r = await sendAccessLink(actor, p.id);
    expect(r.channel).toBe('EMAIL');
    if (r.channel !== 'EMAIL') return;
    expect(r.url).toMatch(/^https:\/\/patient\.example\.ch\/l\/[A-Za-z0-9_-]{43}$/);
    const delivered = await deliverAccessLink(r.deliveryId, r.url, { retryDelayMs: 1 });
    expect(delivered).toMatchObject({ channel: 'EMAIL', status: 'SENT', recipient: 'anna@example.ch' });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: 'anna@example.ch', subject: 'Ihr Zugang zur Patienten-Zone' });
    expect(sent[0].text).toContain(r.url);
    expect(sent[0].attachment).toBeUndefined();
    const link = await latestLinkOf(p.id);
    expect(link?.tokenHash).toBe(sha(tokenOf(r.url)));
    // Valid for six months
    expect(Math.round((link!.expiresAt.getTime() - link!.createdAt.getTime()) / DAY)).toBeGreaterThanOrEqual(181);
    expect(linkStatusOf(link, { patientActive: true, purposeActive: true })).toBe('sent');
    await expectTokenNotStored(tokenOf(r.url));
    const actions = (await historyOf(p.id)).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['accessLink.issued', 'accessLink.sent', 'email.sent']));
  });

  it('shows a QR code and the access sheet without consent (Ohne E-Mail-Einwilligung)', async () => {
    const { p } = await withProgram('Qr');
    const r = await sendAccessLink(actor, p.id);
    expect(r.channel).toBe('SCREEN');
    if (r.channel !== 'SCREEN') return;
    expect(r.qr).toMatch(/^<svg/);
    const sheet = await pdfText(r.accessSheet);
    expect(sheet.pages).toBe(1);
    expect(sheet.text).toContain('Anna Qr');
    expect(sent).toHaveLength(0);
    expect(linkStatusOf(await latestLinkOf(p.id), { patientActive: true, purposeActive: true })).toBe('shown');
    await accessSheetPrinted(actor, p.id, r.linkId);
    expect(linkStatusOf(await latestLinkOf(p.id), { patientActive: true, purposeActive: true })).toBe('printed');
    expect((await historyOf(p.id)).map((e) => e.action)).toContain('accessLink.printed');
  });

  it('replaces the previous link (Neuer Link ersetzt den alten)', async () => {
    const { p } = await withProgram('Neu');
    await sendAccessLink(actor, p.id);
    await sendAccessLink(actor, p.id);
    const links = await db.patientAccessLink.findMany({ where: { patientId: p.id }, orderBy: { createdAt: 'asc' } });
    expect(links).toHaveLength(2);
    const ctx = { patientActive: true, purposeActive: true };
    expect(linkState(links[0], ctx)).toBe('replaced');
    expect(linkState(links[1], ctx)).toBe('valid');
    expect((await historyOf(p.id)).map((e) => e.action)).toContain('accessLink.replaced');
  });

  it('revokes the link and ends every device session (Link sperren)', async () => {
    const { p } = await withProgram('Sperre');
    await sendAccessLink(actor, p.id);
    const link = (await latestLinkOf(p.id))!;
    const session = await db.patientZoneSession.create({
      data: {
        idHash: sha('session'),
        linkId: link.id,
        patientId: p.id,
        expiresAt: new Date(Date.now() + 30 * DAY),
      },
    });
    const revoked = await revokeAccessLink(actor, p.id);
    expect(revoked?.revokedBy).toBe(actor.name);
    expect((await db.patientZoneSession.findUniqueOrThrow({ where: { id: session.id } })).endedAt).not.toBeNull();
    expect(linkStatusOf(await latestLinkOf(p.id), { patientActive: true, purposeActive: true })).toBe('revoked');
    // Nothing left to revoke
    expect(await revokeAccessLink(actor, p.id)).toBeNull();
    // Links stay in the database
    await expect(db.patientAccessLink.delete({ where: { id: link.id } })).rejects.toThrow();
  });

  it('is offered only with a purpose, an active patient and the zone set up', async () => {
    // After the home program the treatment keeps a purpose (iteration 6, zone-record: Link ohne Heimprogramm)
    const { p } = await withProgram('Alt', { ago: 90 });
    expect((await sendAccessLink(actor, p.id)).channel).toBe('SCREEN');
    const log = await exerciseLogOf(actor, p.id);
    expect(log.active).toBe(false);
    expect(log.canSendLink).toBe(true);
    expect(log.linkStatus).toBe('shown');
    const { p: inactive } = await withProgram('Inaktiv');
    await setStatus(actor, inactive.id, 'INACTIVE');
    await expect(sendAccessLink(actor, inactive.id)).rejects.toMatchObject({ code: 'inactive' });
    config.patientZone.url = '';
    const { p: off } = await withProgram('Aus');
    await expect(sendAccessLink(actor, off.id)).rejects.toBeInstanceOf(AccessLinkError);
    expect(await db.patientAccessLink.count({ where: { patientId: off.id } })).toBe(0);
  });
});

describe('home programs per treatment (iteration 9, design D8)', () => {
  it('keeps the latest prescription of each treatment, newest treatment program first', async () => {
    const { p, c: back } = await withProgram('Zwei', { ago: 10 });
    const neck = await createTreatment(
      actor,
      p.id,
      treatmentSchema.parse({ startedAt: daysAgo(5), regionId: '1', diagnosis: 'Nacken', painStart: '50' }),
    );
    const c = await createConsultation(
      actor,
      neck.id,
      consultationInput(daysAgo(2), {
        exercises: [prescribed('1A')],
        home: [{ code: '1A', timesPerDay: 2, weekdays: 127, note: null }],
      }),
    );
    const programs = await currentPrograms(db, p.id);
    expect(programs.map((x) => [x.consultationId, x.region.code, x.active])).toEqual([
      [c.id, expect.any(String), true],
      [back.id, expect.any(String), true],
    ]);
    expect(programs[0].prescriptions.map((x) => x.exerciseCode)).toEqual(['1A']);
    expect(programs[1].prescriptions.map((x) => x.exerciseCode)).toEqual(['2A', '2D']);
    expect((await currentProgram(db, p.id))?.consultationId).toBe(c.id);
  });
});

describe('link with the exercise sheet (Link mit dem Übungsblatt)', () => {
  it('puts the link into the email text without attachment, never into the archived PDF', async () => {
    const { p, c } = await withProgram('Blatt', { emailConsent: true });
    const { handout, delivery, access } = await createHandout(actor, c.id, 'EMAIL', { withLink: true });
    expect(access?.url).toMatch(/^https:\/\/patient\.example\.ch\/l\//);
    const done = await deliverHandout(delivery.id, { retryDelayMs: 1, accessUrl: access!.url });
    expect(done?.status).toBe('SENT');
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain(access!.url);
    // iteration 9 (design D4): the email carries only the link, the sheet is in the zone under «Dokumente»
    expect(sent[0].attachment).toBeUndefined();
    const archived = await pdfText(
      Buffer.from(await (await import('@/lib/storage')).documentStore().get(handout.blobPath)),
    );
    expect(archived.text).not.toContain(tokenOf(access!.url));
    expect(archived.text).not.toContain('Patienten-Zone');
    const linkDelivery = await db.accessLinkDelivery.findFirstOrThrow({ where: { handoutId: handout.id } });
    expect(linkDelivery).toMatchObject({ channel: 'EMAIL', status: 'SENT' });
    await expectTokenNotStored(tokenOf(access!.url));
    expect(linkStatusOf(await latestLinkOf(p.id), { patientActive: true, purposeActive: true })).toBe('sent');
  });

  it('adds the access sheet to the printout only, and nothing without the checkbox', async () => {
    const { c } = await withProgram('Druck');
    const plain = await createHandout(actor, c.id, 'PRINT');
    expect(plain.access).toBeNull();
    expect(plain.printPdf).toBeNull();
    const withLink = await createHandout(actor, c.id, 'PRINT', { withLink: true });
    expect(withLink.access).not.toBeNull();
    const print = await pdfText(withLink.printPdf!);
    const archived = await pdfText(
      Buffer.from(await (await import('@/lib/storage')).documentStore().get(withLink.handout.blobPath)),
    );
    expect(print.pages).toBe(archived.pages + 1);
    expect(archived.text).not.toContain('Patienten-Zone');
    expect(await db.accessLinkDelivery.count({ where: { handoutId: withLink.handout.id, channel: 'PRINT' } })).toBe(1);
  });

  it('goes without link while the patient zone is not set up', async () => {
    config.patientZone.url = '';
    const { c } = await withProgram('OhneZone');
    const r = await createHandout(actor, c.id, 'PRINT', { withLink: true });
    expect(r.access).toBeNull();
    expect(r.printPdf).toBeNull();
  });
});

describe('adherence in the practice (Kachel "Heimprogramm", Reiter "Übungstagebuch")', () => {
  it('lists active programs with flagged patients first and logs the opening of the tab', async () => {
    const quiet = await withProgram('Zzz', { ago: 5 });
    const busy = await withProgram('Aaa', { ago: 5 });
    // Every day since the session (6 calendar days); 2D is only due Mo–Fr, extra days do not count twice
    for (let d = 0; d < 6; d++)
      for (const code of ['2A', '2D'])
        await db.exerciseLogEntry.create({
          data: {
            patientId: busy.p.id,
            consultationId: busy.c.id,
            exerciseCode: code,
            performedAt: new Date(Date.now() - Math.min(d * DAY + 60_000, 5 * DAY - 60_000)),
            done: true,
            rating: 8,
          },
        });
    const rows = (await homeProgramOverview()).filter((r) => [quiet.p.id, busy.p.id].includes(r.patient.id));
    expect(rows.map((r) => r.patient.lastName)).toEqual(['Zzz', 'Aaa']);
    expect(rows[0].adherence.flags).toEqual(['lowAdherence', 'noEntry']);
    expect(rows[1].adherence.flags).toEqual([]);
    expect(rows[1].adherence.averageRating).toBe(8);

    const log = await exerciseLogOf(actor, busy.p.id);
    expect(log.active).toBe(true);
    expect(log.entries).toHaveLength(12);
    expect(log.adherence?.total.percent).toBe(100);
    expect(log.program?.prescriptions.map((x) => x.exerciseCode)).toEqual(['2A', '2D']);
    expect(await db.auditEvent.count({ where: { patientId: busy.p.id, action: 'exerciseLog.viewed' } })).toBe(1);
    // Opening the tab is in the audit log, not in the history of the record
    expect((await historyOf(busy.p.id)).map((e) => e.action)).not.toContain('exerciseLog.viewed');
  });

  it('keeps logged prescriptions: they cannot be removed from the consultation', async () => {
    const { p, c } = await withProgram('Gesperrt');
    await db.exerciseLogEntry.create({
      data: { patientId: p.id, consultationId: c.id, exerciseCode: '2D', performedAt: new Date(), done: false },
    });
    const without2D = consultationInput(daysAgo(1), {
      exercises: [prescribed('2A')],
      home: [{ code: '2A', timesPerDay: 2, weekdays: 127, note: null }],
    });
    await expect(updateConsultation(actor, c.id, without2D)).rejects.toMatchObject({ code: 'prescriptionLogged' });
    await expect(updateConsultation(actor, c.id, without2D)).rejects.toBeInstanceOf(TreatmentError);
    // Changing the weekdays of a logged exercise keeps its entries
    await updateConsultation(
      actor,
      c.id,
      consultationInput(daysAgo(1), {
        ...PROGRAM,
        home: [
          { code: '2A', timesPerDay: 1, weekdays: 127, note: null },
          { code: '2D', timesPerDay: 1, weekdays: 1 | 4 | 16, note: null },
        ],
      }),
    );
    expect(await db.exerciseLogEntry.count({ where: { consultationId: c.id } })).toBe(1);
  });
});
