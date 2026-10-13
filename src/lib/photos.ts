import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { config } from './config';
import { db } from './db';
import { audit } from './audit';
import { isJpeg, jpegSize, stripMetadata } from './jpeg';
import { photoStore, sha256 } from './storage';
import type { Actor } from './session';

/** clinical-photos: Fotos aufnehmen, speichern, ansehen und entfernen (design D5, D6). */

export class PhotoError extends Error {
  constructor(public code: 'photoType' | 'photoSize' | 'photoCount') {
    super(code);
  }
}

/** One photo as sent by the form: the resized JPEG, its thumbnail and the time it was taken. */
export type PhotoUpload = { data: Uint8Array; thumb?: Uint8Array | null; takenAt?: string | null };

export type PreparedPhoto = {
  id: string;
  blobPath: string;
  thumbPath: string;
  data: Buffer;
  thumb: Buffer | null;
  sha256: string;
  width: number;
  height: number;
  takenAt: Date;
};

/** Reads the photo fields of a form (photo, photoThumb, photoTakenAt in the same order). */
export async function photosFromForm(fd: FormData): Promise<PhotoUpload[]> {
  const files = fd.getAll('photo').filter((f): f is File => f instanceof File && f.size > 0);
  const thumbs = fd.getAll('photoThumb');
  const taken = fd.getAll('photoTakenAt');
  if (files.length > config.photos.maxPerSave) throw new PhotoError('photoCount');
  return Promise.all(
    files.map(async (f, i) => {
      const t = thumbs[i];
      return {
        data: new Uint8Array(await f.arrayBuffer()),
        thumb: t instanceof File && t.size > 0 ? new Uint8Array(await t.arrayBuffer()) : null,
        takenAt: typeof taken[i] === 'string' ? (taken[i] as string) : null,
      };
    }),
  );
}

/** Time the photo was taken, from the browser (EXIF or time of selection); never in the future. */
function takenAtOf(v: string | null | undefined, now: Date): Date {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime()) || d.getTime() > now.getTime() + 5 * 60_000 || d.getFullYear() < 2000) return now;
  return d;
}

/** Checks type and size, removes metadata (location) and computes the checksum. Throws PhotoError. */
export function preparePhotos(patientId: string, uploads: PhotoUpload[], now = new Date()): PreparedPhoto[] {
  if (uploads.length > config.photos.maxPerSave) throw new PhotoError('photoCount');
  return uploads.map((u) => {
    if (!isJpeg(u.data)) throw new PhotoError('photoType');
    if (u.data.length > config.photos.maxBytes) throw new PhotoError('photoSize');
    let data: Buffer;
    let thumb: Buffer | null = null;
    try {
      data = stripMetadata(u.data);
      if (u.thumb && isJpeg(u.thumb) && u.thumb.length <= config.photos.maxThumbBytes) thumb = stripMetadata(u.thumb);
    } catch {
      throw new PhotoError('photoType');
    }
    const size = jpegSize(data);
    if (!size) throw new PhotoError('photoType');
    const id = randomUUID();
    const blobPath = `${patientId}/${id}.jpg`;
    return {
      id,
      blobPath,
      thumbPath: thumb ? `${patientId}/${id}.thumb.jpg` : blobPath,
      data,
      thumb,
      sha256: sha256(data),
      ...size,
      takenAt: takenAtOf(u.takenAt, now),
    };
  });
}

/** Writes the files before the database transaction; files orphaned by a later error are harmless (design D6). */
export async function writePhotos(photos: PreparedPhoto[]) {
  const store = photoStore();
  for (const p of photos) {
    await store.put(p.blobPath, p.data, 'image/jpeg');
    if (p.thumb) await store.put(p.thumbPath, p.thumb, 'image/jpeg');
  }
}

type Tx = Prisma.TransactionClient;
type Ctx = {
  patientId: string;
  treatmentId: string;
  consultationId?: string | null;
  details?: Record<string, unknown>;
};

export async function addPhotoRows(tx: Tx, actor: Actor, photos: PreparedPhoto[], ctx: Ctx) {
  for (const p of photos) {
    await tx.clinicalPhoto.create({
      data: {
        id: p.id,
        treatmentId: ctx.treatmentId,
        consultationId: ctx.consultationId ?? null,
        blobPath: p.blobPath,
        thumbPath: p.thumbPath,
        sha256: p.sha256,
        width: p.width,
        height: p.height,
        sizeBytes: p.data.length,
        takenAt: p.takenAt,
        uploadedBy: actor.name,
      },
    });
    await audit(
      actor,
      'photo.added',
      { patientId: ctx.patientId, details: { ...ctx.details, photoId: p.id } as Prisma.InputJsonValue },
      tx,
    );
  }
}

/** Foto entfernen: only hides the photo; the file stays and the history notes the removal. */
export async function removePhotoRows(tx: Tx, actor: Actor, ids: string[], ctx: Ctx) {
  if (!ids.length) return;
  const rows = await tx.clinicalPhoto.findMany({
    where: {
      id: { in: ids },
      treatmentId: ctx.treatmentId,
      consultationId: ctx.consultationId ?? null,
      removedAt: null,
    },
  });
  for (const p of rows) {
    await tx.clinicalPhoto.update({ where: { id: p.id }, data: { removedAt: new Date(), removedBy: actor.name } });
    await audit(
      actor,
      'photo.removed',
      { patientId: ctx.patientId, details: { ...ctx.details, photoId: p.id } as Prisma.InputJsonValue },
      tx,
    );
  }
}

/** Visible photos of a treatment (consultationId null) or of a consultation */
export async function photosOf(where: { treatmentId: string; consultationId: string | null }) {
  return db.clinicalPhoto.findMany({ where: { ...where, removedAt: null }, orderBy: { takenAt: 'asc' } });
}

/**
 * Delivers a photo to a signed-in user with a role (checked by the route). The full view is logged; thumbnails
 * are not, they appear in every list.
 */
export async function loadPhoto(actor: Pick<Actor, 'id' | 'name'>, id: string, variant: 'full' | 'thumb') {
  const photo = await db.clinicalPhoto.findUnique({ where: { id }, include: { treatment: true } });
  if (!photo || photo.removedAt) return null;
  const data = await photoStore().get(variant === 'full' ? photo.blobPath : photo.thumbPath);
  if (variant === 'full') {
    if (sha256(data) !== photo.sha256) throw new Error('Checksum mismatch');
    await audit(actor, 'photo.viewed', {
      patientId: photo.treatment.patientId,
      details: { photoId: photo.id, treatmentId: photo.treatmentId, consultationId: photo.consultationId },
    });
  }
  return data;
}
