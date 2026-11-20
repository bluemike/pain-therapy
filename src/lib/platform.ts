import 'server-only';
import type { PracticeStatus } from '@prisma/client';
import { z } from 'zod';
import { runInPractice } from '@pain-therapy/shared/practice-context';
import { authDb, db, rawDb } from './db';
import { audit } from './audit';
import { createInvitation, normalizeEmail } from './auth/accounts';
import { INITIAL_TEXTS } from './consent-texts';
import { addressLineOf } from './practice-settings';
import { config } from './config';
import { documentStore, photoStore } from './storage';
import type { Actor } from './session';

/**
 * platform-admin (iteration 12, design D3, D9): the platform administrator creates practices, suspends and reactivates
 * them, invites their first practice admin and deletes a practice after its export. Never patient data: the overview
 * shows counts of members only. Works as the table owner (rawDb); each action is logged in the practice's audit log.
 */

export class PlatformError extends Error {
  constructor(
    public code: 'slugTaken' | 'notFound' | 'notSuspended' | 'noExport' | 'confirm' | 'deleted' | 'otherPractice',
  ) {
    super(code);
  }
}

export const newPracticeSchema = z.object({
  name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/, 'slug'),
  street: z.string().trim().max(120, 'tooLong'),
  zip: z
    .string()
    .trim()
    .regex(/^(\d{4,5})?$/, 'zip'),
  city: z.string().trim().min(1, 'required').max(80, 'tooLong'),
  contactEmail: z.string().trim().toLowerCase().email('email').max(254, 'tooLong'),
  documentPrefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2,4}$/, 'prefix'),
  adminName: z.string().trim().min(1, 'required').max(100, 'tooLong'),
  adminEmail: z.string().trim().toLowerCase().email('email').max(200, 'tooLong'),
});
export type NewPractice = z.infer<typeof newPracticeSchema>;

/** Practices with status, number of active members and the last sign-in of a member; no patient data */
export async function practicesOverview() {
  const practices = await rawDb.practice.findMany({
    orderBy: [{ deletedAt: { sort: 'desc', nulls: 'first' } }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      contactEmail: true,
      createdAt: true,
      deletedAt: true,
      memberships: { where: { active: true }, select: { user: { select: { lastLoginAt: true, activatedAt: true } } } },
      invitations: {
        where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { email: true },
      },
      exports: {
        where: { status: 'DONE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, createdAt: true, expiresAt: true },
      },
    },
  });
  return practices.map((p) => {
    const active = p.memberships.filter((m) => m.user.activatedAt);
    const last = active.map((m) => m.user.lastLoginAt.getTime());
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      contactEmail: p.contactEmail,
      createdAt: p.createdAt,
      deletedAt: p.deletedAt,
      members: active.length,
      lastActivity: last.length ? new Date(Math.max(...last)) : null,
      openInvitations: p.invitations.map((i) => i.email),
      lastExport: p.exports[0] ?? null,
    };
  });
}

/**
 * Creates a practice with the current template of the disclaimer as its version 1 and invites its first practice
 * admin (also therapist). The address in PDFs is built from name, street and town.
 */
export async function createPractice(actor: Actor, input: NewPractice) {
  if (await rawDb.practice.findUnique({ where: { slug: input.slug }, select: { id: true } }))
    throw new PlatformError('slugTaken');
  const admin = await authDb.user.findUnique({
    where: { email: normalizeEmail(input.adminEmail) },
    select: { platformAdmin: true, memberships: { where: { active: true }, select: { id: true } } },
  });
  if (admin?.platformAdmin || admin?.memberships.length) throw new PlatformError('otherPractice');
  const practice = await rawDb.practice.create({
    data: {
      name: input.name,
      slug: input.slug,
      street: input.street || null,
      zip: input.zip || null,
      city: input.city,
      addressLine: addressLineOf(input),
      defaultPlace: input.city,
      contactEmail: input.contactEmail,
      documentPrefix: input.documentPrefix,
    },
  });
  await runInPractice(practice.id, async () => {
    await db.consentTextVersion.createMany({
      data: (['de', 'en'] as const).map((language) => ({
        version: 1,
        language,
        title: INITIAL_TEXTS[language].title,
        body: INITIAL_TEXTS[language].body,
        publishedBy: actor.name,
      })),
    });
    await audit(actor, 'practice.created', { after: practice.name, details: { slug: practice.slug } });
  });
  await invitePracticeAdmin(actor, practice.id, { name: input.adminName, email: input.adminEmail });
  return practice;
}

/** Invites a practice admin (first one, or after the only admin lost every factor, design risks) */
export async function invitePracticeAdmin(actor: Actor, practiceId: string, input: { name: string; email: string }) {
  const p = await livePractice(practiceId);
  const inv = await createInvitation({
    email: input.email,
    name: input.name,
    practiceId: p.id,
    roles: ['PRACTICE_ADMIN', 'THERAPIST'],
    invitedBy: actor.name,
  });
  await runInPractice(p.id, () =>
    audit(actor, 'team.invited', {
      after: normalizeEmail(input.email),
      details: { roles: ['PRACTICE_ADMIN', 'THERAPIST'], invitationId: inv.id, by: 'platform' },
    }),
  );
  return inv;
}

/** A further platform administrator, invited by an existing one (design D3) */
export async function invitePlatformAdmin(actor: Actor, input: { name: string; email: string }) {
  const u = await authDb.user.findUnique({
    where: { email: normalizeEmail(input.email) },
    select: { memberships: { where: { active: true }, select: { id: true } } },
  });
  // The platform account never belongs to a practice (design D3)
  if (u?.memberships.length) throw new PlatformError('otherPractice');
  return createInvitation({
    email: input.email,
    name: input.name,
    practiceId: null,
    roles: [],
    platformAdmin: true,
    invitedBy: actor.name,
  });
}

async function livePractice(practiceId: string) {
  const p = await rawDb.practice.findUnique({ where: { id: practiceId } });
  if (!p) throw new PlatformError('notFound');
  if (p.deletedAt) throw new PlatformError('deleted');
  return p;
}

/** Suspend (sign-in and zone of the practice stop at once, data stays) or reactivate */
export async function setPracticeStatus(actor: Actor, practiceId: string, status: PracticeStatus) {
  const p = await livePractice(practiceId);
  if (p.status === status) return;
  await rawDb.practice.update({ where: { id: p.id }, data: { status } });
  await runInPractice(p.id, () =>
    audit(actor, status === 'SUSPENDED' ? 'practice.suspended' : 'practice.reactivated', { after: p.name }),
  );
}

/**
 * Deletes a practice (design D9): only suspended, only after an export of the last 7 days, confirmed by typing its
 * slug. Rows go at once (database function platform_purge_practice), photos too; signed PDFs and exercise sheets are
 * under WORM retention and are listed for the job that removes them once the retention has passed.
 */
export async function deletePractice(actor: Actor, practiceId: string, confirmSlug: string) {
  const p = await livePractice(practiceId);
  if (p.status !== 'SUSPENDED') throw new PlatformError('notSuspended');
  if (confirmSlug.trim().toLowerCase() !== p.slug) throw new PlatformError('confirm');
  const recent = await rawDb.practiceExport.findFirst({
    where: { practiceId: p.id, status: 'DONE', createdAt: { gt: new Date(Date.now() - 7 * 24 * 3600_000) } },
    select: { id: true },
  });
  if (!recent) throw new PlatformError('noExport');

  const [documents, sheets, photos] = await Promise.all([
    rawDb.signedDocument.findMany({ where: { practiceId: p.id }, select: { blobPath: true, createdAt: true } }),
    rawDb.exerciseHandout.findMany({ where: { practiceId: p.id }, select: { blobPath: true, createdAt: true } }),
    rawDb.clinicalPhoto.findMany({ where: { practiceId: p.id }, select: { blobPath: true, thumbPath: true } }),
  ]);
  const retentionMs = config.storage.documentRetentionDays * 24 * 3600_000;
  await rawDb.pendingBlobDeletion.createMany({
    data: [...documents, ...sheets].map((d) => ({
      practiceId: p.id,
      container: 'documents',
      path: d.blobPath,
      deleteAfter: new Date(d.createdAt.getTime() + retentionMs),
    })),
  });
  await rawDb.$executeRaw`SELECT platform_purge_practice(${p.id})`;
  // Photos have no retention: removed now; a failure leaves them listed for the job
  for (const path of photos.flatMap((x) => [x.blobPath, x.thumbPath]).filter((x): x is string => !!x)) {
    const removed = await photoStore()
      .delete(path)
      .then(() => true)
      .catch(() => false);
    if (!removed)
      await rawDb.pendingBlobDeletion.create({
        data: { practiceId: p.id, container: 'photos', path, deleteAfter: new Date() },
      });
  }
  await runInPractice(p.id, () =>
    audit(actor, 'practice.deleted', {
      before: p.name,
      details: { slug: p.slug, documents: documents.length + sheets.length, photos: photos.length },
    }),
  );
}

/**
 * Job (with the finalize job): removes listed files whose retention has passed. A refusal (retention not yet over)
 * leaves the row for the next run.
 */
export async function removeDueBlobs(now = new Date()) {
  const due = await rawDb.pendingBlobDeletion.findMany({
    where: { deletedAt: null, deleteAfter: { lte: now } },
    take: 200,
    orderBy: { deleteAfter: 'asc' },
  });
  let removed = 0;
  for (const row of due) {
    const store = row.container === 'photos' ? photoStore() : documentStore();
    try {
      await store.delete(row.path);
      await rawDb.pendingBlobDeletion.update({ where: { id: row.id }, data: { deletedAt: new Date() } });
      removed++;
    } catch (e) {
      console.error(`removeDueBlobs ${row.id} failed`, e);
    }
  }
  return { due: due.length, removed };
}

/**
 * Seed of the platform account (task 5.0, design D3): while no platform administrator exists and no invitation is
 * open, invites PLATFORM_ADMIN_EMAIL. Called by the 5-minute job, so the invitation goes out right after the first
 * deployment, and again once an unused one has expired.
 */
export async function ensurePlatformAdmin(email = config.platformAdminEmail) {
  const [admins, open] = await Promise.all([
    authDb.user.count({ where: { platformAdmin: true, activatedAt: { not: null } } }),
    authDb.invitation.count({
      where: { platformAdmin: true, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    }),
  ]);
  if (admins || open || !email) return { invited: false };
  await createInvitation({
    email,
    name: 'Plattform-Admin',
    practiceId: null,
    roles: [],
    platformAdmin: true,
    invitedBy: 'Pain Therapy',
  });
  return { invited: true };
}
