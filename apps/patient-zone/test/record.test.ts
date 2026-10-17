import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmLink, resolveSession, type ZoneSession } from '@/lib/access';
import { setDocumentStore } from '@/lib/media';
import { documentOf, documentsOf, treatmentOf, treatmentsOf } from '@/lib/record';
import { GET as documentRoute } from '@/app/dokumente/[nr]/route';
import { admin, ago, consultation, DOB, now, patient, resetDatabase, setup } from './fixtures';

/**
 * zone-record and zone-documents in the patient zone, run with the role patient_zone (iteration 6, tasks 3.3, 4.3):
 * only the own treatments and documents, another patient's ids like unknown ones, no photos.
 */

const session = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/lib/session', () => ({ getZoneSession: async () => session.current }));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
  notFound: () => {
    throw new Error('notFound');
  },
}));

/** test/setup.ts points the document archive here */
const DOCS = process.env.STORAGE_LOCAL_DIR!;

beforeEach(async () => {
  await resetDatabase();
  session.current = null;
  setDocumentStore(null);
});
afterAll(() => admin.$disconnect());

async function signedIn(): Promise<{ zone: ZoneSession; patientId: string; consultationId: string }> {
  const s = await setup();
  const r = await confirmLink({ token: s.token, ...DOB, ip: '203.0.113.7' }, ago(0, 3));
  if (!r.ok) throw new Error('not signed in');
  const zone = (await resolveSession(r.sessionId, now))!;
  session.current = zone;
  return { zone, patientId: s.patient.id, consultationId: s.consultation.id };
}

let counter = 0;
/** A signed disclaimer of the patient with its PDF in the local archive, like the practice app stores it */
async function disclaimer(patientId: string) {
  const text =
    (await admin.consentTextVersion.findFirst()) ??
    (await admin.consentTextVersion.create({
      data: { version: 1, language: 'de', title: 'T', body: 'B', publishedBy: 'Test' },
    }));
  const s = await admin.signatureSession.create({
    data: {
      patientId,
      textVersionId: text.id,
      language: 'de',
      status: 'SIGNED',
      channel: 'PATIENT_ZONE',
      startedBy: 'patient-zone',
      completedAt: ago(2),
    },
  });
  const documentNumber = `PT-2026-${String(++counter).padStart(5, '0')}`;
  await admin.signedDocument.create({
    data: {
      documentNumber,
      patientId,
      sessionId: s.id,
      textVersion: 1,
      language: 'de',
      blobPath: `${patientId}/${documentNumber}.pdf`,
      sha256: '0',
      sizeBytes: 9,
    },
  });
  await mkdir(path.join(DOCS, patientId), { recursive: true });
  await writeFile(path.join(DOCS, patientId, `${documentNumber}.pdf`), `%PDF-${documentNumber}`);
  return documentNumber;
}

async function sheet(patientId: string, consultationId: string, version: number) {
  const documentNumber = `PT-2026-${String(++counter).padStart(5, '0')}`;
  await admin.exerciseHandout.create({
    data: {
      documentNumber,
      patientId,
      consultationId,
      version,
      language: 'de',
      prescriptions: [],
      blobPath: `${patientId}/${documentNumber}.pdf`,
      sha256: '0',
      sizeBytes: 9,
      createdBy: 'Christina Franz',
      createdAt: ago(5 - version),
    },
  });
  await mkdir(path.join(DOCS, patientId), { recursive: true });
  await writeFile(path.join(DOCS, patientId, `${documentNumber}.pdf`), `%PDF-${documentNumber}`);
  return documentNumber;
}

describe('treatments (Behandlungen)', () => {
  it('lists only the own treatments, newest first, with consultations', async () => {
    const { zone, patientId, consultationId } = await signedIn();
    const treatmentId = (await admin.consultation.findUniqueOrThrow({ where: { id: consultationId } })).treatmentId;
    await consultation(patientId, ago(3), [['2A', 1]], treatmentId);
    await consultation(patientId, ago(40), []);
    await consultation((await patient()).id, ago(1), []);
    const list = await treatmentsOf(zone);
    expect(list.map((t) => [t.consultations, t.region, t.diagnosis, t.painStart])).toEqual([
      [2, '2.3 Lendenwirbelsäule', 'Geheime Diagnose', 60],
      [1, '2.3 Lendenwirbelsäule', 'Geheime Diagnose', 60],
    ]);
    expect(list[0].lastAt).toEqual(ago(3));
  });

  it('shows the sessions with points, exercises with their EPD and home program, without photos', async () => {
    const { zone, patientId, consultationId } = await signedIn();
    await admin.osteopressurePoint.create({
      data: { id: '2.2.1', group: 2, muscleAttachmentLatin: 'Os sacrum', attachmentDe: 'Kreuzbein', sort: 1 },
    });
    await admin.consultationPoint.create({ data: { consultationId, pointId: '2.2.1', left: true } });
    await admin.consultationExercise.create({
      data: { consultationId, exerciseCode: '2A', prescribed: true, difficulty: 'EASY', variant: 2 },
    });
    const c = await admin.consultation.findUniqueOrThrow({ where: { id: consultationId } });
    await admin.consultation.update({ where: { id: consultationId }, data: { painAfter: 30, comparison: 'besser' } });
    await admin.clinicalPhoto.create({
      data: {
        treatmentId: c.treatmentId,
        consultationId,
        blobPath: 'p.jpg',
        thumbPath: 't.jpg',
        sha256: '0',
        width: 1,
        height: 1,
        sizeBytes: 1,
        takenAt: now,
        uploadedBy: 'Christina Franz',
      },
    });
    const nr = await sheet(patientId, consultationId, 1);
    const newer = await sheet(patientId, consultationId, 2);
    const t = await treatmentOf(zone, c.treatmentId);
    expect(t?.consultations).toHaveLength(1);
    const k = t!.consultations[0];
    expect(k).toMatchObject({
      number: 1,
      painBefore: 60,
      painAfter: 30,
      comparison: 'besser',
      points: [{ id: '2.2.1', name: 'Kreuzbein', left: true, right: false }],
      exercises: [{ code: '2A', name: 'Übung 2A', variant: 2 }],
      home: [
        { code: '1F', schedule: { timesPerDay: 1, weekdays: 127 }, variant: null },
        { code: '2A', schedule: { timesPerDay: 2, weekdays: 127 }, variant: null },
        { code: '2D', schedule: { timesPerDay: 1, weekdays: 31 }, variant: null },
      ],
      sheet: newer,
    });
    expect(nr).not.toBe(newer);
    expect(JSON.stringify(t)).not.toMatch(/photo|p\.jpg|Christina|createdBy|Notiz Therapeutin/i);
  });

  it("treats another patient's treatment like an unknown one (fremde Behandlung 404)", async () => {
    const { zone } = await signedIn();
    const other = await consultation((await patient()).id, ago(2), []);
    expect(await treatmentOf(zone, other.treatmentId)).toBeNull();
    expect(await treatmentOf(zone, 'unknown')).toBeNull();
  });

  it('shows an empty list without treatments (Noch keine Behandlung)', async () => {
    const { zone } = await signedIn();
    expect(await treatmentsOf({ ...zone, patient: { ...zone.patient, id: (await patient()).id } })).toEqual([]);
  });
});

describe('documents (Dokumente)', () => {
  it('lists own disclaimers, pending signatures and exercise sheets with the current version', async () => {
    const { zone, patientId, consultationId } = await signedIn();
    const d = await disclaimer(patientId);
    const v1 = await sheet(patientId, consultationId, 1);
    const v2 = await sheet(patientId, consultationId, 2);
    await disclaimer((await patient()).id);
    const text = await admin.consentTextVersion.findFirstOrThrow();
    await admin.signatureSession.create({
      data: {
        patientId,
        textVersionId: text.id,
        language: 'de',
        status: 'SIGNED',
        channel: 'PATIENT_ZONE',
        startedBy: 'patient-zone',
        completedAt: now,
      },
    });
    const docs = await documentsOf(zone);
    expect(docs.disclaimers.map((x) => [x.documentNumber, x.channel])).toEqual([[d, 'PATIENT_ZONE']]);
    expect(docs.pending).toHaveLength(1);
    expect(docs.sheets.map((x) => [x.documentNumber, x.version, x.current])).toEqual([
      [v2, 2, true],
      [v1, 1, false],
    ]);
  });

  it('delivers the own PDF unchanged and logs it; another number is not found (fremde Nummer 404)', async () => {
    const { zone, patientId } = await signedIn();
    const d = await disclaimer(patientId);
    const foreign = await disclaimer((await patient()).id);
    expect(await documentOf(zone, foreign)).toBeNull();
    const call = (nr: string) =>
      documentRoute(new Request(`http://zone/dokumente/${nr}`), { params: Promise.resolve({ nr }) });
    const res = await call(d);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/pdf');
    expect(res.headers.get('content-disposition')).toBe(`inline; filename="${d}.pdf"`);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe(`%PDF-${d}`);
    const audit = await admin.auditEvent.findFirstOrThrow({ where: { action: 'document.viewedInZone' } });
    expect(audit).toMatchObject({ patientId, after: d, userName: 'Patienten-Zone' });
    expect((await call(foreign)).status).toBe(404);
    expect((await call('../../etc/passwd')).status).toBe(404);
    expect(await admin.auditEvent.count({ where: { action: 'document.viewedInZone' } })).toBe(1);
  });

  it('gives no PDF without a session (Sitzung beendet)', async () => {
    const { patientId } = await signedIn();
    const d = await disclaimer(patientId);
    session.current = null;
    await expect(
      documentRoute(new Request(`http://zone/dokumente/${d}`), { params: Promise.resolve({ nr: d }) }),
    ).rejects.toThrow('redirect /');
  });
});
