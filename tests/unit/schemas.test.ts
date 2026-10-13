import { describe, expect, it } from 'vitest';
import {
  consultationSchema,
  DIFFICULTIES,
  fieldErrors,
  PAIN_VALUES,
  patientSchema,
  ROLLING_SLOTS,
  SENSITIVITIES,
  treatmentSchema,
} from '@/lib/schemas';
import { toLocalInput } from '@/lib/format';
import scales from '../../prisma/catalog/scales.json';
import { EMPTY_PATIENT } from '@/lib/schemas';

const base = () =>
  Object.fromEntries(
    Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? (v ? 'on' : '') : v]),
  ) as Record<string, string>;

/** patient-records: Pflichtfelder, E-Mail-Format, "andere" mit Freitext (task 5.1) */
describe('patient schema', () => {
  it('requires first name, last name, date of birth and email', () => {
    const r = patientSchema.safeParse(base());
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!)).toMatchObject({
      firstName: 'required',
      lastName: 'required',
      dateOfBirth: 'required',
      email: 'required',
    });
  });

  it('accepts a minimal patient and parses the Swiss date', () => {
    const r = patientSchema.parse({
      ...base(),
      firstName: 'Anna',
      lastName: 'Müller',
      dateOfBirth: '05.03.1980',
      email: ' Anna.Mueller@Example.CH ',
    });
    expect(r.dateOfBirth.toISOString()).toBe('1980-03-05T00:00:00.000Z');
    expect(r.email).toBe('anna.mueller@example.ch');
    expect(r.preferredLanguage).toBe('de');
  });

  it('rejects impossible and future dates', () => {
    const e1 = fieldErrors(
      patientSchema.safeParse({ ...base(), firstName: 'A', lastName: 'B', dateOfBirth: '31.02.1980' }).error!,
    );
    expect(e1.dateOfBirth).toBe('date');
    const e2 = fieldErrors(
      patientSchema.safeParse({ ...base(), firstName: 'A', lastName: 'B', dateOfBirth: '01.01.2999' }).error!,
    );
    expect(e2.dateOfBirth).toBe('dateFuture');
  });

  it('rejects an invalid email address', () => {
    const r = patientSchema.safeParse({
      ...base(),
      firstName: 'A',
      lastName: 'B',
      dateOfBirth: '01.01.1990',
      email: 'anna@',
    });
    expect(fieldErrors(r.error!).email).toBe('email');
  });

  it('requires a description when "andere" is ticked', () => {
    const r = patientSchema.safeParse({
      ...base(),
      firstName: 'A',
      lastName: 'B',
      dateOfBirth: '01.01.1990',
      orthoOther: 'on',
    });
    expect(fieldErrors(r.error!).orthoOtherText).toBe('other');
    const ok = patientSchema.safeParse({
      ...base(),
      firstName: 'A',
      lastName: 'B',
      dateOfBirth: '01.01.1990',
      email: 'a.b@example.ch',
      orthoOther: 'on',
      orthoOtherText: 'Skoliose',
    });
    expect(ok.success).toBe(true);
  });
});

describe('patient schema, all errors at once', () => {
  it('reports a missing "andere" description together with other errors', () => {
    const r = patientSchema.safeParse({
      ...base(),
      firstName: 'Eva',
      lastName: 'Test',
      dateOfBirth: '31.02.1980',
      email: 'eva@',
      orthoOther: 'on',
    });
    expect(r.success).toBe(false);
    const e = fieldErrors(r.error!);
    expect(e).toMatchObject({ dateOfBirth: 'date', email: 'email', orthoOtherText: 'other' });
  });
});

/** treatments and consultations: Pflichtfelder, Zeitpunkt nicht in der Zukunft, Schmerz in 10er-Schritten (task 2.1) */
describe('treatment schema', () => {
  const valid = { startedAt: '2026-10-13T09:15', regionId: '6', diagnosis: 'Lumbalgie rechts', painStart: '60' };

  it('accepts a complete treatment', () => {
    const r = treatmentSchema.parse(valid);
    expect(r).toMatchObject({ regionId: 6, diagnosis: 'Lumbalgie rechts', painStart: 60 });
    expect(r.startedAt.toISOString()).toBe('2026-10-13T07:15:00.000Z');
  });

  it('requires date and time, area, diagnosis and pain level (Pflichtfeld fehlt)', () => {
    const r = treatmentSchema.safeParse({ startedAt: '', regionId: '', diagnosis: ' ', painStart: '' });
    expect(fieldErrors(r.error!)).toEqual({
      startedAt: 'required',
      regionId: 'required',
      diagnosis: 'required',
      painStart: 'required',
    });
  });

  it('rejects a time in the future and pain levels outside the 10 steps', () => {
    const future = new Date(Date.now() + 2 * 3600_000);
    const local = toLocalInput(future);
    const r = treatmentSchema.safeParse({ ...valid, startedAt: local, painStart: '65' });
    expect(fieldErrors(r.error!)).toEqual({ startedAt: 'dateTimeFuture', painStart: 'pain' });
    expect(fieldErrors(treatmentSchema.safeParse({ ...valid, painStart: '110' }).error!)).toEqual({
      painStart: 'pain',
    });
    expect(treatmentSchema.parse({ ...valid, painStart: '0' }).painStart).toBe(0);
  });
});

describe('consultation schema', () => {
  const sheet = {
    points: [
      { pointId: '2.11.1', left: false, right: true, sensitivity: 'STRONG' },
      { pointId: '2.1.1', left: false, right: false, sensitivity: null },
    ],
    exercises: [
      { code: '2D', prescribed: true, difficulty: 'HARD', variants: '' },
      { code: '2A', prescribed: false, difficulty: null, variants: '  ' },
    ],
    rolling: [
      { position: 1, area: 'Beckenkamm', toolCode: 'MiKu' },
      { position: 2, area: '', toolCode: null },
    ],
  };
  const base = { at: '2026-10-13T09:30', diagnosis: 'Lumbalgie', painBefore: '', painAfter: '', comparison: '' };

  it('drops empty rows of the form and keeps optional pain values empty (Leerer Bogen)', () => {
    const r = consultationSchema.parse({ ...base, sheet: JSON.stringify(sheet) });
    expect(r.painBefore).toBeNull();
    expect(r.painAfter).toBeNull();
    expect(r.sheet.points).toEqual([{ pointId: '2.11.1', left: false, right: true, sensitivity: 'STRONG' }]);
    expect(r.sheet.exercises).toEqual([{ code: '2D', prescribed: true, difficulty: 'HARD', variants: null }]);
    expect(r.sheet.rolling).toEqual([{ position: 1, area: 'Beckenkamm', toolCode: 'MiKu' }]);
    expect(consultationSchema.parse({ ...base, sheet: '' }).sheet).toEqual({ points: [], exercises: [], rolling: [] });
  });

  it('accepts pain before and after in steps of 10 and rejects other values', () => {
    const r = consultationSchema.parse({ ...base, painBefore: '60', painAfter: '30', sheet: '' });
    expect([r.painBefore, r.painAfter]).toEqual([60, 30]);
    const bad = consultationSchema.safeParse({ ...base, painBefore: '15', sheet: '' });
    expect(fieldErrors(bad.error!)).toEqual({ painBefore: 'pain' });
  });

  it('rejects unknown scale values, seventh rolling rows and broken JSON', () => {
    const wrong = { ...sheet, points: [{ pointId: '1.1.1', left: true, right: false, sensitivity: 'HUGE' }] };
    expect(consultationSchema.safeParse({ ...base, sheet: JSON.stringify(wrong) }).success).toBe(false);
    const seven = { ...sheet, rolling: [{ position: 7, area: 'x', toolCode: null }] };
    expect(consultationSchema.safeParse({ ...base, sheet: JSON.stringify(seven) }).success).toBe(false);
    expect(fieldErrors(consultationSchema.safeParse({ ...base, sheet: '{' }).error!)).toEqual({ sheet: 'sheet' });
  });

  it('matches the scales of the paper form in prisma/catalog/scales.json', () => {
    expect([...PAIN_VALUES]).toEqual(scales.painPercent);
    expect([...SENSITIVITIES]).toEqual(scales.sensitivity.map((s) => s.code));
    expect([...DIFFICULTIES]).toEqual(scales.difficulty.map((s) => s.code));
    expect(ROLLING_SLOTS).toBe(scales.rollingSlots);
  });
});
