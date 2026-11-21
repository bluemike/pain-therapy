import 'server-only';
import { randomInt } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { hashIp, hashToken, isTokenShaped, newToken } from '@pain-therapy/shared/tokens';
import { runInPractice } from '@pain-therapy/shared/practice-context';
import { config } from './config';
import { db, rawDb } from './db';
import { audit } from './audit';
import { photoStore } from './storage';
import { preparePhotos, writePhotos, PhotoError, type PhotoUpload } from './photos';
import type { Actor } from './session';

/**
 * Fotos mit dem Smartphone (iteration 15, design D5). The therapist opens a handoff in the photo field; the iPad shows
 * a QR code with /foto/<token>. That page can only upload: at most 10 photos within 15 minutes, JPEG up to 8 MB, 30
 * attempts per IP and hour. The form asks for new photos every 3 seconds and takes them over when it is saved; photos
 * never saved are deleted after 24 hours (deleteStaleHandoffPhotos, finalize job).
 */

export const HANDOFF_MINUTES = 15;
export const HANDOFF_MAX_PHOTOS = 10;
export const HANDOFF_MAX_BYTES = 8 * 1024 * 1024;
export const HANDOFF_ATTEMPTS_PER_HOUR = 30;
export const HANDOFF_KEEP_HOURS = 24;

/** Without 0/O, 1/I/L, so the code reads the same on both screens */
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const checkCode = () => Array.from({ length: 4 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');

export const handoffUrl = (token: string) => `${config.auth.appUrl}/foto/${token}`;

export class HandoffError extends Error {
  constructor(public code: 'notFound' | 'expired' | 'full' | 'rateLimited' | 'inactive') {
    super(code);
  }
}

/** «Mit Smartphone aufnehmen»: a new link for a patient (and the treatment, if it exists already) */
export async function startHandoff(actor: Actor, patientId: string, treatmentId: string | null, now = new Date()) {
  const patient = await db.patient.findUnique({ where: { id: patientId }, select: { id: true, status: true } });
  if (!patient) throw new HandoffError('notFound');
  if (patient.status !== 'ACTIVE') throw new HandoffError('inactive');
  if (treatmentId && !(await db.treatment.findFirst({ where: { id: treatmentId, patientId }, select: { id: true } })))
    throw new HandoffError('notFound');
  const token = newToken();
  const h = await db.$transaction(async (tx) => {
    const created = await tx.photoHandoff.create({
      data: {
        tokenHash: hashToken(token),
        checkCode: checkCode(),
        patientId,
        treatmentId,
        createdById: actor.id,
        createdBy: actor.name,
        expiresAt: new Date(now.getTime() + HANDOFF_MINUTES * 60_000),
        maxPhotos: HANDOFF_MAX_PHOTOS,
      },
    });
    await audit(actor, 'photoHandoff.started', { patientId, details: { handoffId: created.id, treatmentId } }, tx);
    return created;
  });
  return { id: h.id, url: handoffUrl(token), checkCode: h.checkCode, expiresAt: h.expiresAt };
}

/** «Beenden»: the link accepts nothing more; photos already sent stay until the form is saved */
export async function endHandoff(actor: Actor, id: string, now = new Date()) {
  const h = await db.photoHandoff.findUnique({ where: { id } });
  if (!h || h.endedAt) return;
  await db.$transaction(async (tx) => {
    await tx.photoHandoff.update({ where: { id }, data: { endedAt: now } });
    await audit(actor, 'photoHandoff.ended', { patientId: h.patientId, details: { handoffId: id } }, tx);
  });
}

/** For the polling form: state of the link and the photos not yet taken over */
export async function handoffState(id: string, now = new Date()) {
  const h = await db.photoHandoff.findUnique({
    where: { id },
    include: { uploads: { where: { claimedAt: null }, orderBy: { uploadedAt: 'asc' } } },
  });
  if (!h) return null;
  const open = !h.endedAt && h.expiresAt > now;
  return {
    open,
    expiresAt: h.expiresAt.toISOString(),
    remaining: Math.max(0, h.maxPhotos - (await db.photoHandoffUpload.count({ where: { handoffId: id } }))),
    photos: h.uploads.map((u) => ({ id: u.id, takenAt: u.takenAt.toISOString() })),
  };
}

/** Thumbnail or photo of an upload not yet taken over, for the preview in the form */
export async function handoffPhoto(handoffId: string, uploadId: string, variant: 'full' | 'thumb') {
  const u = await db.photoHandoffUpload.findFirst({ where: { id: uploadId, handoffId, claimedAt: null } });
  if (!u) return null;
  return photoStore().get(variant === 'thumb' ? u.thumbPath : u.blobPath);
}

// ---------- Public page /foto/<token> ----------

type Link = {
  id: string;
  practiceId: string;
  practiceName: string;
  checkCode: string;
  expiresAt: Date;
  remaining: number;
  open: boolean;
};

/** The link of a token, read in its practice; null for anything unknown. Shows no patient data. */
export async function lookupHandoff(token: string, now = new Date()): Promise<Link | null> {
  if (!isTokenShaped(token)) return null;
  const tokenHash = hashToken(token);
  const [row] = await rawDb.$queryRaw<{ p: string | null }[]>`SELECT photo_handoff_practice(${tokenHash}) AS p`;
  const practiceId = row?.p;
  if (!practiceId) return null;
  return runInPractice(practiceId, async () => {
    const h = await db.photoHandoff.findUnique({ where: { tokenHash }, include: { practice: true } });
    if (!h) return null;
    const used = await db.photoHandoffUpload.count({ where: { handoffId: h.id } });
    return {
      id: h.id,
      practiceId,
      practiceName: h.practice.name,
      checkCode: h.checkCode,
      expiresAt: h.expiresAt,
      remaining: Math.max(0, h.maxPhotos - used),
      open: !h.endedAt && h.expiresAt > now && used < h.maxPhotos,
    };
  });
}

/** Limit per IP address (HMAC, never the address itself); counts every attempt, also failed ones */
export async function allowAttempt(ip: string, now = new Date()) {
  const ipHash = hashIp(ip, process.env.AUTH_SECRET || 'local-photo-handoff');
  const since = new Date(now.getTime() - 3600_000);
  const n = await rawDb.photoHandoffAttempt.count({ where: { ipHash, at: { gt: since } } });
  if (n >= HANDOFF_ATTEMPTS_PER_HOUR) return false;
  await rawDb.photoHandoffAttempt.create({ data: { ipHash, at: now } });
  // Old attempts are not needed for the limit
  await rawDb.photoHandoffAttempt.deleteMany({ where: { at: { lt: new Date(now.getTime() - 24 * 3600_000) } } });
  return true;
}

/** One photo from the phone: checked and stored like photos from the form (location removed) */
export async function uploadToHandoff(token: string, upload: PhotoUpload, ip: string, now = new Date()) {
  if (!(await allowAttempt(ip, now))) throw new HandoffError('rateLimited');
  const link = await lookupHandoff(token, now);
  if (!link) throw new HandoffError('notFound');
  if (!link.open) throw new HandoffError(link.remaining ? 'expired' : 'full');
  if (upload.data.length > HANDOFF_MAX_BYTES) throw new PhotoError('photoSize');
  return runInPractice(link.practiceId, async () => {
    const h = await db.photoHandoff.findUniqueOrThrow({ where: { id: link.id } });
    const [p] = preparePhotos(await blobFolderOf(h.practiceId, h.patientId), [upload], now, HANDOFF_MAX_BYTES);
    await writePhotos([p]);
    return db.$transaction(async (tx) => {
      // Serialises parallel uploads, so the limit of 10 holds
      await tx.$queryRaw`SELECT id FROM "PhotoHandoff" WHERE id = ${h.id} FOR UPDATE`;
      if ((await tx.photoHandoffUpload.count({ where: { handoffId: h.id } })) >= h.maxPhotos)
        throw new HandoffError('full');
      await tx.photoHandoffUpload.create({
        data: {
          id: p.id,
          handoffId: h.id,
          blobPath: p.blobPath,
          thumbPath: p.thumbPath,
          sha256: p.sha256,
          width: p.width,
          height: p.height,
          sizeBytes: p.data.length,
          takenAt: p.takenAt,
        },
      });
      await audit(
        { id: h.createdById, name: `${h.createdBy} (Smartphone)` },
        'photoHandoff.uploaded',
        { patientId: h.patientId, details: { handoffId: h.id, photoId: p.id } },
        tx,
      );
      return { remaining: Math.max(0, link.remaining - 1) };
    });
  });
}

/** blobFolder() needs a signed-in practice; the public page has the handoff's instead */
async function blobFolderOf(practiceId: string, patientId: string) {
  return `${practiceId}/${patientId}`;
}

// ---------- Taking over when the form is saved ----------

type Tx = Prisma.TransactionClient;

/**
 * The photos from the phone that the form keeps become ClinicalPhotos with the same id and files. Only uploads of a
 * handoff of the same patient, not yet taken over and not older than 24 hours; others are ignored.
 */
export async function claimHandoffPhotos(
  tx: Tx,
  actor: Actor,
  ids: string[],
  ctx: { patientId: string; treatmentId: string; consultationId?: string | null; details?: Record<string, unknown> },
  now = new Date(),
) {
  if (!ids.length) return 0;
  const rows = await tx.photoHandoffUpload.findMany({
    where: {
      id: { in: ids.slice(0, HANDOFF_MAX_PHOTOS * 3) },
      claimedAt: null,
      uploadedAt: { gt: new Date(now.getTime() - HANDOFF_KEEP_HOURS * 3600_000) },
      handoff: { patientId: ctx.patientId },
    },
  });
  for (const u of rows) {
    await tx.clinicalPhoto.create({
      data: {
        id: u.id,
        treatmentId: ctx.treatmentId,
        consultationId: ctx.consultationId ?? null,
        blobPath: u.blobPath,
        thumbPath: u.thumbPath,
        sha256: u.sha256,
        width: u.width,
        height: u.height,
        sizeBytes: u.sizeBytes,
        takenAt: u.takenAt,
        uploadedBy: actor.name,
      },
    });
    await tx.photoHandoffUpload.update({ where: { id: u.id }, data: { claimedAt: now } });
    await audit(
      actor,
      'photo.added',
      {
        patientId: ctx.patientId,
        details: { ...ctx.details, photoId: u.id, from: 'smartphone' } as Prisma.InputJsonValue,
      },
      tx,
    );
  }
  return rows.length;
}

/**
 * Aufräum-Job (design D5): photos from the phone never saved with a form are deleted for good after 24 hours, with
 * their files. Runs as the owner over all practices (finalize job).
 */
export async function deleteStaleHandoffPhotos(now = new Date()) {
  const stale = await rawDb.photoHandoffUpload.findMany({
    where: { claimedAt: null, uploadedAt: { lt: new Date(now.getTime() - HANDOFF_KEEP_HOURS * 3600_000) } },
    select: { id: true, blobPath: true, thumbPath: true },
  });
  for (const u of stale) {
    for (const path of new Set([u.blobPath, u.thumbPath]))
      await photoStore()
        .delete(path)
        .catch(() => undefined);
    await rawDb.photoHandoffUpload.delete({ where: { id: u.id } });
  }
  return stale.length;
}
