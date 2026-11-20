import 'server-only';
import { zipSync, strToU8 } from 'fflate';
import { runInPractice } from '@pain-therapy/shared/practice-context';
import { rawDb } from './db';
import { audit } from './audit';
import { documentStore, exportStore, photoStore } from './storage';
import type { Actor } from './session';

/**
 * Export of a practice (iteration 12, design D9): a ZIP with every PDF, every photo and the data of all tables as
 * JSON, built in the background and downloadable for 24 hours by the practice admin and the platform administrator.
 * Hashes of tokens and sessions stay out.
 */

export const EXPORT_TTL_MS = 24 * 3600_000;

/** Tables with practice rows, in the order a reader understands them */
const TABLES = [
  'Patient',
  'Anamnesis',
  'Treatment',
  'Consultation',
  'ConsultationPoint',
  'ConsultationExercise',
  'HomePrescription',
  'ClinicalPhoto',
  'ConsentTextVersion',
  'SignatureSession',
  'Consent',
  'SignedDocument',
  'EmailDelivery',
  'ExerciseHandout',
  'HandoutDelivery',
  'PatientAccessLink',
  'AccessLinkDelivery',
  'PatientZoneSession',
  'ExerciseLogEntry',
  'DocumentCounter',
  'AuditEvent',
] as const;

/** Columns that never leave the database: hashes of links, sessions and IP addresses */
const SECRET = /(Hash|hash)$/;

export async function requestExport(actor: Actor, practiceId: string) {
  const row = await rawDb.practiceExport.create({ data: { practiceId, requestedBy: actor.name } });
  await runInPractice(practiceId, () => audit(actor, 'practice.exported', { details: { exportId: row.id } }));
  return row;
}

const json = (rows: unknown) =>
  strToU8(
    JSON.stringify(
      rows,
      (key, value) => {
        if (SECRET.test(key)) return undefined;
        // Logo and other binary columns go as files
        if (value && typeof value === 'object' && (value.type === 'Buffer' || value instanceof Uint8Array))
          return undefined;
        return typeof value === 'bigint' ? Number(value) : value;
      },
      2,
    ),
  );

/** Builds the ZIP of an export and stores it; a failure is kept on the row */
export async function buildExport(exportId: string) {
  const row = await rawDb.practiceExport.findUnique({ where: { id: exportId } });
  if (!row || row.status !== 'PENDING') return row;
  try {
    const practiceId = row.practiceId;
    const files: Record<string, Uint8Array> = {};
    const practice = await rawDb.practice.findUniqueOrThrow({ where: { id: practiceId } });
    files['practice.json'] = json({ ...practice, logo: undefined });
    if (practice.logo && practice.logoType)
      files[`logo.${practice.logoType === 'image/png' ? 'png' : 'jpg'}`] = new Uint8Array(practice.logo);
    const members = await rawDb.practiceMembership.findMany({
      where: { practiceId },
      select: { roles: true, active: true, createdAt: true, user: { select: { name: true, email: true } } },
    });
    files['data/Team.json'] = json(members);
    for (const table of TABLES)
      files[`data/${table}.json`] = json(
        await rawDb.$queryRawUnsafe(`SELECT * FROM "${table}" WHERE "practiceId" = $1 ORDER BY 1`, practiceId),
      );
    const docs = [
      ...(await rawDb.signedDocument.findMany({
        where: { practiceId },
        select: { documentNumber: true, blobPath: true },
      })),
      ...(await rawDb.exerciseHandout.findMany({
        where: { practiceId },
        select: { documentNumber: true, blobPath: true },
      })),
    ];
    for (const d of docs) files[`documents/${d.documentNumber}.pdf`] = await documentStore().get(d.blobPath);
    const photos = await rawDb.clinicalPhoto.findMany({
      where: { practiceId },
      select: { id: true, treatmentId: true, blobPath: true },
    });
    for (const p of photos) files[`photos/${p.treatmentId}/${p.id}.jpg`] = await photoStore().get(p.blobPath);
    files['LIESMICH.txt'] = strToU8(
      `Export der Praxis ${practice.name} (${practice.slug}), erstellt ${new Date().toISOString()}.\n\n` +
        'documents/: unterschriebene Formulare und Übungsblätter (PDF, unverändert aus dem Archiv)\n' +
        'photos/: Fotos pro Behandlung (Ordner = Behandlungs-ID)\n' +
        'data/: alle Daten der Praxis als JSON, eine Datei pro Tabelle\n',
    );
    const zip = Buffer.from(zipSync(files, { level: 6 }));
    const blobPath = `${practiceId}/${row.id}.zip`;
    await exportStore().put(blobPath, zip, 'application/zip');
    return rawDb.practiceExport.update({
      where: { id: row.id },
      data: {
        status: 'DONE',
        blobPath,
        sizeBytes: zip.length,
        finishedAt: new Date(),
        expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
      },
    });
  } catch (e) {
    console.error(`export ${row.id} failed`, e);
    return rawDb.practiceExport.update({
      where: { id: row.id },
      data: {
        status: 'FAILED',
        error: (e instanceof Error ? e.message : String(e)).slice(0, 300),
        finishedAt: new Date(),
      },
    });
  }
}

/** The newest exports of a practice for its page */
export async function exportsOf(practiceId: string) {
  return rawDb.practiceExport.findMany({
    where: { practiceId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { id: true, status: true, requestedBy: true, sizeBytes: true, createdAt: true, expiresAt: true },
  });
}

/** The ZIP of a finished export that has not expired; `practiceId` null for the platform administrator */
export async function exportFile(exportId: string, practiceId: string | null) {
  const row = await rawDb.practiceExport.findUnique({ where: { id: exportId } });
  if (!row || row.status !== 'DONE' || !row.blobPath || !row.expiresAt || row.expiresAt.getTime() < Date.now())
    return null;
  if (practiceId !== null && row.practiceId !== practiceId) return null;
  const practice = await rawDb.practice.findUniqueOrThrow({ where: { id: row.practiceId }, select: { slug: true } });
  return {
    data: await exportStore().get(row.blobPath),
    name: `${practice.slug}-export-${row.createdAt.toISOString().slice(0, 10)}.zip`,
  };
}

/** Job: removes ZIPs after their 24 hours and builds exports left pending (e.g. after a restart) */
export async function exportHousekeeping(now = new Date()) {
  const expired = await rawDb.practiceExport.findMany({
    where: { status: 'DONE', blobPath: { not: null }, expiresAt: { lt: now } },
    select: { id: true, blobPath: true },
  });
  for (const e of expired) {
    await exportStore()
      .delete(e.blobPath!)
      .catch((err) => console.error(`export ${e.id}: delete failed`, err));
    await rawDb.practiceExport.update({ where: { id: e.id }, data: { blobPath: null } });
  }
  const stale = await rawDb.practiceExport.findMany({
    where: { status: 'PENDING', createdAt: { lt: new Date(now.getTime() - 10 * 60_000) } },
    select: { id: true },
  });
  for (const s of stale) await buildExport(s.id);
  return { expired: expired.length, built: stale.length };
}
