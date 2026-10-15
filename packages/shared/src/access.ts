import { addMonths } from './time';

/**
 * patient-access: Gültigkeit, Sperren und Gerätesitzung (iteration 4, design D3, D5, D6; durations as in the open
 * questions of design.md until the practice decides otherwise).
 */
export const LINK_VALID_MONTHS = 6;
export const LOCK_AFTER_FAILURES = 5;
export const LOCK_MINUTES = 15;
export const BLOCK_AFTER_FAILURES = 10;
export const IP_ATTEMPTS_PER_HOUR = 20;
export const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'pz_session';
/** Audit events of the patient zone carry this user (design D12) */
export const ZONE_ACTOR = { id: 'patient-zone', name: 'Patienten-Zone' } as const;

export function linkExpiry(issuedAt: Date): Date {
  return addMonths(issuedAt, LINK_VALID_MONTHS);
}

export type LinkFields = {
  expiresAt: Date;
  revokedAt: Date | null;
  replacedAt: Date | null;
  blockedAt: Date | null;
  lockedUntil: Date | null;
};

/**
 * State of a link. `expired` also covers an inactive patient and a link without purpose: no active home program and
 * no pending signature (iteration 5, design D4: purposeActive = homeProgramActive || signaturePending; the record
 * shows the link as expired). Only `valid` and `locked` links get the confirmation page; every other state
 * shows the same neutral page as an unknown token.
 */
export type LinkState = 'valid' | 'locked' | 'blocked' | 'revoked' | 'replaced' | 'expired';

export function linkState(
  link: LinkFields,
  ctx: { patientActive: boolean; purposeActive: boolean },
  now = new Date(),
): LinkState {
  if (link.revokedAt) return 'revoked';
  if (link.blockedAt) return 'blocked';
  if (link.replacedAt) return 'replaced';
  if (link.expiresAt <= now || !ctx.patientActive || !ctx.purposeActive) return 'expired';
  if (link.lockedUntil && link.lockedUntil > now) return 'locked';
  return 'valid';
}

/**
 * Sessions stay valid when a link is only replaced by a new one (design D6), but end when it is revoked, blocked or
 * expires, or when the patient is no longer active or the link has no purpose any more (design D4).
 */
export function sessionLinkOk(
  link: LinkFields,
  ctx: { patientActive: boolean; purposeActive: boolean },
  now = new Date(),
) {
  return !link.revokedAt && !link.blockedAt && link.expiresAt > now && ctx.patientActive && ctx.purposeActive;
}

/** Consequence of a failed confirmation, given the new number of failures since the last success */
export function afterFailure(failures: number, now = new Date()): { lockedUntil: Date | null; blocked: boolean } {
  if (failures >= BLOCK_AFTER_FAILURES) return { lockedUntil: null, blocked: true };
  if (failures === LOCK_AFTER_FAILURES)
    return { lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60 * 1000), blocked: false };
  return { lockedUntil: null, blocked: false };
}

/** Compares the entered date of birth with the record (stored as UTC midnight, @db.Date) */
export function sameDateOfBirth(dateOfBirth: Date, day: number, month: number, year: number): boolean {
  return (
    dateOfBirth.getUTCFullYear() === year && dateOfBirth.getUTCMonth() + 1 === month && dateOfBirth.getUTCDate() === day
  );
}
