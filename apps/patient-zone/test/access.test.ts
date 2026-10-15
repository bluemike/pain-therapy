import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashToken, newToken } from '@pain-therapy/shared/tokens';
import { confirmable, confirmLink, endSession, lookupLink, resolveSession, touchSession } from '@/lib/access';
import { installLogMasking } from '@/lib/log';
import { admin, ago, consultation, DOB, link, now, patient, resetDatabase, setup } from './fixtures';

/**
 * patient-access: Bestätigung, Sperren, neutrale Meldungen und Gerätesitzung, run with the role patient_zone
 * (iteration 4, tasks 3.5, 3.6, 8.1 and 8.2).
 */

const IP = '203.0.113.7';
const later = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
const confirm = (token: string, dob = DOB, at = now, ip = IP) => confirmLink({ token, ...dob, ip }, at);
const WRONG = { day: '06', month: '03', year: '1980' };

beforeEach(resetDatabase);
afterAll(() => admin.$disconnect());

describe('confirmation with the date of birth', () => {
  it('signs the device in with the right date (Richtiges Geburtsdatum) and stores no token', async () => {
    const { token, link: l, patient: p } = await setup();
    const r = await confirm(token);
    expect(r.ok).toBe(true);
    const sessionId = r.ok ? r.sessionId : '';
    const session = await resolveSession(sessionId, now);
    expect(session?.patient.firstName).toBe('Anna');
    expect(session?.program?.prescriptions.map((x) => x.exerciseCode).sort()).toEqual(['1F', '2A', '2D']);

    // Kein Token in der Datenbank: neither the link token nor the session id appear anywhere
    const dump = JSON.stringify(
      await Promise.all([
        admin.patientAccessLink.findMany(),
        admin.patientZoneSession.findMany(),
        admin.patientZoneAttempt.findMany(),
        admin.auditEvent.findMany(),
      ]),
    );
    expect(dump).toContain(hashToken(token));
    expect(dump).not.toContain(token);
    expect(dump).not.toContain(sessionId);
    expect(dump).not.toContain(IP);

    const confirmed = await admin.auditEvent.findFirstOrThrow({ where: { action: 'accessLink.confirmed' } });
    expect(confirmed).toMatchObject({ userId: 'patient-zone', userName: 'Patienten-Zone', patientId: p.id });
    expect(confirmed.details).toEqual({ linkId: l.id });
  });

  it('says "Die Angabe stimmt nicht." for a wrong date and reveals nothing (Falsches Geburtsdatum)', async () => {
    const { token } = await setup();
    expect(await confirm(token, WRONG)).toEqual({ ok: false, error: 'wrong' });
    expect(await confirm(token, { day: '', month: '03', year: '80' })).toEqual({ ok: false, error: 'format' });
  });

  it('locks for 15 minutes after 5 failures, also for the right date (Fünf Fehlversuche)', async () => {
    const { token, link: l } = await setup();
    for (let i = 1; i <= 4; i++) expect((await confirm(token, WRONG)).ok).toBe(false);
    expect(await confirm(token, WRONG)).toEqual({ ok: false, error: 'locked' });
    expect(await confirm(token, DOB, later(5))).toEqual({ ok: false, error: 'locked' });
    expect((await lookupLink(token, later(5)))?.state).toBe('locked');
    expect((await admin.patientAccessLink.findUniqueOrThrow({ where: { id: l.id } })).lockedUntil).toEqual(later(15));
    expect(await admin.auditEvent.count({ where: { action: 'accessLink.locked' } })).toBe(1);
  });

  it('blocks after 10 failures until a new link is issued (Zehn Fehlversuche)', async () => {
    const { token, link: l } = await setup();
    for (let i = 0; i < 5; i++) await confirm(token, WRONG);
    const after = later(16);
    for (let i = 0; i < 4; i++) expect(await confirm(token, WRONG, after)).toEqual({ ok: false, error: 'wrong' });
    expect(await confirm(token, WRONG, after)).toEqual({ ok: false, error: 'locked' });
    expect((await admin.patientAccessLink.findUniqueOrThrow({ where: { id: l.id } })).blockedAt).toEqual(after);
    expect(await confirm(token, DOB, later(60))).toEqual({ ok: false, error: 'invalid' });
    expect(confirmable((await lookupLink(token, later(60)))?.state)).toBe(false);
    expect(await admin.auditEvent.count({ where: { action: 'accessLink.blocked' } })).toBe(1);
  });

  it('resets the counter after a success', async () => {
    const { token, link: l } = await setup();
    for (let i = 0; i < 4; i++) await confirm(token, WRONG);
    expect((await confirm(token)).ok).toBe(true);
    expect((await admin.patientAccessLink.findUniqueOrThrow({ where: { id: l.id } })).failedAttempts).toBe(0);
  });

  it('limits an IP address to 20 attempts per hour over all links (Viele Versuche von einer Adresse)', async () => {
    const tokens = await Promise.all(Array.from({ length: 4 }, async () => (await setup()).token));
    for (let i = 0; i < 20; i++) await confirm(tokens[i % 3], WRONG, new Date(now.getTime() + i * 1000));
    const next = new Date(now.getTime() + 30_000);
    expect(await confirm(tokens[3], DOB, next)).toEqual({ ok: false, error: 'tooMany' });
    expect(await confirm(newToken(), DOB, next)).toEqual({ ok: false, error: 'tooMany' });
    expect((await confirm(tokens[3], DOB, next, '198.51.100.1')).ok).toBe(true);
    expect((await confirm(tokens[3], DOB, later(61))).ok).toBe(true);
  });
});

describe('neutral messages (Neutrale Fehlermeldungen)', () => {
  it('treats unknown, expired, replaced, revoked and blocked links and an ended program the same way', async () => {
    const cases: [string, string][] = [];
    cases.push(['unknown', newToken()]);
    cases.push(['malformed', 'abc']);
    const { patient: p } = await setup();
    cases.push(['expired', (await link(p.id, ago(200))).token]);
    cases.push(['replaced', (await link(p.id, ago(1), { replacedAt: ago(0, 1) })).token]);
    cases.push(['revoked', (await link(p.id, ago(1), { revokedAt: ago(0, 1) })).token]);
    cases.push(['blocked', (await link(p.id, ago(1), { blockedAt: ago(0, 1) })).token]);
    // Kein aktives Heimprogramm: last consultation with prescriptions more than 12 weeks ago
    const old = await patient();
    await consultation(old.id, ago(85), [['2A', 'DAILY_1']]);
    cases.push(['no program', (await link(old.id, ago(1))).token]);
    const inactive = await patient({ status: 'INACTIVE' });
    await consultation(inactive.id, ago(5), [['2A', 'DAILY_1']]);
    cases.push(['inactive patient', (await link(inactive.id)).token]);
    for (const [what, token] of cases) {
      expect(confirmable((await lookupLink(token, now))?.state), what).toBe(false);
      expect(
        await confirm(token, DOB, now, `192.0.2.${cases.indexOf(cases.find((c) => c[1] === token)!)}`),
        what,
      ).toEqual({
        ok: false,
        error: 'invalid',
      });
    }
  });
});

describe('device session (Gerätesitzung)', () => {
  async function signedIn() {
    const s = await setup();
    const r = await confirm(s.token);
    if (!r.ok) throw new Error('not signed in');
    return { ...s, sessionId: r.sessionId };
  }

  it('stays signed in for 30 days (Wiederkehren), not longer', async () => {
    const { sessionId } = await signedIn();
    const tenDays = new Date(now.getTime() + 10 * 86400_000);
    const s = await resolveSession(sessionId, tenDays);
    expect(s).not.toBeNull();
    await touchSession(s!, tenDays);
    expect(await resolveSession(sessionId, new Date(now.getTime() + 30 * 86400_000))).toBeNull();
    expect(await resolveSession(newToken(), now)).toBeNull();
    expect(await resolveSession(undefined, now)).toBeNull();
  });

  it('ends with "Abmelden"; the link then asks for the date again', async () => {
    const { sessionId, token } = await signedIn();
    await endSession(sessionId, later(1));
    expect(await resolveSession(sessionId, later(2))).toBeNull();
    expect(await admin.auditEvent.count({ where: { action: 'zone.signedOut' } })).toBe(1);
    expect((await lookupLink(token, later(2)))?.state).toBe('valid');
  });

  it('ends when the link is revoked, but not when it is replaced by a new one', async () => {
    const { sessionId, link: l, patient: p } = await signedIn();
    await admin.patientAccessLink.update({ where: { id: l.id }, data: { replacedAt: later(1) } });
    await link(p.id, later(1));
    expect(await resolveSession(sessionId, later(2))).not.toBeNull();
    await admin.patientAccessLink.update({ where: { id: l.id }, data: { revokedAt: later(3) } });
    expect(await resolveSession(sessionId, later(4))).toBeNull();
    expect((await admin.patientZoneSession.findFirstOrThrow()).endedAt).toEqual(later(4));
  });

  it('ends when the home program is no longer active', async () => {
    const { sessionId } = await signedIn();
    expect(await resolveSession(sessionId, new Date(now.getTime() + 75 * 86400_000))).toBeNull();
  });
});

describe('logs', () => {
  it('masks tokens of access links (Token in Logs maskiert)', () => {
    const token = newToken();
    const lines: unknown[][] = [];
    const fake = {
      log: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      error: (...a: unknown[]) => lines.push(a),
    };
    installLogMasking(fake);
    fake.error(`GET /l/${token} failed`, new Error(`fetch https://patient.example/l/${token}`), { url: `/l/${token}` });
    expect(JSON.stringify(lines.map((l) => l.map(String)))).not.toContain(token);
    expect(String(lines[0][0])).toBe('GET /l/… failed');
  });
});
