import type { Role } from '@prisma/client';

export type ClaimCheck = { ok: true; roles: Role[] } | { ok: false; reason: 'foreign' | 'noRole' };

export interface EntraClaims {
  tid?: string;
  /** Optional claim: 0 = member of the tenant, 1 = guest */
  acct?: number | string;
  roles?: string[];
  idp?: string;
}

const ROLE_MAP: Record<string, Role> = { Therapist: 'THERAPIST', Admin: 'ADMIN' };

/**
 * access-control: only Ayanta members with an app role get in.
 * Rejects other tenants, personal Microsoft accounts (separate tenant id) and guests.
 */
export function checkClaims(claims: EntraClaims, ayantaTenantId: string): ClaimCheck {
  if (!ayantaTenantId || claims.tid !== ayantaTenantId) return { ok: false, reason: 'foreign' };
  if (String(claims.acct ?? '0') === '1') return { ok: false, reason: 'foreign' };
  // Members of the tenant carry no idp claim; guests (B2B or personal accounts) always do
  if (claims.idp) return { ok: false, reason: 'foreign' };
  const roles = [...new Set((claims.roles ?? []).map((r) => ROLE_MAP[r]).filter(Boolean))];
  if (roles.length === 0) return { ok: false, reason: 'noRole' };
  return { ok: true, roles };
}

export const can = {
  managePatients: (roles: Role[]) => roles.includes('THERAPIST') || roles.includes('ADMIN'),
  manageConsentTexts: (roles: Role[]) => roles.includes('ADMIN'),
};

/** access-control: Sitzungsdauer. A session ends after idleMs without any request (sliding expiry). */
export function isSessionIdle(lastActivity: number | undefined, now: number, idleMs: number): boolean {
  return !lastActivity || now - lastActivity > idleMs;
}
