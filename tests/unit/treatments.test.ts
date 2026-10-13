import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/lib/db';
import { createPatient, historyOf, setStatus } from '@/lib/patients';
import { currentVersionNumber } from '@/lib/consent-texts';
import { catalogView, regionSheet } from '@/lib/catalog';
import { consultationSchema, EMPTY_PATIENT, patientSchema, treatmentSchema, type Sheet } from '@/lib/schemas';
import {
  createConsultation,
  createTreatment,
  getConsultation,
  openingBlocker,
  sheetOf,
  TreatmentError,
  treatmentsOf,
  updateConsultation,
  updateTreatment,
} from '@/lib/treatments';
import { photoStore, sha256 } from '@/lib/storage';
import { exifDateTime } from '@/lib/jpeg';
import type { Actor } from '@/lib/session';
import { syncCatalog } from '../../prisma/catalog/sync.mjs';
import { TINY_JPEG, withExif } from '../fixtures/jpeg';
import { resetDatabase } from './db-reset';

// The photo routes check the session through Auth.js; tests replace it
const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/auth', () => ({ auth: async () => session.current }));

const actor: Actor = { id: 'u-1', name: 'Mike Franz', email: 'mike.franz@ayanta.ch', roles: ['THERAPIST'] };
const CATALOG = path.resolve(__dirname, '../../prisma/catalog');

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

/** A patient with a valid signed disclaimer (as after consent-signing) */
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

const treatmentInput = (over: Record<string, string> = {}) =>
  treatmentSchema.parse({
    startedAt: '2026-10-01T09:15',
    regionId: '6',
    diagnosis: 'Lumbalgie rechts, ausstrahlend in die Leiste',
    painStart: '60',
    ...over,
  });

const consultationInput = (sheet: Partial<Sheet> = {}, over: Record<string, string> = {}) =>
  consultationSchema.parse({
    at: '2026-10-01T09:30',
    diagnosis: 'Lumbalgie rechts, ausstrahlend in die Leiste',
    painBefore: '',
    painAfter: '',
    comparison: '',
    sheet: JSON.stringify({ points: [], exercises: [], rolling: [], ...sheet }),
    ...over,
  });

beforeAll(async () => {
  await resetDatabase();
  await syncCatalog(db);
});
afterAll(resetDatabase);

describe('therapy catalog', () => {
  it('loads 12 areas, 72 points, 27 exercises and 4 tools; a second sync changes nothing (Erneutes Einspielen)', async () => {
    const c = await catalogView();
    expect([c.regions.length, c.points.length, c.exercises.length, c.tools.length]).toEqual([12, 72, 27, 4]);
    expect(c.regions.find((r) => r.id === 6)?.nameDe).toBe('Lendenwirbelsäule, Bauch');
    const before = await db.regionPoint.findMany({ orderBy: [{ regionId: 'asc' }, { sort: 'asc' }] });
    const stats = await syncCatalog(db);
    for (const s of Object.values(stats)) expect(s).toMatchObject({ created: 0, updated: 0, retired: 0 });
    expect(await db.regionPoint.findMany({ orderBy: [{ regionId: 'asc' }, { sort: 'asc' }] })).toEqual(before);
  });

  it('builds the form of area 6 and 12 in paper order (Punkte und Übungen eines Bereichs)', async () => {
    const six = await regionSheet(6);
    expect(six.points.map((p) => p.id)).toEqual([
      '2.1.1',
      '2.1.2',
      '2.2.1',
      '2.2.2',
      '2.3',
      '2.4',
      '2.5',
      '2.8.1',
      '2.8.2',
      '2.10',
      '2.11.1',
      '2.11.2',
      '2.12',
      '2.13',
      '4.5',
    ]);
    expect(six.points.some((p) => p.emphasis === 'main')).toBe(true);
    expect(six.exercises.map((x) => x.code)).toEqual(['1F', '2A', '2B', '2C', '2D']);
    expect((await regionSheet(12)).exercises.map((x) => x.code)).toEqual(['2F', '4B', '4C', '4D', '4E', '4F']);
  });

  it('marks exercises without rolling or variants as not captured (null)', async () => {
    const c = await catalogView();
    expect(c.exercises.find((x) => x.code === '2A')?.rolling).toHaveLength(3);
    expect(c.exercises.filter((x) => x.rolling === null)).toHaveLength(26);
  });

  it('retires a point removed from the files; existing consultations keep it (Punkt zurückgezogen)', async () => {
    const p = await signedPatient('Retired');
    const t = await createTreatment(actor, p.id, treatmentInput());
    const c = await createConsultation(
      actor,
      t.id,
      consultationInput({ points: [{ pointId: '4.5', left: true, right: false, sensitivity: 'LOW' }] }),
    );
    // Reference files without point 4.5
    const dir = await mkdtemp(path.join(os.tmpdir(), 'pt-catalog-'));
    await cp(CATALOG, dir, { recursive: true });
    const points = JSON.parse(await readFile(path.join(dir, 'osteopressure-points.json'), 'utf8')) as { id: string }[];
    await writeFile(path.join(dir, 'osteopressure-points.json'), JSON.stringify(points.filter((x) => x.id !== '4.5')));
    const csv = (await readFile(path.join(dir, 'region-points.csv'), 'utf8'))
      .split('\n')
      .filter((l) => !l.includes(',4.5,'))
      .join('\n');
    await writeFile(path.join(dir, 'region-points.csv'), csv);

    const stats = await syncCatalog(db, { dir });
    expect(stats.osteopressurePoint.retired).toBe(1);
    expect(stats.regionPoint.retired).toBeGreaterThan(0);
    expect((await regionSheet(6)).points.map((x) => x.id)).not.toContain('4.5');
    const existing = await regionSheet(6, { pointIds: ['4.5'] });
    expect(existing.points.find((x) => x.id === '4.5')).toMatchObject({ retired: true, extra: true });
    expect((await getConsultation(c.id))?.points[0].pointId).toBe('4.5');
    expect((await catalogView()).points.map((x) => x.id)).not.toContain('4.5');

    // Back in the files: active again
    const back = await syncCatalog(db);
    expect(back.osteopressurePoint.retired).toBe(0);
    expect((await db.osteopressurePoint.findUniqueOrThrow({ where: { id: '4.5' } })).retiredAt).toBeNull();
    expect((await regionSheet(6)).points.map((x) => x.id)).toContain('4.5');
  });
});

describe('treatments', () => {
  it('opens a treatment and lists treatments newest first (task 2.2)', async () => {
    const p = await signedPatient('Mueller');
    const older = await createTreatment(actor, p.id, treatmentInput({ regionId: '7', startedAt: '2026-09-02T14:00' }));
    const newer = await createTreatment(actor, p.id, treatmentInput());
    // Zweite Behandlung im selben Bereich
    const again = await createTreatment(actor, p.id, treatmentInput({ regionId: '7', startedAt: '2026-09-01T08:00' }));
    const list = await treatmentsOf(p.id);
    expect(list.map((t) => t.id)).toEqual([newer.id, older.id, again.id]);
    expect(list[0]).toMatchObject({
      regionId: 6,
      painStart: 60,
      diagnosis: 'Lumbalgie rechts, ausstrahlend in die Leiste',
    });
    expect((await historyOf(p.id)).filter((e) => e.action === 'treatment.created')).toHaveLength(3);
  });

  it('refuses inactive patients and patients without a valid signed disclaimer (both blocks)', async () => {
    const unsigned = await patient('Unsigned');
    expect(await openingBlocker(unsigned.id)).toBe('consent');
    await expect(createTreatment(actor, unsigned.id, treatmentInput())).rejects.toThrow(TreatmentError);
    await expect(createTreatment(actor, unsigned.id, treatmentInput())).rejects.toMatchObject({ code: 'consent' });

    const inactive = await signedPatient('Inactive');
    const t = await createTreatment(actor, inactive.id, treatmentInput());
    await setStatus(actor, inactive.id, 'INACTIVE', 'Umzug');
    expect(await openingBlocker(inactive.id)).toBe('inactive');
    await expect(createTreatment(actor, inactive.id, treatmentInput())).rejects.toMatchObject({ code: 'inactive' });
    await expect(createConsultation(actor, t.id, consultationInput())).rejects.toMatchObject({ code: 'inactive' });
    // Existing treatments stay visible
    expect(await treatmentsOf(inactive.id)).toHaveLength(1);
  });

  it('keeps old and new value of a changed diagnosis in the history (Diagnose korrigieren)', async () => {
    const p = await signedPatient('Diagnose');
    const t = await createTreatment(actor, p.id, treatmentInput());
    await updateTreatment(actor, t.id, treatmentInput({ diagnosis: 'Lumbalgie links', painStart: '70' }));
    const changes = (await historyOf(p.id)).filter((e) => e.action === 'treatment.updated');
    expect(changes.map((e) => [e.field, e.before, e.after]).sort()).toEqual([
      ['diagnosis', 'Lumbalgie rechts, ausstrahlend in die Leiste', 'Lumbalgie links'],
      ['painStart', '60', '70'],
    ]);
  });

  it('fixes the area after the first consultation; diagnosis and pain stay correctable (Bereich nach erster Konsultation)', async () => {
    const p = await signedPatient('Locked');
    const t = await createTreatment(actor, p.id, treatmentInput());
    // Before any consultation the area can still be corrected
    await updateTreatment(actor, t.id, treatmentInput({ regionId: '4' }));
    await createConsultation(actor, t.id, consultationInput());
    await expect(updateTreatment(actor, t.id, treatmentInput({ regionId: '6' }))).rejects.toMatchObject({
      code: 'regionLocked',
    });
    // The start may not move past the first consultation (09:30)
    await expect(
      updateTreatment(actor, t.id, treatmentInput({ regionId: '4', startedAt: '2026-10-01T10:00' })),
    ).rejects.toMatchObject({ code: 'startAfterConsultation' });
    await updateTreatment(
      actor,
      t.id,
      treatmentInput({ regionId: '4', startedAt: '2026-10-01T09:30', diagnosis: 'Lumbalgie links', painStart: '50' }),
    );
    const saved = await db.treatment.findUniqueOrThrow({ where: { id: t.id } });
    expect([saved.regionId, saved.diagnosis, saved.painStart]).toEqual([4, 'Lumbalgie links', 50]);
  });

  it('cannot be deleted (database trigger)', async () => {
    const p = await signedPatient('NoDelete');
    const t = await createTreatment(actor, p.id, treatmentInput());
    await expect(db.treatment.delete({ where: { id: t.id } })).rejects.toThrow(/cannot be deleted/);
  });
});

describe('consultations', () => {
  it('numbers consultations per treatment and takes over the diagnosis (task 3.2)', async () => {
    const p = await signedPatient('Nummer');
    const t = await createTreatment(actor, p.id, treatmentInput());
    const other = await createTreatment(actor, p.id, treatmentInput({ regionId: '7' }));
    const first = await createConsultation(actor, t.id, consultationInput());
    const second = await createConsultation(actor, t.id, consultationInput({}, { diagnosis: 'Lumbalgie, besser' }));
    // Concurrent saves still get distinct numbers
    const [third, fourth] = await Promise.all([
      createConsultation(actor, t.id, consultationInput()),
      createConsultation(actor, t.id, consultationInput()),
    ]);
    const onOther = await createConsultation(actor, other.id, consultationInput());
    expect([first.number, second.number, [third.number, fourth.number].sort()]).toEqual([1, 2, [3, 4]]);
    expect(onOther.number).toBe(1);
    expect(first.diagnosis).toBe('Lumbalgie rechts, ausstrahlend in die Leiste');
    // Diagnose überschreiben: the treatment keeps its own diagnosis
    expect(second.diagnosis).toBe('Lumbalgie, besser');
    expect((await db.treatment.findUniqueOrThrow({ where: { id: t.id } })).diagnosis).toBe(
      'Lumbalgie rechts, ausstrahlend in die Leiste',
    );
    // The number stays when date and time are corrected
    await updateConsultation(actor, first.id, consultationInput({}, { at: '2026-10-02T08:00' }));
    expect((await getConsultation(first.id))?.number).toBe(1);
    const list = await treatmentsOf(p.id);
    expect(list.find((x) => x.id === t.id)?.consultations.map((c) => c.number)).toEqual([4, 3, 2, 1]);
  });

  it('stores the form: points, exercise, rolling and pain before and after', async () => {
    const p = await signedPatient('Bogen');
    const t = await createTreatment(actor, p.id, treatmentInput());
    const c = await createConsultation(
      actor,
      t.id,
      consultationInput(
        {
          points: [{ pointId: '2.11.1', left: false, right: true, sensitivity: 'STRONG' }],
          exercises: [{ code: '2D', prescribed: true, difficulty: 'HARD', variants: null }],
          rolling: [{ position: 1, area: 'Beckenkamm', toolCode: 'MiKu' }],
        },
        { painBefore: '60', painAfter: '30', comparison: 'Morgens besser' },
      ),
    );
    const stored = (await getConsultation(c.id))!;
    expect(stored).toMatchObject({ painBefore: 60, painAfter: 30, comparison: 'Morgens besser' });
    expect(sheetOf(stored)).toEqual({
      points: [{ pointId: '2.11.1', left: false, right: true, sensitivity: 'STRONG' }],
      exercises: [{ code: '2D', prescribed: true, difficulty: 'HARD', variants: null }],
      rolling: [{ position: 1, area: 'Beckenkamm', toolCode: 'MiKu' }],
      home: [{ code: '2D', repetition: 'DAILY_1', intensity: null, steps: null, note: null }],
    });
    // Unknown catalog entries are refused
    await expect(
      createConsultation(
        actor,
        t.id,
        consultationInput({ points: [{ pointId: '9.9', left: true, right: false, sensitivity: null }] }),
      ),
    ).rejects.toMatchObject({ code: 'catalog' });
  });

  it('records every change of the form in the history (Empfindlichkeit korrigieren)', async () => {
    const p = await signedPatient('Korrektur');
    const t = await createTreatment(actor, p.id, treatmentInput());
    const point = { pointId: '2.11.1', left: false, right: true, sensitivity: 'STRONG' as const };
    const c = await createConsultation(actor, t.id, consultationInput({ points: [point] }));
    await updateConsultation(
      actor,
      c.id,
      consultationInput({ points: [{ ...point, sensitivity: 'MEDIUM' }] }, { painAfter: '20' }),
    );
    expect((await getConsultation(c.id))?.points[0].sensitivity).toBe('MEDIUM');
    const events = (await historyOf(p.id)).filter((e) => e.action === 'consultation.updated');
    expect(events.map((e) => [e.field, e.before, e.after]).sort()).toEqual([
      ['painAfter', null, '20'],
      ['point:2.11.1:sensitivity', 'STRONG', 'MEDIUM'],
    ]);
    expect(events[0].details).toMatchObject({ number: 1, regionId: 6 });
    await expect(db.consultation.delete({ where: { id: c.id } })).rejects.toThrow(/cannot be deleted/);
  });
});

describe('clinical photos', () => {
  it('stores photos without location data, delivers them only with a role and logs full views', async () => {
    const { photoResponse } = await import('@/lib/photo-route');
    const p = await signedPatient('Foto');
    const t = await createTreatment(actor, p.id, treatmentInput(), [
      { data: withExif(TINY_JPEG), thumb: TINY_JPEG, takenAt: '2026-10-13T07:15:02.000Z' },
    ]);
    const [photo] = await db.clinicalPhoto.findMany({ where: { treatmentId: t.id } });
    expect(photo).toMatchObject({ width: 64, height: 48, uploadedBy: 'Mike Franz', consultationId: null });
    expect(photo.takenAt.toISOString()).toBe('2026-10-13T07:15:02.000Z');
    const file = await photoStore().get(photo.blobPath);
    expect(sha256(file)).toBe(photo.sha256);
    // Standort entfernt: no EXIF (GPS) left in the stored file
    expect(file.includes('Exif')).toBe(false);
    expect(exifDateTime(file)).toBeNull();

    // Zugriff ohne Anmeldung
    session.current = null;
    let res = await photoResponse(photo.id, 'full');
    expect(res.status).toBe(403);
    session.current = { user: { id: 'u-2', name: 'Ohne Rolle', roles: [] } };
    expect((await photoResponse(photo.id, 'full')).status).toBe(403);

    session.current = { user: { id: 'u-1', name: 'Mike Franz', roles: ['THERAPIST'] } };
    res = await photoResponse(photo.id, 'thumb');
    expect(res.status).toBe(200);
    res = await photoResponse(photo.id, 'full');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/jpeg');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(Buffer.from(await res.arrayBuffer()).equals(file)).toBe(true);
    const views = await db.auditEvent.findMany({ where: { patientId: p.id, action: 'photo.viewed' } });
    expect(views).toHaveLength(1);
    // Views are logged but not part of the change history
    expect((await historyOf(p.id)).some((e) => e.action === 'photo.viewed')).toBe(false);
  });

  it('removes a photo from view only, keeps the file and notes it in the history (task 4.5)', async () => {
    const { photoResponse } = await import('@/lib/photo-route');
    const p = await signedPatient('Entfernen');
    const t = await createTreatment(actor, p.id, treatmentInput());
    const c = await createConsultation(actor, t.id, consultationInput(), [{ data: TINY_JPEG }, { data: TINY_JPEG }]);
    const photos = await db.clinicalPhoto.findMany({ where: { consultationId: c.id } });
    expect(photos).toHaveLength(2);
    await updateConsultation(actor, c.id, consultationInput(), { remove: [photos[0].id] });
    const removed = await db.clinicalPhoto.findUniqueOrThrow({ where: { id: photos[0].id } });
    expect(removed.removedAt).not.toBeNull();
    expect(removed.removedBy).toBe('Mike Franz');
    expect(await photoStore().get(removed.blobPath)).toBeInstanceOf(Buffer);
    session.current = { user: { id: 'u-1', name: 'Mike Franz', roles: ['THERAPIST'] } };
    expect((await photoResponse(removed.id, 'full')).status).toBe(404);
    const list = await treatmentsOf(p.id);
    expect(list[0].consultations[0]._count.photos).toBe(1);
    const history = await historyOf(p.id);
    expect(history.filter((e) => e.action === 'photo.added')).toHaveLength(2);
    expect(history.filter((e) => e.action === 'photo.removed')).toHaveLength(1);
    await expect(db.clinicalPhoto.delete({ where: { id: photos[1].id } })).rejects.toThrow(/cannot be deleted/);
  });

  it('saves treatments and consultations without photos (Ohne Fotos)', async () => {
    const p = await signedPatient('OhneFoto');
    const t = await createTreatment(actor, p.id, treatmentInput(), []);
    await createConsultation(actor, t.id, consultationInput());
    expect(await db.clinicalPhoto.count({ where: { treatmentId: t.id } })).toBe(0);
  });
});
