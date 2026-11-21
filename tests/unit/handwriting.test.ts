import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@/lib/db';
import { createPatient, historyOf, updatePatient } from '@/lib/patients';
import { currentVersionNumber } from '@/lib/consent-texts';
import { consultationSchema, EMPTY_PATIENT, patientSchema, treatmentSchema } from '@/lib/schemas';
import { createConsultation, createTreatment, updateConsultation, updateTreatment } from '@/lib/treatments';
import {
  hasInkAfter,
  inkChangeFrom,
  inputModeOf,
  recognize,
  RecognitionError,
  resolveInk,
  setInputMode,
} from '@/lib/handwriting';
import { config } from '@/lib/config';
import { INK_LINE_HEIGHT, inkFromJson } from '@pain-therapy/shared/ink';
import type { Actor } from '@/lib/session';
import { syncCatalog } from '../../prisma/catalog/sync.mjs';
import { resetDatabase } from './db-reset';

const actor: Actor = { id: 'u-ink', name: 'Chrissie Franz', email: 'c@example.ch', roles: ['THERAPIST'] };
const strokes = (y = 20) =>
  JSON.stringify({
    h: 4 * INK_LINE_HEIGHT,
    strokes: [
      [
        [10, y, 0.5],
        [80, y + 10, 0.5],
      ],
    ],
  });
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

const patientInput = (over: Record<string, string> = {}) =>
  patientSchema.parse({
    ...Object.fromEntries(Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? '' : v])),
    firstName: 'Anna',
    lastName: 'Ink',
    dateOfBirth: '05.03.1980',
    email: 'anna@example.ch',
    ...over,
  });

async function signedPatient() {
  const p = await createPatient(actor, patientInput());
  const version = await currentVersionNumber();
  const text = await db.consentTextVersion.findFirstOrThrow({ where: { version, language: 'de' } });
  const s = await db.signatureSession.create({
    data: { patientId: p.id, textVersionId: text.id, language: 'de', status: 'SIGNED', startedBy: actor.name },
  });
  await db.signedDocument.create({
    data: {
      documentNumber: 'PT-TEST-INK',
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

beforeAll(async () => {
  await resetDatabase();
  await syncCatalog(db);
});
afterAll(resetDatabase);

describe('note-input (iteration 10)', () => {
  it('reads the hidden ink field: keep, clear or new strokes', () => {
    expect(inkChangeFrom(form({}), 'diagnosis')).toEqual({ kind: 'keep' });
    expect(inkChangeFrom(form({ diagnosisInk: 'keep' }), 'diagnosis')).toEqual({ kind: 'keep' });
    expect(inkChangeFrom(form({ diagnosisInk: '' }), 'diagnosis')).toEqual({ kind: 'clear' });
    expect(inkChangeFrom(form({ diagnosisInk: strokes() }), 'diagnosis').kind).toBe('set');
    expect(() => inkChangeFrom(form({ diagnosisInk: '{' }), 'diagnosis')).toThrow('inkInvalid');
  });

  it('text replaces an image; without text the image stays, changes or goes', () => {
    const stored = inkFromJson(strokes())!;
    const next = inkFromJson(strokes(40))!;
    expect(resolveInk(stored, { kind: 'keep' }, 'Text')).toBeNull();
    expect(resolveInk(stored, { kind: 'keep' }, '')).toEqual(stored);
    expect(resolveInk(stored, { kind: 'set', ink: next }, null)).toEqual(next);
    expect(resolveInk(stored, { kind: 'clear' }, null)).toBeNull();
    expect(hasInkAfter(stored, { kind: 'keep' })).toBe(true);
    expect(hasInkAfter(null, { kind: 'keep' })).toBe(false);
  });

  it('a required diagnosis counts as filled with handwriting only', () => {
    const empty = { startedAt: '2026-10-01T09:15', regionId: '6', diagnosis: '', painStart: '60' };
    expect(treatmentSchema.safeParse(empty).success).toBe(false);
    expect(treatmentSchema.extend({ diagnosis: consultationSchema.shape.comparison }).safeParse(empty).success).toBe(
      true,
    );
  });

  it('stores the input mode per user (default keyboard)', async () => {
    await db.user.create({ data: { id: actor.id, email: actor.email, name: actor.name } });
    expect(await inputModeOf(actor.id)).toBe('KEYBOARD');
    await setInputMode(actor, 'HANDWRITING_IMAGE');
    expect(await inputModeOf(actor.id)).toBe('HANDWRITING_IMAGE');
  });
});

describe('handwritten-notes (iteration 10)', () => {
  it('saves a treatment diagnosis as image, takes it into a new session and replaces it by text', async () => {
    const p = await signedPatient();
    const ink = inkFromJson(strokes())!;
    const t = await createTreatment(actor, p.id, {
      ...treatmentSchema.parse({ startedAt: '2026-10-01T09:15', regionId: '6', diagnosis: 'x', painStart: '60' }),
      diagnosis: '',
      diagnosisInk: { kind: 'set', ink },
    });
    const stored = await db.treatment.findUniqueOrThrow({ where: { id: t.id } });
    expect(stored.diagnosis).toBe('');
    expect(stored.diagnosisInk).toMatchObject({ v: 1, svg: ink.svg });

    const input = consultationSchema.parse({
      at: '2026-10-02T09:30',
      diagnosis: 'x',
      painBefore: '',
      painAfter: '',
      comparison: '',
      sheet: '',
    });
    const c = await createConsultation(actor, t.id, {
      ...input,
      diagnosis: '',
      diagnosisInk: { kind: 'keep' },
      comparisonInk: { kind: 'set', ink: inkFromJson(strokes(30))! },
    });
    const session = await db.consultation.findUniqueOrThrow({ where: { id: c.id } });
    expect(session.diagnosisInk).toMatchObject({ svg: ink.svg });
    expect(session.comparisonInk).toMatchObject({ v: 1 });

    await updateConsultation(actor, c.id, {
      ...input,
      comparison: 'Nacht ruhiger',
      diagnosis: '',
      diagnosisInk: { kind: 'keep' },
    });
    const after = await db.consultation.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.comparison).toBe('Nacht ruhiger');
    expect(after.comparisonInk).toBeNull();
    expect(after.diagnosisInk).toMatchObject({ svg: ink.svg });

    await updateTreatment(actor, t.id, {
      startedAt: stored.startedAt,
      regionId: 6,
      side: stored.side,
      painStart: 60,
      diagnosis: 'LWS re',
      diagnosisInk: { kind: 'keep' },
    } as Parameters<typeof updateTreatment>[2]);
    const changed = await db.treatment.findUniqueOrThrow({ where: { id: t.id } });
    expect([changed.diagnosis, changed.diagnosisInk]).toEqual(['LWS re', null]);
    // The history records "[Handschrift]", never the strokes
    const history = await db.auditEvent.findMany({ where: { action: 'treatment.updated', field: 'diagnosis' } });
    expect(history.map((h) => [h.before, h.after])).toEqual([['[Handschrift]', 'LWS re']]);
  });

  it('keeps «Weitere Diagnosen» as image on the anamnesis', async () => {
    const p = await createPatient(actor, patientInput({ lastName: 'Anamnese' }), {
      kind: 'set',
      ink: inkFromJson(strokes())!,
    });
    const a = await db.anamnesis.findUniqueOrThrow({ where: { patientId: p.id } });
    expect(a.furtherDiagnosesInk).toMatchObject({ v: 1 });
    await updatePatient(actor, p.id, patientInput({ lastName: 'Anamnese', furtherDiagnoses: 'Migräne' }), {
      kind: 'keep',
    });
    const b = await db.anamnesis.findUniqueOrThrow({ where: { patientId: p.id } });
    expect([b.furtherDiagnoses, b.furtherDiagnosesInk]).toEqual(['Migräne', null]);
    const h = (await historyOf(p.id)).find((e) => e.field === 'furtherDiagnoses');
    expect([h?.before, h?.after]).toEqual(['[Handschrift]', 'Migräne']);
  });
});

describe('handwriting-recognition (iteration 10)', () => {
  it('recognises with the stub, logs field and length only, and limits calls per hour', async () => {
    expect(config.handwriting.stub).toBe(true);
    const text = await recognize(actor, 'consultation.comparison', PNG, 'de');
    expect(text).toBe('Nacht ruhiger, morgens noch steif');
    const ev = await db.auditEvent.findFirstOrThrow({ where: { action: 'note.recognized' } });
    expect([ev.field, ev.before, ev.after, ev.details]).toEqual([
      'consultation.comparison',
      null,
      null,
      { characters: text.length },
    ]);
    await expect(recognize(actor, 'treatment.diagnosis', new Uint8Array([1, 2, 3]), 'de')).rejects.toThrow('invalid');
    const big = new Uint8Array(config.handwriting.maxImageBytes + 1);
    big.set(PNG);
    await expect(recognize(actor, 'treatment.diagnosis', big, 'de')).rejects.toThrow('tooLarge');
    await db.auditEvent.createMany({
      data: Array.from({ length: config.handwriting.perUserPerHour }, () => ({
        userId: actor.id,
        userName: actor.name,
        action: 'note.recognized',
      })),
    });
    await expect(recognize(actor, 'treatment.diagnosis', PNG, 'de')).rejects.toBeInstanceOf(RecognitionError);
  });
});
