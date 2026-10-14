import { describe, expect, it } from 'vitest';
import { afterFailure, linkExpiry, linkState, sameDateOfBirth, sessionLinkOk, type LinkFields } from '../src/access';
import { programActive } from '../src/program';
import { hashIp, hashToken, isTokenShaped, linkUrl, maskTokens, newToken } from '../src/tokens';
import { addMonths, dayKey, daysBetween, fromZurichInputs, weekKey, zurichInputs } from '../src/time';
import { editable, logEntryFormSchema, performedAtProblem, validRating } from '../src/log-entry';

/** patient-access and exercise-log: token, validity, locks, entries and the 24-hour rule (iteration 4, task 8.1) */

const now = new Date('2026-10-14T10:00:00Z');
const valid: LinkFields = {
  expiresAt: linkExpiry(now),
  revokedAt: null,
  replacedAt: null,
  blockedAt: null,
  lockedUntil: null,
};
const ok = { patientActive: true, programActive: true };

describe('token and hash', () => {
  it('issues 256-bit tokens and stores only their SHA-256', () => {
    const a = newToken();
    const b = newToken();
    expect(a).not.toBe(b);
    expect(Buffer.from(a, 'base64url')).toHaveLength(32);
    expect(isTokenShaped(a)).toBe(true);
    expect(isTokenShaped('abc')).toBe(false);
    expect(isTokenShaped(`${a.slice(0, 42)}/`)).toBe(false);
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(a)).not.toContain(a);
    expect(hashToken(a)).toBe(hashToken(a));
  });

  it('hashes IP addresses with a secret and masks tokens in log lines', () => {
    expect(hashIp('203.0.113.7', 's1')).not.toBe(hashIp('203.0.113.7', 's2'));
    expect(hashIp('203.0.113.7', 's1')).toBe(hashIp(' 203.0.113.7', 's1'));
    const url = linkUrl('https://patient.pain-therapy.ayanta.ch/', 'Tok_en-123');
    expect(url).toBe('https://patient.pain-therapy.ayanta.ch/l/Tok_en-123');
    expect(maskTokens(`GET ${url} 200`)).toBe('GET https://patient.pain-therapy.ayanta.ch/l/… 200');
  });
});

describe('validity of a link', () => {
  it('is valid for 6 months while patient and home program are active', () => {
    expect(linkExpiry(new Date('2026-10-14T08:00:00Z')).toISOString()).toBe('2027-04-14T08:00:00.000Z');
    expect(addMonths(new Date('2026-08-31T08:00:00Z'), 6).toISOString()).toBe('2027-02-28T08:00:00.000Z');
    expect(linkState(valid, ok, now)).toBe('valid');
    expect(linkState(valid, ok, new Date(valid.expiresAt.getTime() + 1))).toBe('expired');
    expect(linkState(valid, { patientActive: false, programActive: true }, now)).toBe('expired');
    expect(linkState(valid, { patientActive: true, programActive: false }, now)).toBe('expired');
  });

  it('distinguishes revoked, blocked, replaced and temporarily locked links', () => {
    expect(linkState({ ...valid, revokedAt: now }, ok, now)).toBe('revoked');
    expect(linkState({ ...valid, blockedAt: now }, ok, now)).toBe('blocked');
    expect(linkState({ ...valid, replacedAt: now }, ok, now)).toBe('replaced');
    const locked = { ...valid, lockedUntil: new Date(now.getTime() + 60_000) };
    expect(linkState(locked, ok, now)).toBe('locked');
    expect(linkState(locked, ok, new Date(now.getTime() + 61_000))).toBe('valid');
  });

  it('keeps sessions of a replaced link, ends them when revoked, blocked or expired', () => {
    expect(sessionLinkOk({ ...valid, replacedAt: now }, ok, now)).toBe(true);
    expect(sessionLinkOk({ ...valid, revokedAt: now }, ok, now)).toBe(false);
    expect(sessionLinkOk({ ...valid, blockedAt: now }, ok, now)).toBe(false);
    expect(sessionLinkOk(valid, { patientActive: true, programActive: false }, now)).toBe(false);
  });

  it('home program active for 12 weeks after the consultation', () => {
    expect(programActive(new Date(now.getTime() - 84 * 86400_000), now)).toBe(true);
    expect(programActive(new Date(now.getTime() - 84 * 86400_000 - 1), now)).toBe(false);
  });
});

describe('locks after failed confirmations', () => {
  it('locks for 15 minutes after 5 failures and blocks after 10', () => {
    for (const n of [1, 2, 3, 4, 6, 7, 8, 9])
      expect(afterFailure(n, now)).toEqual({ lockedUntil: null, blocked: false });
    expect(afterFailure(5, now)).toEqual({ lockedUntil: new Date(now.getTime() + 15 * 60_000), blocked: false });
    expect(afterFailure(10, now)).toEqual({ lockedUntil: null, blocked: true });
  });

  it('compares the whole date of birth', () => {
    const dob = new Date(Date.UTC(1980, 2, 5));
    expect(sameDateOfBirth(dob, 5, 3, 1980)).toBe(true);
    expect(sameDateOfBirth(dob, 3, 5, 1980)).toBe(false);
    expect(sameDateOfBirth(dob, 5, 3, 1981)).toBe(false);
  });
});

describe('entries', () => {
  const form = { code: '2A', done: 'yes', rating: '7', date: '2026-10-13', time: '20:30', note: '' };

  it('reads date and time as Swiss time (Nachtragen)', () => {
    const parsed = logEntryFormSchema.parse(form);
    expect(parsed).toEqual({
      code: '2A',
      done: true,
      rating: 7,
      note: null,
      performedAt: new Date('2026-10-13T18:30:00Z'),
    });
    expect(zurichInputs(parsed.performedAt)).toEqual({ date: '2026-10-13', time: '20:30' });
    expect(fromZurichInputs('2026-12-01', '20:30')!.toISOString()).toBe('2026-12-01T19:30:00.000Z');
    expect(fromZurichInputs('2026-02-30', '20:30')).toBeNull();
  });

  it('accepts ratings 1 to 10 only, and only when done (Bewertung ausserhalb der Skala)', () => {
    const issue = (x: object) => logEntryFormSchema.safeParse({ ...form, ...x }).error?.issues[0]?.message;
    expect(issue({ rating: '11' })).toBe('ratingRange');
    expect(issue({ rating: '0' })).toBe('ratingRange');
    expect(issue({ rating: '6.5' })).toBe('ratingRange');
    expect(issue({ rating: '' })).toBe('ratingRequired');
    expect(issue({ done: 'no', rating: '4' })).toBe('ratingWithoutDone');
    expect(logEntryFormSchema.parse({ ...form, done: 'no', rating: '' })).toMatchObject({ done: false, rating: null });
    expect(issue({ note: 'x'.repeat(501) })).toBe('noteTooLong');
    expect(logEntryFormSchema.parse({ ...form, note: ` ${'x'.repeat(500)} ` }).note).toHaveLength(500);
    expect(issue({ date: '13.10.2026' })).toBe('dateInvalid');
    expect(validRating(true, 10)).toBe(true);
    expect(validRating(false, 3)).toBe(false);
    expect(validRating(true, 11)).toBe(false);
    expect(validRating(false, null)).toBe(true);
  });

  it('rejects times in the future and before the consultation (Zeit in der Zukunft)', () => {
    const consultation = new Date('2026-10-07T08:00:00Z');
    expect(performedAtProblem(new Date(now.getTime() + 60_000), consultation, now)).toBe('future');
    expect(performedAtProblem(new Date('2026-10-07T07:59:00Z'), consultation, now)).toBe('beforeConsultation');
    expect(performedAtProblem(new Date('2026-10-13T18:30:00Z'), consultation, now)).toBeNull();
  });

  it('can be corrected or deleted for 24 hours after recording', () => {
    expect(editable(new Date(now.getTime() - 2 * 3600_000), now)).toBe(true);
    expect(editable(new Date(now.getTime() - 24 * 3600_000), now)).toBe(false);
  });

  it('counts days and weeks in Swiss time', () => {
    expect(dayKey(new Date('2026-10-13T22:30:00Z'))).toBe('2026-10-14');
    expect(daysBetween(new Date('2026-10-12T21:59:00Z'), new Date('2026-10-13T22:01:00Z'))).toBe(2);
    expect(weekKey(new Date('2026-10-18T21:00:00Z'))).toBe('2026-10-12');
    expect(weekKey(new Date('2026-10-18T22:30:00Z'))).toBe('2026-10-19');
  });
});
