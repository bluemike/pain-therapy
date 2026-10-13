import { describe, expect, it } from 'vitest';
import { fieldErrors, patientSchema } from '@/lib/schemas';
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
