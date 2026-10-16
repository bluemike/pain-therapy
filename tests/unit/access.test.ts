import { describe, expect, it } from 'vitest';
import { can, checkClaims } from '@/lib/access';

const AYANTA = 'tenant-ayanta';

/** access-control: Nur Ayanta-Benutzer, Rollen aus Entra ID (task 2.2, 2.3) */
describe('Entra ID claims', () => {
  it('accepts an Ayanta member with an app role', () => {
    expect(checkClaims({ tid: AYANTA, roles: ['Therapist'] }, AYANTA)).toEqual({ ok: true, roles: ['THERAPIST'] });
    expect(checkClaims({ tid: AYANTA, roles: ['Admin', 'Therapist'], acct: 0 }, AYANTA)).toEqual({
      ok: true,
      roles: ['ADMIN', 'THERAPIST'],
    });
  });
  it('rejects another tenant and personal accounts', () => {
    expect(checkClaims({ tid: 'other', roles: ['Therapist'] }, AYANTA)).toEqual({ ok: false, reason: 'foreign' });
    expect(checkClaims({ tid: '9188040d-6c67-4c5b-b112-36a304b66dad', roles: ['Therapist'] }, AYANTA).ok).toBe(false);
  });
  it('rejects guests', () => {
    expect(checkClaims({ tid: AYANTA, acct: 1, roles: ['Therapist'] }, AYANTA)).toEqual({
      ok: false,
      reason: 'foreign',
    });
    expect(checkClaims({ tid: AYANTA, idp: 'https://sts.windows.net/other/', roles: ['Therapist'] }, AYANTA).ok).toBe(
      false,
    );
  });
  it('rejects a member without a role', () => {
    expect(checkClaims({ tid: AYANTA, roles: [] }, AYANTA)).toEqual({ ok: false, reason: 'noRole' });
    expect(checkClaims({ tid: AYANTA, roles: ['Reader'] }, AYANTA)).toEqual({ ok: false, reason: 'noRole' });
  });
  it('only Administration manages form texts', () => {
    expect(can.manageConsentTexts(['THERAPIST'])).toBe(false);
    expect(can.manageConsentTexts(['ADMIN'])).toBe(true);
    expect(can.managePatients(['THERAPIST'])).toBe(true);
  });
});

/** access-control: Sitzungsdauer, simulated inactivity (task 2.4) */
describe('sliding session', () => {
  const idle = 30 * 60_000;
  const start = Date.UTC(2026, 9, 12, 8, 0);
  it('stays valid while the user is active', async () => {
    const { isSessionIdle } = await import('@/lib/access');
    expect(isSessionIdle(start, start + 29 * 60_000, idle)).toBe(false);
    // each request moves lastActivity forward, so 2 hours of regular use stay signed in
    expect(isSessionIdle(start + 100 * 60_000, start + 120 * 60_000, idle)).toBe(false);
  });
  it('ends after 30 minutes without activity', async () => {
    const { isSessionIdle } = await import('@/lib/access');
    expect(isSessionIdle(start, start + 31 * 60_000, idle)).toBe(true);
    expect(isSessionIdle(undefined, start, idle)).toBe(true);
  });
});
