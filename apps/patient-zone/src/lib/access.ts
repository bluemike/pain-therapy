import {
  afterFailure,
  IP_ATTEMPTS_PER_HOUR,
  linkState,
  sameDateOfBirth,
  SESSION_DAYS,
  sessionLinkOk,
  type LinkState,
} from '@pain-therapy/shared/access';
import { currentProgram, type CurrentProgram } from '@pain-therapy/shared/program';
import { signatureStateOf } from '@pain-therapy/shared/signing';
import { DAY_MS } from '@pain-therapy/shared/time';
import { hashIp, hashToken, isTokenShaped, newToken } from '@pain-therapy/shared/tokens';
import { db } from './db';
import { zoneAudit } from './audit';
import { config } from './config';

/**
 * patient-access: Bestätigung mit dem Geburtsdatum, Sperren, Gerätesitzung (iteration 4, design D5, D6). Request
 * independent, so the rules are tested without a browser (test/access.test.ts); the server actions only add the
 * cookie and the redirect.
 */

const PATIENT = { id: true, firstName: true, preferredLanguage: true, dateOfBirth: true, status: true } as const;

/** The link of a token with its state; null for unknown tokens */
export async function lookupLink(token: string, now = new Date()) {
  if (!isTokenShaped(token)) return null;
  const link = await db.patientAccessLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { patient: { select: PATIENT } },
  });
  if (!link) return null;
  const [program, signature] = await Promise.all([
    currentProgram(db, link.patientId, now),
    signatureStateOf(db, link.patientId),
  ]);
  // A pending signature also keeps the link valid (iteration 5, design D4)
  const state = linkState(
    link,
    { patientActive: link.patient.status === 'ACTIVE', purposeActive: !!program?.active || signature.pending },
    now,
  );
  return { link, state };
}

/** Pages show the confirmation only for these states; every other state looks like an unknown link */
export const confirmable = (state: LinkState | undefined) => state === 'valid' || state === 'locked';

export type ConfirmResult =
  | { ok: true; sessionId: string; patientId: string }
  | { ok: false; error: 'invalid' | 'wrong' | 'locked' | 'tooMany' | 'format' };

const ipHashOf = (ip: string) => {
  if (!config.secret) throw new Error('PATIENT_ZONE_SECRET is not set');
  return hashIp(ip, config.secret);
};

/**
 * Bestätigung mit dem Geburtsdatum. Order: limit per IP address (20 per hour over all links), the link (unknown,
 * expired, replaced, revoked and blocked links all give `invalid`), the temporary lock, then the date. 5 failures
 * lock the link for 15 minutes, 10 block it until the practice issues a new one; a success resets the counter.
 */
export async function confirmLink(
  input: { token: string; day: string; month: string; year: string; ip: string },
  now = new Date(),
): Promise<ConfirmResult> {
  const ipHash = ipHashOf(input.ip);
  const recent = await db.patientZoneAttempt.count({
    where: { ipHash, at: { gt: new Date(now.getTime() - 60 * 60 * 1000) } },
  });
  if (recent >= IP_ATTEMPTS_PER_HOUR) return { ok: false, error: 'tooMany' };

  const day = /^\d{1,2}$/.test(input.day.trim()) ? Number(input.day) : NaN;
  const month = /^\d{1,2}$/.test(input.month.trim()) ? Number(input.month) : NaN;
  const year = /^\d{4}$/.test(input.year.trim()) ? Number(input.year) : NaN;
  const found = await lookupLink(input.token, now);
  const attempt = (success: boolean) =>
    db.patientZoneAttempt.create({
      data: { ipHash, linkId: found?.link.id ?? null, success, at: now },
      select: { id: true },
    });
  if (!found || !confirmable(found.state)) {
    await attempt(false);
    return { ok: false, error: 'invalid' };
  }
  const { link } = found;
  if (found.state === 'locked') {
    await attempt(false);
    return { ok: false, error: 'locked' };
  }
  if ([day, month, year].some(Number.isNaN)) return { ok: false, error: 'format' };

  if (!sameDateOfBirth(link.patient.dateOfBirth, day, month, year)) {
    await attempt(false);
    // Atomic increment, so parallel attempts cannot skip a lock
    const { failedAttempts } = await db.patientAccessLink.update({
      where: { id: link.id },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    });
    const outcome = afterFailure(failedAttempts, now);
    const audit = { patientId: link.patientId, linkId: link.id };
    await zoneAudit('accessLink.confirmFailed', { ...audit, after: String(failedAttempts) });
    if (outcome.blocked) {
      await db.patientAccessLink.update({ where: { id: link.id }, data: { blockedAt: now }, select: { id: true } });
      await zoneAudit('accessLink.blocked', audit);
      return { ok: false, error: 'locked' };
    }
    if (outcome.lockedUntil) {
      await db.patientAccessLink.update({
        where: { id: link.id },
        data: { lockedUntil: outcome.lockedUntil },
        select: { id: true },
      });
      await zoneAudit('accessLink.locked', audit);
      return { ok: false, error: 'locked' };
    }
    return { ok: false, error: 'wrong' };
  }

  const sessionId = newToken();
  await db.$transaction(async (tx) => {
    await tx.patientAccessLink.update({
      where: { id: link.id },
      data: { failedAttempts: 0, lockedUntil: null, lastUsedAt: now },
      select: { id: true },
    });
    await tx.patientZoneSession.create({
      data: {
        idHash: hashToken(sessionId),
        linkId: link.id,
        patientId: link.patientId,
        createdAt: now,
        expiresAt: new Date(now.getTime() + SESSION_DAYS * DAY_MS),
        lastSeenAt: now,
      },
      select: { id: true },
    });
    await tx.patientZoneAttempt.create({
      data: { ipHash, linkId: link.id, success: true, at: now },
      select: { id: true },
    });
    await zoneAudit('accessLink.confirmed', { patientId: link.patientId, linkId: link.id }, tx);
  });
  return { ok: true, sessionId, patientId: link.patientId };
}

/**
 * Gerätesitzung: valid for 30 days unless ended ("Abmelden"), the link revoked, blocked or expired, the patient no
 * longer active, or neither a home program active nor a signature pending (iteration 5, design D4). An invalid
 * session is ended in the database. Returns the patient, the current program (may be null or inactive while a
 * signature is pending) and whether a signature is pending.
 */
export async function resolveSession(sessionId: string | undefined, now = new Date()) {
  if (!sessionId || !isTokenShaped(sessionId)) return null;
  const session = await db.patientZoneSession.findUnique({
    where: { idHash: hashToken(sessionId) },
    include: { link: true, patient: { select: PATIENT } },
  });
  if (!session || session.endedAt || session.expiresAt <= now) return null;
  const [program, signature] = await Promise.all([
    currentProgram(db, session.patientId, now),
    signatureStateOf(db, session.patientId),
  ]);
  const ok = sessionLinkOk(
    session.link,
    {
      patientActive: session.patient.status === 'ACTIVE',
      purposeActive: !!program?.active || signature.pending,
    },
    now,
  );
  if (!ok) {
    await db.patientZoneSession.update({ where: { id: session.id }, data: { endedAt: now }, select: { id: true } });
    return null;
  }
  return {
    session: { id: session.id, linkId: session.linkId, createdAt: session.createdAt },
    patient: session.patient,
    program,
    signaturePending: signature.pending,
  };
}
export type ZoneSession = NonNullable<Awaited<ReturnType<typeof resolveSession>>>;
export type ProgramSession = ZoneSession & { program: CurrentProgram };

/**
 * zone-consent-signing: Unterschrift vor den Übungen. Home program, entries and images only with an active program
 * and no pending signature; otherwise null.
 */
export function programSession(s: ZoneSession | null): ProgramSession | null {
  return s && !s.signaturePending && s.program?.active ? (s as ProgramSession) : null;
}

/** Marks the session as seen and the link as used ("Zuletzt genutzt" in the record) */
export async function touchSession(s: ZoneSession, now = new Date()) {
  await db.patientZoneSession.update({ where: { id: s.session.id }, data: { lastSeenAt: now }, select: { id: true } });
  await db.patientAccessLink.update({
    where: { id: s.session.linkId },
    data: { lastUsedAt: now },
    select: { id: true },
  });
}

/** "Abmelden": ends the session; the link asks for the date of birth again on the next opening */
export async function endSession(sessionId: string | undefined, now = new Date()) {
  const s = await resolveSession(sessionId, now);
  if (!s) return;
  await db.patientZoneSession.update({ where: { id: s.session.id }, data: { endedAt: now }, select: { id: true } });
  await zoneAudit('zone.signedOut', { patientId: s.patient.id, linkId: s.session.linkId });
}
