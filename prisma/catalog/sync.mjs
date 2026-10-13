/**
 * therapy-catalog: Erstbefüllung und Änderungen (design D2).
 * Loads the reference files in this folder into Region, OsteopressurePoint, RegionPoint, Exercise, RegionExercise
 * and RollingTool. Idempotent: unchanged rows are not written. Nothing is deleted; entries missing from the files
 * get `retiredAt` and come back to life when they reappear.
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

/** Reads and checks the reference files; returns the rows per table keyed by their primary key. */
export async function readCatalog(dir = HERE) {
  const [regions, points, exercises, tools, regionPoints, regionExercises] = await Promise.all([
    json(dir, 'regions.json'),
    json(dir, 'osteopressure-points.json'),
    json(dir, 'exercises.json'),
    json(dir, 'rolling-tools.json'),
    csv(dir, 'region-points.csv'),
    csv(dir, 'region-exercises.csv'),
  ]);
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
 * @param {import('@prisma/client').PrismaClient} db
 */
export async function syncCatalog(db, { dir = HERE, now = new Date() } = {}) {
  const wanted = await readCatalog(dir);
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
