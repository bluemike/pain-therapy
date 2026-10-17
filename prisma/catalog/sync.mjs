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
 * Iteration 8 (design D1, D2): Bereiche (BodyArea), Schmerzbereiche with code and Bereich, the variants of the
 * Engpassdehnungen (ExerciseVariant, structure only) and the texts of FRM, Standardübung and Varianten from
 * `segments-content.json` in the same place as `exercises-content.json`, read the same way.
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
const SEGMENTS_FILE = 'segments-content.json';

/**
 * Reads `exercises-content.json` (or another JSON file, iteration 8: `segments-content.json`) from the exercise media
 * (container or local folder). Returns null when the file is missing or cannot be read, with a warning in the log.
 */
export async function readExerciseContent(env = process.env, file = CONTENT_FILE) {
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
        .getBlockBlobClient(file);
      return JSON.parse((await blob.downloadToBuffer()).toString('utf8'));
    }
    const dir = env.STORAGE_EXERCISE_LOCAL_DIR || './data/exercise-media';
    return JSON.parse(await readFile(path.join(dir, file), 'utf8'));
  } catch (e) {
    const missing = e?.code === 'ENOENT' || e?.statusCode === 404;
    console.warn(`catalog:sync ${file}: ${missing ? 'not found' : (e?.message ?? e)}; exercise texts unchanged`);
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

const items = (v) => (Array.isArray(v) ? v : []);
const numbers = (v) => items(v).filter((n) => Number.isInteger(n) && n > 0);
/** `number`, or the number of an id like "1A-V3" (segments.json of the sheet analysis) */
const variantNumber = (v) =>
  Number.isInteger(v?.number) ? v.number : Number(/-V(\d+)$/.exec(String(v?.id ?? ''))?.[1]) || null;

/**
 * Brings the texts of one sheet from segments-content.json into the stored shape (iteration 8, design D2):
 * { frm: { items: [{ n, text }] }, standard: { intro, steps: [{ label, text }], note },
 *   variants: { intro, items: [{ number, text }] } }; null if nothing is there.
 */
export function normalizeSegments(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const frm = items(entry.frm?.items)
    .map((i) => ({ n: numbers(i?.n), text: text(i?.text) }))
    .filter((i) => i.text);
  const steps = items(entry.standard?.steps)
    .map((st) => ({ label: String(st?.label ?? ''), text: text(st?.text) }))
    .filter((st) => st.text);
  const variants = items(entry.variants?.items)
    .map((v, i) => ({ number: variantNumber(v) ?? i + 1, text: text(v?.text) }))
    .filter((v) => v.text);
  const out = {
    frm: { items: frm },
    standard: { intro: text(entry.standard?.intro), steps, note: text(entry.standard?.note) },
    variants: { intro: text(entry.variants?.intro), items: variants },
  };
  return frm.length || steps.length || variants.length ? out : null;
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
export async function readCatalog(dir = HERE, content = null, segments = null) {
  const [areas, regions, points, exercises, tools, regionPoints, regionExercises, sheets, variants] = await Promise.all(
    [
      json(dir, 'body-areas.json'),
      json(dir, 'regions.json'),
      json(dir, 'osteopressure-points.json'),
      json(dir, 'exercises.json'),
      json(dir, 'rolling-tools.json'),
      csv(dir, 'region-points.csv'),
      csv(dir, 'region-exercises.csv'),
      json(dir, 'exercise-sheets.json'),
      json(dir, 'exercise-variants.json'),
    ],
  );
  const texts = contentByCode(content);
  const segmentTexts = contentByCode(segments);
  const rows = {
    bodyArea: areas.map((a) => ({ id: a.id, nameDe: a.nameDe, nameEn: a.nameEn })),
    region: regions.map((r) => ({
      id: r.id,
      code: r.code,
      bodyAreaId: r.bodyArea,
      nameDe: r.nameDe,
      nameEn: r.nameEn,
      sheetTitle: r.sheetTitle,
    })),
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
      rollingTools: x.rollingTools ?? [],
      standardAids: x.standardAids ?? [],
      // Only written when the content file was read, so a missing file never wipes texts
      ...(texts ? { content: normalizeContent(texts.get(x.code), x.stretchStepLabels) ?? Prisma.DbNull } : {}),
      ...(segmentTexts ? { segments: normalizeSegments(segmentTexts.get(x.code)) ?? Prisma.DbNull } : {}),
    })),
    exerciseVariant: variants.map((v) => ({
      exerciseCode: v.exerciseCode,
      number: v.number,
      images: v.images ?? [],
      aids: v.aids ?? [],
      seconds: v.seconds ?? null,
    })),
  };
  // Referential checks, so a typo in a file fails the deployment instead of the database
  const areaIds = new Set(rows.bodyArea.map((a) => a.id));
  for (const r of rows.region)
    if (!areaIds.has(r.bodyAreaId) || r.code !== `${r.bodyAreaId}.${((r.id - 1) % 3) + 1}`)
      throw new Error(`regions.json: Bereich or code of ${r.id}`);
  for (const x of [...rows.osteopressurePoint, ...rows.exercise])
    if (!areaIds.has(x.group)) throw new Error(`Unknown Bereich ${x.group} of ${x.id ?? x.code}`);
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
  const toolCodes = new Set(rows.rollingTool.map((t) => t.code));
  for (const x of rows.exerciseSheet)
    for (const t of x.rollingTools)
      if (!toolCodes.has(t)) throw new Error(`exercise-sheets.json: unknown tool ${t} of ${x.exerciseCode}`);
  const variantKeys = new Set();
  for (const v of rows.exerciseVariant) {
    const k = `${v.exerciseCode}|${v.number}`;
    if (!codes.has(v.exerciseCode) || !Number.isInteger(v.number) || v.number < 1 || variantKeys.has(k))
      throw new Error(`exercise-variants.json: ${k}`);
    if (!seconds(v.seconds)) throw new Error(`exercise-variants.json: seconds of ${k}`);
    variantKeys.add(k);
  }
  for (const code of codes) {
    const n = rows.exerciseVariant.filter((v) => v.exerciseCode === code).map((v) => v.number);
    if (n.some((x, i) => x !== i + 1)) throw new Error(`exercise-variants.json: numbers of ${code} must be 1…n`);
  }
  if (segmentTexts)
    for (const code of segmentTexts.keys())
      if (!codes.has(code)) console.warn(`catalog:sync ${SEGMENTS_FILE}: unknown code ${code} ignored`);
  if (texts)
    for (const code of texts.keys())
      if (!codes.has(code)) console.warn(`catalog:sync ${CONTENT_FILE}: unknown code ${code} ignored`);
  return rows;
}

const TABLES = [
  // Parents before children (foreign keys)
  { model: 'bodyArea', key: (r) => String(r.id), where: (r) => ({ id: r.id }) },
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
  {
    model: 'exerciseVariant',
    key: (r) => `${r.exerciseCode}|${r.number}`,
    where: (r) => ({ exerciseCode_number: { exerciseCode: r.exerciseCode, number: r.number } }),
  },
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
 * `content` and `segments` replace reading exercises-content.json and segments-content.json from the exercise media
 * (tests); null means not available.
 * @param {import('@prisma/client').PrismaClient} db
 */
export async function syncCatalog(db, { dir = HERE, now = new Date(), content, segments } = {}) {
  const wanted = await readCatalog(
    dir,
    content === undefined ? await readExerciseContent() : content,
    segments === undefined ? await readExerciseContent(process.env, SEGMENTS_FILE) : segments,
  );
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
