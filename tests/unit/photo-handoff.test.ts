import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, rawDb } from '@/lib/db';
import { createPatient } from '@/lib/patients';
import { currentVersionNumber } from '@/lib/consent-texts';
import { EMPTY_PATIENT, patientSchema, treatmentSchema } from '@/lib/schemas';
import { createTreatment, updateTreatment } from '@/lib/treatments';
import {
  deleteStaleHandoffPhotos,
  endHandoff,
  HANDOFF_ATTEMPTS_PER_HOUR,
  handoffState,
  lookupHandoff,
  startHandoff,
  uploadToHandoff,
} from '@/lib/photo-handoff';
import { photoStore } from '@/lib/storage';
import type { Actor } from '@/lib/session';
import { syncCatalog } from '../../prisma/catalog/sync.mjs';
import { TINY_JPEG, withExif } from '../fixtures/jpeg';
import { resetDatabase } from './db-reset';

const actor: Actor = { id: 'u-1', name: 'Mike Franz', email: 'mike.franz@ayanta.ch', roles: ['THERAPIST'] };

const patient = (lastName: string) =>
  createPatient(
    actor,
    patientSchema.parse({
      ...Object.fromEntries(Object.entries(EMPTY_PATIENT).map(([k, v]) => [k, typeof v === 'boolean' ? '' : v])),
      firstName: 'Anna',
      lastName,
      dateOfBirth: '05.03.1980',
      email: 'anna@example.ch',
    }),
  );
/** A patient with a valid signed disclaimer, so a treatment can be opened */
async function signedPatient(lastName: string) {
  const p = await patient(lastName);
  const version = await currentVersionNumber();
  const text = await db.consentTextVersion.findFirstOrThrow({ where: { version, language: 'de' } });
  const s = await db.signatureSession.create({
    data: { patientId: p.id, textVersionId: text.id, language: 'de', status: 'SIGNED', startedBy: actor.name },
  });
  await db.signedDocument.create({
    data: {
      documentNumber: `PT-TEST-${lastName}`,
      patientId: p.id,
      sessionId: s.id,
      textVersion: version,
      language: 'de',
      blobPath: 'x.pdf',
      sha256: '0',
      sizeBytes: 1,
    },
  });
  return p;
}
const token = (url: string) => url.split('/foto/')[1];
const photo = { data: new Uint8Array(withExif(TINY_JPEG)), thumb: new Uint8Array(TINY_JPEG), takenAt: null };

beforeAll(async () => {
  await resetDatabase();
  await syncCatalog(db);
});
afterAll(resetDatabase);

describe('photos with the smartphone (iteration 15, design D5)', () => {
  it('uploads through the link and takes the photos over when the new treatment is saved', async () => {
    const p = await signedPatient('Handoff');
    const h = await startHandoff(actor, p.id, null);
    expect(h.url).toMatch(/\/foto\/[A-Za-z0-9_-]{43}$/);
    expect(h.checkCode).toMatch(/^[A-Z2-9]{4}$/);
    // Only the hash of the token is stored
    const row = await db.photoHandoff.findUniqueOrThrow({ where: { id: h.id } });
    expect(row.tokenHash).not.toContain(token(h.url));

    const link = await lookupHandoff(token(h.url));
    expect(link).toMatchObject({ open: true, remaining: 10, checkCode: h.checkCode });
    expect(JSON.stringify(link)).not.toContain('Handoff');

    expect(await uploadToHandoff(token(h.url), photo, '10.0.0.1')).toEqual({ remaining: 9 });
    const state = await handoffState(h.id);
    expect(state?.photos).toHaveLength(1);
    const [up] = await db.photoHandoffUpload.findMany({ where: { handoffId: h.id } });
    // Location removed like photos from the form
    expect(Buffer.from((await photoStore().get(up.blobPath))!).includes(Buffer.from('GPS'))).toBe(false);

    const t = await createTreatment(
      actor,
      p.id,
      treatmentSchema.parse({ startedAt: '2026-10-01T09:15', regionId: '6', diagnosis: 'Lumbalgie', painStart: '60' }),
      [],
      [up.id],
    );
    const saved = await db.clinicalPhoto.findMany({ where: { treatmentId: t.id } });
    expect(saved.map((x) => [x.id, x.blobPath])).toEqual([[up.id, up.blobPath]]);
    expect((await handoffState(h.id))?.photos).toEqual([]);
    // Taken over once only
    await updateTreatment(
      actor,
      t.id,
      treatmentSchema.parse({ startedAt: '2026-10-01T09:15', regionId: '6', diagnosis: 'Lumbalgie', painStart: '60' }),
      { handoff: [up.id] },
    );
    expect(await db.clinicalPhoto.count({ where: { treatmentId: t.id } })).toBe(1);
    const actions = (await db.auditEvent.findMany({ where: { patientId: p.id } })).map((e) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['photoHandoff.started', 'photoHandoff.uploaded', 'photo.added']));
  });

  it('refuses after «Beenden», after 15 minutes, beyond 10 photos and unknown tokens', async () => {
    const p = await patient('Limits');
    const h = await startHandoff(actor, p.id, null);
    for (let i = 0; i < 10; i++) await uploadToHandoff(token(h.url), photo, '10.0.0.2');
    await expect(uploadToHandoff(token(h.url), photo, '10.0.0.2')).rejects.toMatchObject({ code: 'full' });

    const late = await startHandoff(actor, p.id, null, new Date(Date.now() - 16 * 60_000));
    await expect(uploadToHandoff(token(late.url), photo, '10.0.0.3')).rejects.toMatchObject({ code: 'expired' });

    const ended = await startHandoff(actor, p.id, null);
    await endHandoff(actor, ended.id);
    await expect(uploadToHandoff(token(ended.url), photo, '10.0.0.3')).rejects.toMatchObject({ code: 'expired' });

    await expect(uploadToHandoff('x'.repeat(43), photo, '10.0.0.3')).rejects.toMatchObject({ code: 'notFound' });
    expect(await lookupHandoff('not-a-token')).toBeNull();
    // Not a photo
    const other = await startHandoff(actor, p.id, null);
    await expect(
      uploadToHandoff(token(other.url), { data: new Uint8Array([1, 2, 3]), thumb: null, takenAt: null }, '10.0.0.3'),
    ).rejects.toMatchObject({ code: 'photoType' });
  });

  it('limits attempts per IP address to 30 per hour', async () => {
    const p = await patient('Rate');
    const h = await startHandoff(actor, p.id, null);
    for (let i = 0; i < HANDOFF_ATTEMPTS_PER_HOUR; i++)
      await uploadToHandoff('y'.repeat(43), photo, '10.0.0.9').catch(() => undefined);
    await expect(uploadToHandoff(token(h.url), photo, '10.0.0.9')).rejects.toMatchObject({ code: 'rateLimited' });
    await expect(uploadToHandoff(token(h.url), photo, '10.0.0.10')).resolves.toEqual({ remaining: 9 });
  });

  it('deletes photos never saved after 24 hours, with their files', async () => {
    const p = await patient('Stale');
    const h = await startHandoff(actor, p.id, null);
    await uploadToHandoff(token(h.url), photo, '10.0.0.4');
    const [up] = await db.photoHandoffUpload.findMany({ where: { handoffId: h.id } });
    expect(await deleteStaleHandoffPhotos()).toBe(0);
    await rawDb.photoHandoffUpload.update({
      where: { id: up.id },
      data: { uploadedAt: new Date(Date.now() - 25 * 3600_000) },
    });
    expect(await deleteStaleHandoffPhotos()).toBe(1);
    expect(await db.photoHandoffUpload.count({ where: { handoffId: h.id } })).toBe(0);
    expect(await photoStore().get(up.blobPath).catch(() => null)).toBeNull();
  });
});
