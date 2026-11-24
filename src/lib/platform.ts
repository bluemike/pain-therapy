import 'server-only';
import type { PracticeRole, PracticeStatus } from '@prisma/client';
import { z } from 'zod';
import { runInPractice } from '@pain-therapy/shared/practice-context';
import { authDb, db, rawDb } from './db';
import { audit } from './audit';
import { createInvitation, normalizeEmail, reissueInvitationForPrint } from './auth/accounts';
import { resolveInviteAddress, sendInvite, type InviteForm } from './onboarding';
import { INITIAL_TEXTS, TEMPLATE_VERSION } from './consent-texts';
import { addressLineOf } from './practice-settings';
import { config } from './config';
import { lastChangeOf, planState, usageOf } from './plans';
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

/**
 * Iteration 13 (Mike 20.11.2026, «(vor-)erfassen»): the platform admin captures or corrects the details of an existing
 * practice and can invite its practice admin in the same step; the practice admin adjusts them later on «Praxis».
 * Name and e-mail of the admin are optional, but only together.
 */
export const practiceDetailsSchema = z
  .object({
    name: z.string().trim().min(1, 'required').max(120, 'tooLong'),
    street: z.string().trim().max(120, 'tooLong'),
    zip: z
      .string()
      .trim()
      .regex(/^(\d{4,5})?$/, 'zip'),
    city: z.string().trim().min(1, 'required').max(80, 'tooLong'),
    defaultPlace: z.string().trim().min(1, 'required').max(80, 'tooLong'),
    contactEmail: z.string().trim().toLowerCase().email('email').max(254, 'tooLong'),
    phone: z.string().trim().max(40, 'tooLong'),
    privacyOfficer: z.string().trim().max(100, 'tooLong'),
    documentPrefix: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2,4}$/, 'prefix'),
    adminName: z.string().trim().max(100, 'tooLong'),
    adminEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(200, 'tooLong')
      .refine((v) => v === '' || z.email().safeParse(v).success, 'email'),
  })
  .superRefine((v, ctx) => {
    if (v.adminName && !v.adminEmail) ctx.addIssue({ code: 'custom', path: ['adminEmail'], message: 'required' });
    if (v.adminEmail && !v.adminName) ctx.addIssue({ code: 'custom', path: ['adminName'], message: 'required' });
  });
export type PracticeDetails = z.infer<typeof practiceDetailsSchema>;

/** Practice details as the platform form shows them */
export async function practiceDetailsOf(practiceId: string) {
  const p = await rawDb.practice.findUnique({
    where: { id: practiceId },
    select: {
      name: true,
      street: true,
      zip: true,
      city: true,
      defaultPlace: true,
      contactEmail: true,
      phone: true,
      privacyOfficer: true,
      documentPrefix: true,
    },
  });
  if (!p) return null;
  return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ''])) as Record<keyof typeof p, string>;
}

/**
 * Saves the details of a practice (only the fields the platform form has; logo and privacy notice stay with the
 * practice admin) and, with name and e-mail, invites its practice admin. Returns whether someone was invited.
 */
export async function updatePracticeDetails(actor: Actor, practiceId: string, input: PracticeDetails) {
  const before = await livePractice(practiceId);
  if (input.adminEmail) await assertInvitable(input.adminEmail, before.id);
  const data = {
    name: input.name,
    street: input.street || null,
    zip: input.zip || null,
    city: input.city,
    addressLine: addressLineOf(input),
    defaultPlace: input.defaultPlace,
    contactEmail: input.contactEmail,
    phone: input.phone || null,
    privacyOfficer: input.privacyOfficer || null,
    documentPrefix: input.documentPrefix,
  };
  await rawDb.practice.update({ where: { id: before.id }, data });
  const changed = (Object.keys(data) as (keyof typeof data)[]).filter(
    (k) => String(before[k] ?? '') !== String(data[k] ?? ''),
  );
  if (changed.length)
    await runInPractice(before.id, () =>
      audit(actor, 'practice.updated', { details: { fields: changed, by: 'platform' } }),
    );
  if (!input.adminEmail) return { invited: false };
  await invitePracticeAdmin(actor, before.id, { name: input.adminName, email: input.adminEmail });
  return { invited: true };
}

/** A practice admin must not be the platform account nor an active member of another practice (design D3) */
async function assertInvitable(email: string, practiceId: string | null) {
  const u = await authDb.user.findUnique({
    where: { email: normalizeEmail(email) },
    select: { platformAdmin: true, memberships: { where: { active: true }, select: { practiceId: true } } },
  });
  if (u?.platformAdmin || u?.memberships.some((m) => m.practiceId !== practiceId))
    throw new PlatformError('otherPractice');
}

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
      mailboxQuota: true,
      plan: { select: { id: true, name: true, patientLimit: true } },
      memberships: {
        where: { active: true },
        select: { user: { select: { lastLoginAt: true, activatedAt: true, name: true } } },
      },
      invitations: {
        where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true, email: true, channel: true },
      },
      exports: {
        where: { status: 'DONE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, createdAt: true, expiresAt: true },
      },
    },
  });
  // platform-statistics (iteration 17, design D5, D6): numbers only, never patient details
  const ids = practices.map((p) => p.id);
  const [usage, lastChange] = await Promise.all([usageOf(ids), lastChangeOf(ids)]);
  return practices.map((p) => {
    const active = p.memberships.filter((m) => m.user.activatedAt);
    const last = active.map((m) => m.user.lastLoginAt.getTime());
    const latest = active.reduce<(typeof active)[number] | null>(
      (a, m) => (!a || m.user.lastLoginAt > a.user.lastLoginAt ? m : a),
      null,
    );
    const counts = usage.get(p.id)!;
    return {
      lastLoginBy: latest?.user.name ?? null,
      lastChange: lastChange.get(p.id) ?? null,
      usage: counts,
      plan: { ...p.plan, state: planState(counts.patients, p.plan.patientLimit) },
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
      invitations: p.invitations,
      mailboxQuota: p.mailboxQuota,
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
  await assertInvitable(input.adminEmail, null);
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
      // Iteration 17 (design D3, D4): starts with the current template; the first admin is the responsible person
      templateSeen: TEMPLATE_VERSION,
      privacyOfficer: input.adminName,
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
  await assertInvitable(input.email, p.id);
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

/**
 * Iteration 16: withdraws an open invitation of a practice, e.g. to invite the same person again with her own
 * address. The mailbox row of a withdrawn invitation is cleaned up by sweepMailboxes (src/lib/mailboxes.ts).
 */
export async function revokePracticeInvitation(actor: Actor, practiceId: string, invitationId: string) {
  const p = await livePractice(practiceId);
  const r = await authDb.invitation.updateMany({
    where: { id: invitationId, practiceId: p.id, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (!r.count) throw new PlatformError('notFound');
  await runInPractice(p.id, () =>
    audit(actor, 'team.invitationRevoked', { details: { invitationId, by: 'platform' } }),
  );
}

/** Iteration 19 (design D3): «Einladung drucken» on the platform page; a new link replaces the old */
export async function printPracticeInvitation(actor: Actor, practiceId: string, invitationId: string) {
  const p = await livePractice(practiceId);
  const sheet = await reissueInvitationForPrint(invitationId, p.id);
  if (!sheet) throw new PlatformError('notFound');
  await runInPractice(p.id, () =>
    audit(actor, 'team.invitationPrinted', { details: { invitationId, by: 'platform' } }),
  );
  return sheet;
}

/**
 * Iteration 16 (design D1, D3): practice admin invited by SMS or e-mail, with a new or an existing mailbox at
 * pain-therapy.online (e.g. Chrissie with christina.franz@).
 */
export async function invitePracticeAdminWith(actor: Actor, practiceId: string, form: InviteForm) {
  const p = await livePractice(practiceId);
  const email = await resolveInviteAddress(form, { practiceId: p.id, byPlatform: true });
  await assertInvitable(email, p.id);
  const roles: PracticeRole[] = ['PRACTICE_ADMIN', 'THERAPIST'];
  const inv = await sendInvite({ form, email, practiceId: p.id, roles, invitedBy: actor.name });
  await runInPractice(p.id, () =>
    audit(actor, 'team.invited', {
      after: email,
      details: { roles, invitationId: inv.id, by: 'platform', channel: form.channel, mailbox: form.mailbox.mode },
    }),
  );
  return inv;
}

/** Iteration 16 (design D5): how many mailboxes the practice admin may have created */
export async function setMailboxQuota(practiceId: string, quota: number) {
  if (!Number.isInteger(quota) || quota < 0 || quota > 100) throw new PlatformError('notFound');
  await rawDb.practice.update({ where: { id: practiceId }, data: { mailboxQuota: quota } });
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

  const [documents, sheets, saved, pending] = await Promise.all([
    rawDb.signedDocument.findMany({ where: { practiceId: p.id }, select: { blobPath: true, createdAt: true } }),
    rawDb.exerciseHandout.findMany({ where: { practiceId: p.id }, select: { blobPath: true, createdAt: true } }),
    rawDb.clinicalPhoto.findMany({ where: { practiceId: p.id }, select: { blobPath: true, thumbPath: true } }),
    // Photos from the phone not yet saved with a form (iteration 15, design D5)
    rawDb.photoHandoffUpload.findMany({
      where: { practiceId: p.id, claimedAt: null },
      select: { blobPath: true, thumbPath: true },
    }),
  ]);
  const photos = [...saved, ...pending];
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
    invitedBy: config.operator.name,
  });
  return { invited: true };
}
