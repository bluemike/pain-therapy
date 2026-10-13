import { describe, expect, it } from 'vitest';
import { ageOn, formatDate, formatDateTime, parseLocalInput, parseSwissDate, toLocalInput } from '@/lib/format';
import { consentStatusOf, displayValue } from '@/lib/patients';

describe('Swiss formats (localization)', () => {
  it('formats dates as DD.MM.YYYY', () => {
    expect(formatDate(new Date('1980-03-05T00:00:00Z'))).toBe('05.03.1980');
    expect(formatDateTime(new Date('2026-10-12T08:14:00Z'))).toBe('12.10.2026 10:14');
  });
  it('parses DD.MM.YYYY strictly', () => {
    expect(parseSwissDate('5.3.1980')?.toISOString()).toBe('1980-03-05T00:00:00.000Z');
    expect(parseSwissDate('29.02.2023')).toBeNull();
    expect(parseSwissDate('1980-03-05')).toBeNull();
  });
  it('computes the age', () => {
    expect(ageOn(new Date('1980-03-05T00:00:00Z'), new Date('2026-03-04T12:00:00Z'))).toBe(45);
    expect(ageOn(new Date('1980-03-05T00:00:00Z'), new Date('2026-03-05T12:00:00Z'))).toBe(46);
  });
});

describe('consent status', () => {
  it('is pending, signed or needs re-signing', () => {
    expect(consentStatusOf(undefined, 1)).toBe('pending');
    expect(consentStatusOf(1, 1)).toBe('signed');
    expect(consentStatusOf(1, 2)).toBe('resign');
  });
  it('shows history values readably', () => {
    expect(displayValue(new Date('1980-03-05T00:00:00Z'))).toBe('05.03.1980');
    expect(displayValue('')).toBeNull();
    expect(displayValue(true)).toBe('true');
  });
});

describe('hourInZurich', () => {
  it('returns the hour in Swiss time', async () => {
    const { hourInZurich } = await import('@/lib/format');
    expect(hourInZurich(new Date('2026-10-12T10:33:00Z'))).toBe(12);
    expect(hourInZurich(new Date('2026-01-12T23:10:00Z'))).toBe(0);
  });
});

/** dashboard: Begrüssung (task 4.1) */
describe('greeting', () => {
  it('depends on the time of day', async () => {
    const { greetingKey } = await import('@/lib/format');
    expect([7, 10, 11, 17, 18, 23].map(greetingKey)).toEqual([
      'greetingMorning',
      'greetingMorning',
      'greetingDay',
      'greetingDay',
      'greetingEvening',
      'greetingEvening',
    ]);
  });
});

describe('datetime-local in Swiss time (treatments, consultations)', () => {
  it('round-trips summer and winter time', () => {
    const summer = parseLocalInput('2026-10-13T09:15')!;
    expect(summer.toISOString()).toBe('2026-10-13T07:15:00.000Z');
    expect(toLocalInput(summer)).toBe('2026-10-13T09:15');
    const winter = parseLocalInput('2026-12-01T09:15')!;
    expect(winter.toISOString()).toBe('2026-12-01T08:15:00.000Z');
    expect(toLocalInput(winter)).toBe('2026-12-01T09:15');
  });

  it('rejects invalid values', () => {
    expect(parseLocalInput('')).toBeNull();
    expect(parseLocalInput('13.10.2026 09:15')).toBeNull();
    expect(parseLocalInput('2026-02-30T09:15')).toBeNull();
  });
});
