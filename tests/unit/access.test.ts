import { describe, expect, it } from 'vitest';
import { can } from '@/lib/access';
import { appRolesOf } from '@/lib/auth/accounts';

/** access-control: Rollen aus der Praxis-Mitgliedschaft (iteration 12, design D3) */
describe('permissions', () => {
  it('only Administration manages form texts', () => {
    expect(can.manageConsentTexts(['THERAPIST'])).toBe(false);
    expect(can.manageConsentTexts(['ADMIN'])).toBe(true);
    expect(can.managePatients(['THERAPIST'])).toBe(true);
  });
});

describe('roles of a membership', () => {
  it('maps Praxis-Admin to ADMIN and Therapeut/in to THERAPIST', () => {
    expect(appRolesOf(['PRACTICE_ADMIN', 'THERAPIST'])).toEqual(['ADMIN', 'THERAPIST']);
    expect(appRolesOf(['THERAPIST'])).toEqual(['THERAPIST']);
    expect(appRolesOf([])).toEqual([]);
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
