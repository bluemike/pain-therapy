import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { TINY_JPEG } from './jpeg';

/**
 * Synthetic stand-ins for the exercise media (exercise-library, design D2) for tests and local development.
 * Clearly fake: striped PNGs and texts that say they are placeholders. The real L&B images and texts never go into
 * the repository; they live in the private container `exercise-media` (docs/deployment.md).
 */

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A grey striped RGB PNG, the usual "image placeholder" look */
export function placeholderPng(width = 248, height = 350): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const v = Math.floor((x + y) / 12) % 2 ? 0xe9 : 0xf5;
      row.set([v, v - 8, v - 30], 1 + x * 3);
    }
    rows.push(row);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

type SheetRef = { code: string; mainImage: string; sheetImage: string; stretchStepLabels: string[] };

export async function exerciseSheetRefs(): Promise<SheetRef[]> {
  const file = path.resolve(__dirname, '../../prisma/catalog/exercise-sheets.json');
  return JSON.parse(await readFile(file, 'utf8')) as SheetRef[];
}

/** Placeholder content in the format of exercises-content.json (docs/deployment.md) */
export function placeholderContent(sheets: SheetRef[]) {
  return sheets.map((s) => ({
    code: s.code,
    rolling: `Platzhalter ${s.code}: Text der Faszien-Rollmassage (kein Inhalt von L&B).`,
    steps: s.stretchStepLabels.map((label) => ({ label, text: `Platzhalter ${s.code}: ${label}.` })),
    variants: `Platzhalter ${s.code}: Varianten.`,
  }));
}

/**
 * Writes placeholder media for every sheet (or the given codes) into `dir`, with the same file names as the real
 * container: <code>.jpg, <code>-blatt.png and exercises-content.json.
 */
export async function writePlaceholderMedia(dir: string, opts: { codes?: string[]; content?: boolean } = {}) {
  const sheets = (await exerciseSheetRefs()).filter((s) => !opts.codes || opts.codes.includes(s.code));
  await mkdir(dir, { recursive: true });
  const sheet = placeholderPng();
  for (const s of sheets) {
    await writeFile(path.join(dir, s.mainImage), TINY_JPEG);
    await writeFile(path.join(dir, s.sheetImage), sheet);
  }
  if (opts.content !== false)
    await writeFile(path.join(dir, 'exercises-content.json'), JSON.stringify(placeholderContent(sheets), null, 2));
  return sheets.length;
}
