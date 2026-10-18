import { describe, expect, it } from 'vitest';
import {
  consultationSchema,
  DIFFICULTIES,
  fieldErrors,
  PAIN_VALUES,
  patientSchema,
  SENSITIVITIES,
  sheetErrors,
  EMPTY_SHEET,
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
    expect(r).toMatchObject({ regionId: 6, side: 'UNSPECIFIED', diagnosis: 'Lumbalgie rechts', painStart: 60 });
    expect(treatmentSchema.parse({ ...valid, side: 'LEFT' }).side).toBe('LEFT');
    expect(treatmentSchema.safeParse({ ...valid, side: 'BOTH' }).success).toBe(false);
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
      { code: '2D', prescribed: true, difficulty: 'HARD', variant: 2 },
      { code: '2A', prescribed: false, difficulty: null, variant: null },
    ],
  };
  const base = { at: '2026-10-13T09:30', diagnosis: 'Lumbalgie', painBefore: '', painAfter: '', comparison: '' };
  const parse = (s: object) => consultationSchema.safeParse({ ...base, sheet: JSON.stringify(s) });

  it('drops empty rows of the form and keeps optional pain values empty (Leerer Bogen)', () => {
    const r = consultationSchema.parse({ ...base, sheet: JSON.stringify(sheet) });
    expect(r.painBefore).toBeNull();
    expect(r.painAfter).toBeNull();
    expect(r.sheet.points).toEqual([{ pointId: '2.11.1', left: false, right: true, sensitivity: 'STRONG' }]);
    expect(r.sheet.exercises).toEqual([{ code: '2D', prescribed: true, difficulty: 'HARD', variant: 2 }]);
    expect(consultationSchema.parse({ ...base, sheet: '' }).sheet).toEqual(EMPTY_SHEET);
  });

  it('keeps one home row per prescribed exercise, 1× per day on all weekdays when none was sent (home-schedule)', () => {
    const r = consultationSchema.parse({ ...base, sheet: JSON.stringify(sheet) });
    expect(r.sheet.home).toEqual([{ code: '2D', timesPerDay: 1, weekdays: 127, note: null, variant: 2 }]);
    const withHome = {
      ...sheet,
      exercises: [...sheet.exercises.slice(0, 1), { code: '2A', prescribed: false, difficulty: 'EASY', variant: null }],
      home: [
        { code: '2D', timesPerDay: 2, weekdays: 31, note: ' abends ' },
        // Not prescribed (any more): dropped
        { code: '2A', timesPerDay: 1, weekdays: 127, note: null },
      ],
    };
    expect(parse(withHome).data!.sheet.home).toEqual([
      { code: '2D', timesPerDay: 2, weekdays: 31, note: 'abends', variant: 2 },
    ]);
  });

  it('requires "Übung fällt" for every prescribed exercise (session-form)', () => {
    const r = parse({ ...sheet, exercises: [{ code: '1A', prescribed: true, difficulty: null, variant: null }] });
    expect(r.success).toBe(false);
    expect(sheetErrors(r.error!)).toEqual({ 'exercises:1A': 'difficultyRequired' });
  });

  it('requires a sensitivity for a chosen side and a side for a sensitivity (iteration 9)', () => {
    const point = (x: object) => parse({ ...sheet, points: [{ pointId: '2.11.1', left: false, right: false, ...x }] });
    expect(sheetErrors(point({ right: true, sensitivity: null }).error!)).toEqual({
      'points:2.11.1': 'sensitivityRequired',
    });
    expect(sheetErrors(point({ sensitivity: 'LOW' }).error!)).toEqual({ 'points:2.11.1': 'sideRequired' });
    expect(point({ left: true, right: true, sensitivity: 'MEDIUM' }).success).toBe(true);
  });

  it('requires at least one weekday and 1× to 3× per day (Tage abwählen)', () => {
    const home = (h: object) =>
      parse({ ...sheet, home: [{ code: '2D', timesPerDay: 1, weekdays: 127, note: null, ...h }] });
    expect(home({ timesPerDay: 3, weekdays: 64 }).success).toBe(true);
    expect(sheetErrors(home({ weekdays: 0 }).error!)).toEqual({ 'home:2D': 'weekdayRequired' });
    expect(home({ timesPerDay: 4 }).success).toBe(false);
    expect(home({ timesPerDay: 0 }).success).toBe(false);
    expect(home({ weekdays: 128 }).success).toBe(false);
  });

  it('accepts pain before and after in steps of 10 and rejects other values', () => {
    const r = consultationSchema.parse({ ...base, painBefore: '60', painAfter: '30', sheet: '' });
    expect([r.painBefore, r.painAfter]).toEqual([60, 30]);
    const bad = consultationSchema.safeParse({ ...base, painBefore: '15', sheet: '' });
    expect(fieldErrors(bad.error!)).toEqual({ painBefore: 'pain' });
  });

  it('rejects unknown scale values and broken JSON', () => {
    const wrong = { ...sheet, points: [{ pointId: '1.1.1', left: true, right: false, sensitivity: 'HUGE' }] };
    expect(parse(wrong).success).toBe(false);
    expect(fieldErrors(consultationSchema.safeParse({ ...base, sheet: '{' }).error!)).toEqual({ sheet: 'sheet' });
  });

  it('matches the scales of the paper form in prisma/catalog/scales.json', () => {
    expect([...PAIN_VALUES]).toEqual(scales.painPercent);
    expect([...SENSITIVITIES]).toEqual(scales.sensitivity.map((s) => s.code));
    expect([...DIFFICULTIES]).toEqual(scales.difficulty.map((s) => s.code));
  });
});
