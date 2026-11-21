import type { AppRole } from './auth/accounts';

export const can = {
  managePatients: (roles: AppRole[]) => roles.includes('THERAPIST') || roles.includes('ADMIN'),
  manageConsentTexts: (roles: AppRole[]) => roles.includes('ADMIN'),
};

/** access-control: Sitzungsdauer. A session ends after idleMs without any request (sliding expiry). */
export function isSessionIdle(lastActivity: number | undefined, now: number, idleMs: number): boolean {
  return !lastActivity || now - lastActivity > idleMs;
}
