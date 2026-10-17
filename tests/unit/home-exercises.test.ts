import type { z } from 'zod';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { db } from '@/lib/db';
import { config } from '@/lib/config';
import { createPatient, historyOf } from '@/lib/patients';
import { currentVersionNumber } from '@/lib/consent-texts';
import { consultationSchema, EMPTY_PATIENT, patientSchema, sheetSchema, treatmentSchema } from '@/lib/schemas';
import { createConsultation, createTreatment, getConsultation, sheetOf, updateConsultation } from '@/lib/treatments';
import { exerciseChoices, exerciseDetail, loadExerciseMedia } from '@/lib/exercise-sheets';
import {
  createHandout,
  deliverHandout,
  emailConsentOf,
  HandoutError,
  handoutContext,
  handoutsOf,
  requestHandoutResend,
} from '@/lib/handouts';
import { renderHandoutPdf, type HandoutPdfInput } from '@/lib/handout-pdf';
import { setMailer } from '@/lib/mail';
import { documentStore, setExerciseMediaStore, sha256 } from '@/lib/storage';
import type { Actor } from '@/lib/session';
import { normalizeContent, syncCatalog } from '../../prisma/catalog/sync.mjs';
import { placeholderPng, writePlaceholderMedia } from '../fixtures/exercise-media';
import { TINY_JPEG } from '../fixtures/jpeg';
import { resetDatabase } from './db-reset';

// The media and document routes check the session through Auth.js; tests replace it
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/auth', () => ({ auth: async () => session.current }));
// Graph sendMail needs a token; the request itself goes to a stubbed fetch
vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: class {
    async getToken() {
      return { token: 'test-token' };
    }
  },
}));

const actor: Actor = { id: 'u-1', name: 'Christina Franz', email: 'christina@ayanta.ch', roles: ['THERAPIST'] };
const THERAPIST = { user: { id: 'u-1', name: 'Christina Franz', roles: ['THERAPIST'] } };
const MEDIA = process.env.STORAGE_EXERCISE_LOCAL_DIR!;

async function pdfText(buf: Buffer) {
  const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: false }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    // Runs of one line are joined as they are; the end of a line becomes a space
    text += (await page.getTextContent()).items
      .map((it) => ('str' in it ? it.str + (it.hasEOL ? ' ' : '') : ''))
      .join('');
    text += ' ';
  }
  return { pages: doc.numPages, text: text.replace(/\s+/g, ' ') };
}

/** A patient with a valid signed disclaimer, with or without consent to unencrypted email */
async function signedPatient(lastName: string, opts: { emailConsent: boolean; language?: 'de' | 'en' }) {
  const p = await createPatient(
    actor,
    patientSchema.parse({
      ...Object.fromEntries(Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? '' : v])),
      firstName: 'Anna',
      lastName,
      dateOfBirth: '05.03.1980',
      preferredLanguage: opts.language ?? 'de',
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
      completedAt: new Date('2026-10-13T08:00:00Z'),
      consents: {
        create: [
          { kind: 'LIABILITY_WAIVER', granted: true },
          { kind: 'DATA_PROCESSING', granted: true },
          { kind: 'UNENCRYPTED_EMAIL', granted: opts.emailConsent },
        ],
      },
    },
  });
  await db.signedDocument.create({
    data: {
      documentNumber: `PT-TEST-${lastName}`,
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

const consultationInput = (sheet: Partial<z.input<typeof sheetSchema>>) =>
  consultationSchema.parse({
    at: '2026-10-13T09:30',
    diagnosis: 'Lumbalgie',
    painBefore: '',
    painAfter: '',
    comparison: '',
    sheet: JSON.stringify({ points: [], exercises: [], ...sheet }),
  });

const prescribed = (code: string) => ({ code, prescribed: true, difficulty: 'MEDIUM' as const, variant: null });
const MO_FR = 31;

/** Session on area 6 with 2A 2× daily, 2D 1× Mo–Fr and 4B (from the catalog) */
async function consultationWithProgram(lastName: string, opts: { emailConsent: boolean; language?: 'de' | 'en' }) {
  const p = await signedPatient(lastName, opts);
  const t = await createTreatment(
    actor,
    p.id,
    treatmentSchema.parse({ startedAt: '2026-10-01T09:15', regionId: '6', diagnosis: 'Lumbalgie', painStart: '60' }),
  );
  const c = await createConsultation(
    actor,
    t.id,
    consultationInput({
      exercises: [prescribed('2A'), prescribed('2D'), prescribed('4B')],
      home: [
        { code: '2A', timesPerDay: 2, weekdays: 127, note: null },
        { code: '2D', timesPerDay: 1, weekdays: MO_FR, note: 'abends' },
      ],
    }),
  );
  return { p, t, c };
}

beforeAll(async () => {
  await resetDatabase();
  await writePlaceholderMedia(MEDIA);
  await syncCatalog(db);
});
afterAll(async () => {
  await resetDatabase();
  await rm(MEDIA, { recursive: true, force: true });
});
afterEach(() => {
  setMailer(null);
  setExerciseMediaStore(null);
  session.current = null;
  vi.unstubAllGlobals();
});

describe('exercise library', () => {
  it('loads timing from the repository and texts from the exercise media (task 1.6)', async () => {
    const twoA = await exerciseDetail('2A');
    expect(twoA?.sheet).toMatchObject({ sheetPage: 7, mainImage: '2A.jpg', sheetImage: '2A-blatt.png', sides: 1 });
    expect(twoA?.timing).toEqual({ stretchSecondsPerSide: 120, sides: 1, rollingSeconds: 120 });
    expect(twoA?.content?.rolling).toContain('Platzhalter 2A');
    expect(twoA?.content?.steps.map((s) => s.label)).toEqual(['Schritt 1', 'Schritt 2', 'Schritt 3a', 'Schritt 3b']);
    expect((await exerciseDetail('1C'))?.timing?.stretchSecondsPerSide).toBeNull();
    expect((await exerciseDetail('1C'))?.timingTodo).toHaveLength(1);
    const choices = await exerciseChoices();
    expect(choices).toHaveLength(27);
    expect(choices.find((x) => x.code === '2C')?.timing).toEqual({
      stretchSecondsPerSide: null,
      sides: 1,
      rollingSeconds: 120,
    });
    // A second sync changes nothing
    const again = await syncCatalog(db);
    expect(again.exerciseSheet).toMatchObject({ created: 0, updated: 0, retired: 0, unchanged: 27 });
  });

  it('keeps texts when the content file is missing and shows "noch nicht erfasst" on a fresh database', async () => {
    // Missing file: nothing is overwritten
    const stats = await syncCatalog(db, { content: null });
    expect(stats.exerciseSheet.updated).toBe(0);
    expect((await exerciseDetail('2A'))?.content).not.toBeNull();
    // Content without 4G: its texts become "noch nicht erfasst", the rest stays
    const file = JSON.parse(await readFile(path.join(MEDIA, 'exercises-content.json'), 'utf8')) as { code: string }[];
    await syncCatalog(db, { content: file.filter((x) => x.code !== '4G') });
    expect((await exerciseDetail('4G'))?.content).toBeNull();
    expect((await exerciseDetail('4F'))?.content).not.toBeNull();
    await syncCatalog(db, { content: file });
    expect((await exerciseDetail('4G'))?.content).not.toBeNull();
  });

  it('accepts the content in several shapes', () => {
    expect(
      normalizeContent({ code: '1A', sections: { rolling: ['a', 'b'], stretch: ['x', 'y'], variants: '' } }, [
        'Schritt 1',
        'Schritt 2',
      ]),
    ).toEqual({
      rolling: 'a\nb',
      steps: [
        { label: 'Schritt 1', text: 'x' },
        { label: 'Schritt 2', text: 'y' },
      ],
      variants: null,
    });
    expect(normalizeContent({ code: '1A', stretch: 'alles' })).toEqual({
      rolling: null,
      steps: [{ label: '', text: 'alles' }],
      variants: null,
    });
    expect(normalizeContent({ code: '1A' })).toBeNull();
    expect(normalizeContent(null)).toBeNull();
  });

  it('delivers images only to signed-in users with a role (Bild ohne Anmeldung)', async () => {
    const { exerciseMediaResponse: route } = await import('@/lib/exercise-media-route');
    const exerciseMediaResponse = (code: string, kind: string) => route(new Request('http://localhost'), code, kind);
    expect((await exerciseMediaResponse('2A', 'main')).status).toBe(403);
    session.current = { user: { id: 'u-2', name: 'Ohne Rolle', roles: [] } };
    expect((await exerciseMediaResponse('2A', 'main')).status).toBe(403);
    session.current = THERAPIST;
    const main = await exerciseMediaResponse('2A', 'main');
    expect(main.status).toBe(200);
    expect(main.headers.get('content-type')).toBe('image/jpeg');
    expect(Buffer.from(await main.arrayBuffer()).equals(TINY_JPEG)).toBe(true);
    const sheet = await exerciseMediaResponse('2A', 'sheet');
    expect(sheet.headers.get('content-type')).toBe('image/png');
    expect((await exerciseMediaResponse('2A', 'other')).status).toBe(404);
    expect((await exerciseMediaResponse('9Z', 'main')).status).toBe(404);
  });

  it('plays the spoken sheet, also in byte ranges for Safari (Audio anhören)', async () => {
    const { exerciseMediaResponse } = await import('@/lib/exercise-media-route');
    const mp3 = Buffer.from('ID3-placeholder-audio-0123456789');
    setExerciseMediaStore({ get: async (name) => (name === '2A.mp3' ? mp3 : null) });
    const get = (headers: Record<string, string> = {}) =>
      exerciseMediaResponse(new Request('http://localhost', { headers }), '2A', 'audio');
    expect((await get()).status).toBe(403);
    session.current = THERAPIST;
    const full = await get();
    expect(full.status).toBe(200);
    expect(full.headers.get('content-type')).toBe('audio/mpeg');
    expect(full.headers.get('accept-ranges')).toBe('bytes');
    expect(Buffer.from(await full.arrayBuffer()).equals(mp3)).toBe(true);
    const part = await get({ range: 'bytes=0-1' });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe(`bytes 0-1/${mp3.length}`);
    expect(Buffer.from(await part.arrayBuffer()).toString()).toBe('ID');
    const tail = await get({ range: 'bytes=-4' });
    expect(Buffer.from(await tail.arrayBuffer()).toString()).toBe('6789');
    expect((await get({ range: `bytes=${mp3.length}-` })).status).toBe(416);
    expect((await exerciseMediaResponse(new Request('http://localhost'), '2B', 'audio')).status).toBe(404);
  });

  it('degrades gracefully while the media are not uploaded', async () => {
    setExerciseMediaStore({ get: async () => null });
    expect(await loadExerciseMedia('2A', 'main')).toBeNull();
    const { exerciseMediaResponse } = await import('@/lib/exercise-media-route');
    session.current = THERAPIST;
    expect((await exerciseMediaResponse(new Request('http://localhost'), '2A', 'main')).status).toBe(404);
    expect((await exerciseMediaResponse(new Request('http://localhost'), '2A', 'audio')).status).toBe(404);
  });
});

describe('home program', () => {
  it('stores one prescription per prescribed exercise and removes it with "verordnet" (Block Selbstausführung)', async () => {
    const { p, c } = await consultationWithProgram('Programm', { emailConsent: true });
    const stored = (await getConsultation(c.id))!;
    expect(sheetOf(stored).home).toEqual([
      { code: '2A', variant: null, timesPerDay: 2, weekdays: 127, note: null },
      { code: '2D', variant: null, timesPerDay: 1, weekdays: MO_FR, note: 'abends' },
      // Added from the catalog, prescribed with the default
      { code: '4B', variant: null, timesPerDay: 1, weekdays: 127, note: null },
    ]);

    // Changing days and removing 4B from the prescription
    await updateConsultation(
      actor,
      c.id,
      consultationInput({
        exercises: [prescribed('2A'), prescribed('2D'), { ...prescribed('4B'), prescribed: false, difficulty: 'EASY' }],
        home: [
          { code: '2A', timesPerDay: 2, weekdays: MO_FR, note: null },
          { code: '2D', timesPerDay: 1, weekdays: MO_FR, note: 'abends' },
          { code: '4B', timesPerDay: 1, weekdays: 127, note: null },
        ],
      }),
    );
    expect(
      (await db.homePrescription.findMany({ where: { consultationId: c.id } })).map((h) => h.exerciseCode).sort(),
    ).toEqual(['2A', '2D']);
    expect(
      (await db.homePrescription.findFirst({ where: { consultationId: c.id, exerciseCode: '2A' } }))?.weekdays,
    ).toBe(MO_FR);

    // Änderungshistorie (task 2.4)
    const changes = (await historyOf(p.id))
      .filter((e) => e.action === 'consultation.updated' && e.field?.startsWith('home:'))
      .map((e) => [e.field, e.before, e.after])
      .sort();
    expect(changes).toEqual([
      ['home:2A:weekdays', '127', '31'],
      ['home:4B:timesPerDay', '1', null],
      ['home:4B:weekdays', '127', null],
    ]);
  });

  it('rejects no weekday and 4× per day in the database too', async () => {
    const { c } = await consultationWithProgram('Wochentage', { emailConsent: false });
    const where = { consultationId_exerciseCode: { consultationId: c.id, exerciseCode: '2A' } };
    await expect(db.homePrescription.update({ where, data: { weekdays: 0 } })).rejects.toThrow(/check/i);
    await expect(db.homePrescription.update({ where, data: { timesPerDay: 4 } })).rejects.toThrow(/check/i);
  });
});

describe('exercise handout', () => {
  it('is never created by saving (Kein automatisches Blatt)', async () => {
    const { p } = await consultationWithProgram('KeinBlatt', { emailConsent: true });
    expect(await db.exerciseHandout.count({ where: { patientId: p.id } })).toBe(0);
  });

  it('is not offered without a prescription (Ohne Verordnung)', async () => {
    const { t } = await consultationWithProgram('OhneVerordnung', { emailConsent: true });
    const c = await createConsultation(actor, t.id, consultationInput({}));
    expect((await handoutContext(c.id))?.prescriptions).toHaveLength(0);
    await expect(createHandout(actor, c.id, 'PRINT')).rejects.toMatchObject({ code: 'noPrescription' });
  });

  it('prints: cover page and three sheets, archived with document number, printout noted (Ohne Einwilligung)', async () => {
    const { p, c } = await consultationWithProgram('Druck', { emailConsent: false });
    const ctx = (await handoutContext(c.id))!;
    expect(ctx.canEmail).toBe(false);
    await expect(createHandout(actor, c.id, 'EMAIL')).rejects.toBeInstanceOf(HandoutError);
    await expect(createHandout(actor, c.id, 'EMAIL')).rejects.toMatchObject({ code: 'noConsent' });

    const { handout, delivery } = await createHandout(actor, c.id, 'PRINT');
    expect(handout).toMatchObject({ version: 1, language: 'de', createdBy: 'Christina Franz' });
    expect(handout.documentNumber).toMatch(/^PT-\d{4}-\d{5}$/);
    expect(delivery).toMatchObject({ channel: 'PRINT', status: null, recipient: null });
    const pdf = await documentStore().get(handout.blobPath);
    expect(sha256(pdf)).toBe(handout.sha256);
    const { pages, text } = await pdfText(pdf);
    expect(pages).toBe(4);
    for (const s of [
      'Ihr Übungsprogramm',
      'Anna Druck, geb. 05.03.1980',
      'Sitzung vom 13.10.2026',
      'PRO TAG WOCHENTAGE',
      '2× pro Tag jeden Tag',
      '1× pro Tag Mo Di Mi Do Fr',
      'Faszien-Rollmassage + Engpassdehnung Standardübung',
      'EPD Standardübung',
      'abends',
      // 2A 2x7x4 + 2D 5x4 + 4B 7x6 = 56 + 20 + 42 = 118 min per week, 16.9 → 17 min per day
      'Zeitbedarf: pro Tag 17 min, pro Woche 118 min',
      'dürfen nie 10 oder höher erreichen',
      handout.documentNumber,
    ])
      expect(text).toContain(s);
    const history = await historyOf(p.id);
    expect(history.filter((e) => e.action === 'handout.created')).toHaveLength(1);
    expect(history.filter((e) => e.action === 'handout.printed')).toHaveLength(1);
    // Archived like the signed form: rows cannot change
    await expect(db.exerciseHandout.update({ where: { id: handout.id }, data: { version: 9 } })).rejects.toThrow(
      /append-only/,
    );
    await expect(db.handoutDelivery.delete({ where: { id: delivery.id } })).rejects.toThrow(/cannot be deleted/);
  });

  it('sends by email through Microsoft Graph with consent and shows the status (Versand per E-Mail)', async () => {
    const { p, c } = await consultationWithProgram('Mail', { emailConsent: true });
    expect((await emailConsentOf(p.id)).granted).toBe(true);
    const requests: { url: string; body: { message: { toRecipients: unknown[]; attachments: { name: string }[] } } }[] =
      [];
    vi.stubGlobal('fetch', async (url: string, init: { body: string }) => {
      requests.push({ url, body: JSON.parse(init.body) });
      return new Response(null, { status: 202 });
    });
    const driver = config.mail.driver;
    config.mail.driver = 'graph';
    setMailer(null);
    try {
      const { handout, delivery } = await createHandout(actor, c.id, 'EMAIL');
      expect(delivery).toMatchObject({ channel: 'EMAIL', status: 'PENDING', recipient: 'anna@example.ch' });
      const sent = await deliverHandout(delivery.id, { retryDelayMs: 1 });
      expect(sent).toMatchObject({ status: 'SENT', attempts: 1 });
      expect(requests).toHaveLength(1);
      expect(requests[0].url).toBe('https://graph.microsoft.com/v1.0/users/pain-therapy%40ayanta.ch/sendMail');
      expect(requests[0].body.message.toRecipients).toEqual([{ emailAddress: { address: 'anna@example.ch' } }]);
      expect(requests[0].body.message.attachments[0].name).toBe(`${handout.documentNumber}.pdf`);
      const [listed] = await handoutsOf(p.id);
      expect(listed.deliveries[0].status).toBe('SENT');
      expect((await historyOf(p.id)).some((e) => e.action === 'email.sent')).toBe(true);
    } finally {
      config.mail.driver = driver;
    }
  });

  it('retries three times, then fails and can be sent again', async () => {
    const { c } = await consultationWithProgram('Fehler', { emailConsent: true });
    let calls = 0;
    setMailer({
      send: async () => {
        calls++;
        throw new Error('Graph sendMail 503');
      },
    });
    const { handout, delivery } = await createHandout(actor, c.id, 'EMAIL');
    const failed = await deliverHandout(delivery.id, { retryDelayMs: 1 });
    expect(failed).toMatchObject({ status: 'FAILED', attempts: 3, lastError: 'Graph sendMail 503' });
    expect(calls).toBe(3);
    setMailer({ send: async () => {} });
    const again = await requestHandoutResend(actor, handout.id);
    expect((await deliverHandout(again.id, { retryDelayMs: 1 }))?.status).toBe('SENT');
  });

  it('stores a new version after a change and keeps the older one (Neue Version)', async () => {
    const { p, t, c } = await consultationWithProgram('Version', { emailConsent: false });
    const first = await createHandout(actor, c.id, 'PRINT');
    await updateConsultation(
      actor,
      c.id,
      consultationInput({
        exercises: [prescribed('2A')],
        home: [{ code: '2A', timesPerDay: 3, weekdays: 127, note: null }],
      }),
    );
    const second = await createHandout(actor, c.id, 'PRINT');
    expect([first.handout.version, second.handout.version]).toEqual([1, 2]);
    expect(second.handout.documentNumber).not.toBe(first.handout.documentNumber);
    const list = await handoutsOf(p.id);
    expect(list.map((h) => h.version)).toEqual([2, 1]);
    expect((list[0].prescriptions as { items: { code: string }[] }).items.map((x) => x.code)).toEqual(['2A']);
    expect((list[1].prescriptions as { items: { code: string }[] }).items).toHaveLength(3);
    // The document route serves both
    const { GET } = await import('@/app/documents/[id]/route');
    session.current = THERAPIST;
    const res = await GET(new Request('http://x'), { params: Promise.resolve({ id: first.handout.id }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(t.id).toBeTruthy();
  });

  it('renders in English for an English-speaking patient', async () => {
    const { c } = await consultationWithProgram('English', { emailConsent: false, language: 'en' });
    const { handout } = await createHandout(actor, c.id, 'PRINT');
    expect(handout.language).toBe('en');
    const { text } = await pdfText(await documentStore().get(handout.blobPath));
    for (const s of ['Your exercise programme', '2× per day every day', '1× per day Mo Tu We Th Fr', 'Spine exercise'])
      expect(text).toContain(s);
    expect(text).not.toContain('Übungsprogramm');
  });
});

describe('handout PDF', () => {
  const input = (over: Partial<HandoutPdfInput['items'][number]> = {}): HandoutPdfInput => ({
    language: 'de',
    documentNumber: 'PT-2026-00042',
    version: 1,
    createdAt: new Date('2026-10-27T10:00:00Z'),
    patient: { firstName: 'Anna', lastName: 'Müller', dateOfBirth: new Date('1980-03-05T00:00:00Z') },
    consultationAt: new Date('2026-10-27T09:00:00Z'),
    therapist: 'Christina Franz',
    items: [
      {
        code: '1C',
        name: 'Augen-Übung',
        variant: null,
        timesPerDay: 1,
        weekdays: 127,
        note: null,
        tools: [],
        aids: [],
        frmImage: null,
        epdImage: null,
        segments: null,
        seconds: 120,
        stretchMissing: true,
        timingMissing: false,
        mainImage: null,
        sheetImage: null,
        content: null,
        ...over,
      },
    ],
    total: { weekMinutes: 14, dayMinutes: 2, incomplete: ['1C'] },
  });

  it('still renders without media and says so (Bild nicht verfügbar)', async () => {
    const { pages, text } = await pdfText(await renderHandoutPdf(input()));
    expect(pages).toBe(2);
    for (const s of ['Bild nicht verfügbar', 'Blatt nicht verfügbar', 'Dehnung noch nicht festgelegt', '1× pro Tag'])
      expect(text).toContain(s);
  });

  it('prints the texts when only the sheet image is missing, and embeds the images when present', async () => {
    const withText = await pdfText(
      await renderHandoutPdf(
        input({ content: { rolling: 'Rollen', steps: [{ label: 'Schritt 1', text: 'Dehnen' }], variants: null } }),
      ),
    );
    expect(withText.text).toContain('Faszien-Rollmassage');
    expect(withText.text).toContain('Schritt 1: Dehnen');
    const withImages = await renderHandoutPdf(input({ mainImage: TINY_JPEG, sheetImage: placeholderPng(40, 56) }));
    expect((await pdfText(withImages)).text).not.toContain('nicht verfügbar');
  });
});
