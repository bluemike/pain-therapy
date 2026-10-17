/**
 * therapy-catalog: Erstbefüllung und Änderungen (design D2).
 * Loads the reference files in this folder into Region, OsteopressurePoint, RegionPoint, Exercise, RegionExercise
 * and RollingTool. Idempotent: unchanged rows are not written. Nothing is deleted; entries missing from the files
 * get `retiredAt` and come back to life when they reappear.
 *
 * exercise-library (iteration 3, design D2): ExerciseSheet takes file names and timing from exercise-sheets.json
 * and the texts from `exercises-content.json` in the private container `exercise-media` (STORAGE_DRIVER=azure) or
 * the local folder STORAGE_EXERCISE_LOCAL_DIR. Without that file the texts stay as they are ("noch nicht erfasst"
 * on a fresh database); the deployment does not fail because of it.
 *
 * Plain JavaScript so it runs in the production image without a build step:
 *   node prisma/catalog/sync.mjs        (migration job, after `prisma migrate deploy`; locally `npm run catalog:sync`)
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import prisma from '@prisma/client';

const { Prisma, PrismaClient } = prisma;

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function json(dir, name) {
  return JSON.parse(await readFile(path.join(dir, name), 'utf8'));
}

/** Minimal CSV reader for the reference tables (header row, comma separated, no quoting). */
async function csv(dir, name) {
  const [head, ...lines] = (await readFile(path.join(dir, name), 'utf8')).split(/\r?\n/).filter((l) => l.trim());
  const cols = head.split(',');
  return lines.map((l) => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v.trim()])));
}

/** "TODO" in the reference files means "not yet captured" and is stored as SQL NULL. */
const captured = (v) => (Array.isArray(v) ? v : Prisma.DbNull);

const CONTENT_FILE = 'exercises-content.json';

/**
 * Reads `exercises-content.json` from the exercise media (container or local folder). Returns null when the file is
 * missing or cannot be read, with a warning in the log.
 */
export async function readExerciseContent(env = process.env) {
  try {
    if (env.STORAGE_DRIVER === 'azure') {
      const { BlobServiceClient } = await import('@azure/storage-blob');
      const service = env.AZURE_STORAGE_CONNECTION_STRING
        ? BlobServiceClient.fromConnectionString(env.AZURE_STORAGE_CONNECTION_STRING)
        : new BlobServiceClient(
            env.AZURE_STORAGE_ACCOUNT_URL ?? '',
            new (await import('@azure/identity')).DefaultAzureCredential(),
          );
      const blob = service
        .getContainerClient(env.AZURE_STORAGE_EXERCISE_CONTAINER || 'exercise-media')
        .getBlockBlobClient(CONTENT_FILE);
      return JSON.parse((await blob.downloadToBuffer()).toString('utf8'));
    }
    const dir = env.STORAGE_EXERCISE_LOCAL_DIR || './data/exercise-media';
    return JSON.parse(await readFile(path.join(dir, CONTENT_FILE), 'utf8'));
  } catch (e) {
    const missing = e?.code === 'ENOENT' || e?.statusCode === 404;
    console.warn(
      `catalog:sync ${CONTENT_FILE}: ${missing ? 'not found' : (e?.message ?? e)}; exercise texts unchanged`,
    );
    return null;
  }
}

const text = (v) => {
  const t = (Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : '').trim();
  return t || null;
};

/**
 * Brings the texts of one sheet into the stored shape { rolling, steps: [{ label, text }], variants }; null if
 * nothing is there. Accepts the sections at the top level or under `sections`, steps as a list of { label, text }
 * or of strings (labelled from exercise-sheets.json).
 */
export function normalizeContent(entry, stepLabels = []) {
  if (!entry || typeof entry !== 'object') return null;
  const src = entry.sections && typeof entry.sections === 'object' ? entry.sections : entry;
  const rawSteps = Array.isArray(src.steps) ? src.steps : Array.isArray(src.stretch) ? src.stretch : [];
  let steps = rawSteps
    .map((s, i) =>
      typeof s === 'string'
        ? { label: stepLabels[i] ?? `${i + 1}`, text: text(s) }
        : { label: String(s?.label ?? stepLabels[i] ?? `${i + 1}`), text: text(s?.text) },
    )
    .filter((s) => s.text);
  if (!steps.length && typeof src.stretch === 'string' && text(src.stretch))
    steps = [{ label: '', text: text(src.stretch) }];
  const out = {
    rolling: text(src.rolling),
    steps,
    variants: text(src.variants),
  };
  return out.rolling || steps.length || out.variants ? out : null;
}

/** Entries of exercises-content.json by code: a list of { code, … }, { exercises: [...] } or { "1A": {…}, … } */
export function contentByCode(content) {
  if (!content) return null;
  const list = Array.isArray(content)
    ? content
    : Array.isArray(content.exercises)
      ? content.exercises
      : Object.entries(content).map(([code, v]) => ({ ...(v && typeof v === 'object' ? v : {}), code }));
  return new Map(list.filter((x) => x && typeof x.code === 'string').map((x) => [x.code, x]));
}

/**
 * Reads and checks the reference files; returns the rows per table keyed by their primary key.
 * `content`: parsed exercises-content.json, or null when it is not available (texts are then left unchanged).
 */
export async function readCatalog(dir = HERE, content = null) {
  const [regions, points, exercises, tools, regionPoints, regionExercises, sheets] = await Promise.all([
    json(dir, 'regions.json'),
    json(dir, 'osteopressure-points.json'),
    json(dir, 'exercises.json'),
    json(dir, 'rolling-tools.json'),
    csv(dir, 'region-points.csv'),
    csv(dir, 'region-exercises.csv'),
    json(dir, 'exercise-sheets.json'),
  ]);
  const texts = contentByCode(content);
  const rows = {
    region: regions.map((r) => ({ id: r.id, nameDe: r.nameDe, nameEn: r.nameEn, sheetTitle: r.sheetTitle })),
    osteopressurePoint: points.map((p, i) => ({
      id: p.id,
      group: p.group,
      muscleAttachmentLatin: p.muscleAttachmentLatin,
      attachmentDe: p.attachmentDe,
      sort: i + 1,
    })),
    exercise: exercises.map((x, i) => ({
      code: x.code,
      group: x.group,
      nameDe: x.nameDe,
      nameEn: x.nameEn,
      stretchSteps: x.stretchSteps ?? null,
      rolling: captured(x.rolling),
      variants: captured(x.variants),
      source: x.source ?? null,
      sort: i + 1,
    })),
    rollingTool: tools.map((t, i) => ({ code: t.code, nameDe: t.nameDe, nameEn: t.nameEn, sort: i + 1 })),
    regionPoint: regionPoints.map((r) => ({
      regionId: Number(r.regionId),
      pointId: r.pointId,
      emphasis: r.emphasis,
      sort: Number(r.sort),
    })),
    regionExercise: regionExercises.map((r) => ({
      regionId: Number(r.regionId),
      exerciseCode: r.exerciseCode,
      sort: Number(r.sort),
    })),
    exerciseSheet: sheets.map((x) => ({
      exerciseCode: x.code,
      sheetPage: x.sheetPage,
      title: x.title,
      mainImage: x.mainImage,
      sheetImage: x.sheetImage,
      stepLabels: x.stretchStepLabels ?? [],
      stretchSecondsPerSide: x.timing?.stretchSecondsPerSide ?? null,
      sides: x.timing?.sides ?? 1,
      rollingSeconds: x.timing?.rollingSeconds ?? null,
      timingSource: x.timing?.source ?? null,
      timingTodo: x.timing?.todo?.length ? x.timing.todo : Prisma.DbNull,
      // Only written when the content file was read, so a missing file never wipes texts
      ...(texts ? { content: normalizeContent(texts.get(x.code), x.stretchStepLabels) ?? Prisma.DbNull } : {}),
    })),
  };
  // Referential checks, so a typo in a file fails the deployment instead of the database
  const regionIds = new Set(rows.region.map((r) => r.id));
  const pointIds = new Set(rows.osteopressurePoint.map((p) => p.id));
  const codes = new Set(rows.exercise.map((x) => x.code));
  for (const r of rows.regionPoint) {
    if (!regionIds.has(r.regionId) || !pointIds.has(r.pointId))
      throw new Error(`region-points.csv: ${JSON.stringify(r)}`);
    if (!['main', 'relevant', 'standard'].includes(r.emphasis)) throw new Error(`Unknown emphasis ${r.emphasis}`);
  }
  for (const r of rows.regionExercise)
    if (!regionIds.has(r.regionId) || !codes.has(r.exerciseCode))
      throw new Error(`region-exercises.csv: ${JSON.stringify(r)}`);
  const seconds = (v) => v === null || (Number.isInteger(v) && v > 0 && v <= 3600);
  for (const x of rows.exerciseSheet) {
    if (!codes.has(x.exerciseCode)) throw new Error(`exercise-sheets.json: unknown code ${x.exerciseCode}`);
    if (!seconds(x.stretchSecondsPerSide) || !seconds(x.rollingSeconds) || ![1, 2].includes(x.sides))
      throw new Error(`exercise-sheets.json: timing of ${x.exerciseCode}`);
    if (!/^[\w.-]+$/.test(x.mainImage) || !/^[\w.-]+$/.test(x.sheetImage))
      throw new Error(`exercise-sheets.json: file names of ${x.exerciseCode}`);
  }
  if (texts)
    for (const code of texts.keys())
      if (!codes.has(code)) console.warn(`catalog:sync ${CONTENT_FILE}: unknown code ${code} ignored`);
  return rows;
}

const TABLES = [
  // Parents before children (foreign keys)
  { model: 'region', key: (r) => String(r.id), where: (r) => ({ id: r.id }) },
  { model: 'osteopressurePoint', key: (r) => r.id, where: (r) => ({ id: r.id }) },
  { model: 'exercise', key: (r) => r.code, where: (r) => ({ code: r.code }) },
  { model: 'rollingTool', key: (r) => r.code, where: (r) => ({ code: r.code }) },
  {
    model: 'regionPoint',
    key: (r) => `${r.regionId}|${r.pointId}`,
    where: (r) => ({ regionId_pointId: { regionId: r.regionId, pointId: r.pointId } }),
  },
  {
    model: 'regionExercise',
    key: (r) => `${r.regionId}|${r.exerciseCode}`,
    where: (r) => ({ regionId_exerciseCode: { regionId: r.regionId, exerciseCode: r.exerciseCode } }),
  },
  { model: 'exerciseSheet', key: (r) => r.exerciseCode, where: (r) => ({ exerciseCode: r.exerciseCode }) },
];

/** Key-order independent comparison (jsonb does not keep the key order of the files). */
function canon(v) {
  if (v === Prisma.DbNull || v === undefined) return null;
  if (Array.isArray(v)) return v.map(canon);
  if (v && typeof v === 'object' && !(v instanceof Date))
    return Object.fromEntries(
      Object.keys(v)
        .sort()
        .map((k) => [k, canon(v[k])]),
    );
  return v;
}
const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

/**
 * Writes the catalog. Returns per table how many rows were created, updated, retired and left unchanged.
 * `content` replaces reading exercises-content.json from the exercise media (tests); null means not available.
 * @param {import('@prisma/client').PrismaClient} db
 */
export async function syncCatalog(db, { dir = HERE, now = new Date(), content } = {}) {
  const wanted = await readCatalog(dir, content === undefined ? await readExerciseContent() : content);
  const stats = {};
  await db.$transaction(
    async (tx) => {
      for (const t of TABLES) {
        const s = (stats[t.model] = { created: 0, updated: 0, retired: 0, unchanged: 0 });
        const existing = new Map((await tx[t.model].findMany()).map((r) => [t.key(r), r]));
        const seen = new Set();
        for (const row of wanted[t.model]) {
          const k = t.key(row);
          seen.add(k);
          const cur = existing.get(k);
          if (!cur) {
            await tx[t.model].create({ data: row });
            s.created++;
          } else if (cur.retiredAt || Object.keys(row).some((f) => !same(cur[f], row[f]))) {
            await tx[t.model].update({ where: t.where(row), data: { ...row, retiredAt: null } });
            s.updated++;
          } else s.unchanged++;
        }
        for (const [k, cur] of existing) {
          if (seen.has(k) || cur.retiredAt) continue;
          await tx[t.model].update({ where: t.where(cur), data: { retiredAt: now } });
          s.retired++;
        }
      }
    },
    { timeout: 60_000 },
  );
  return stats;
}

// Run directly: node prisma/catalog/sync.mjs (no top-level await, so tsx can load this file from seed.ts)
async function main() {
  const db = new PrismaClient();
  try {
    const stats = await syncCatalog(db);
    for (const [table, s] of Object.entries(stats))
      console.log(
        `catalog:sync ${table}: ${s.created} new, ${s.updated} updated, ${s.retired} retired, ${s.unchanged} unchanged`,
      );
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
