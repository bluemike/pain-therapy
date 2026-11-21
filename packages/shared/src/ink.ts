import { strokePath, type Stroke } from './signature';

/**
 * Handschrift in Bemerkungsfeldern (iteration 10, design D5): strokes are drawn in a fixed logical space INK_WIDTH wide
 * and LINE_HEIGHT per ruled line, so the stored note looks the same at any screen width. The server builds the SVG from
 * the raw points and never accepts one from the browser.
 */
export const INK_WIDTH = 1000;
export const INK_LINE_HEIGHT = 64;
export const INK_MIN_LINES = 4;
export const INK_MAX_LINES = 12;
export const INK_MAX_STROKES = 400;
export const INK_MAX_POINTS = 20000;

export type InputMode = 'KEYBOARD' | 'HANDWRITING_TEXT' | 'HANDWRITING_IMAGE';
export const INPUT_MODES: readonly InputMode[] = ['KEYBOARD', 'HANDWRITING_TEXT', 'HANDWRITING_IMAGE'];

/** Stored in the …Ink columns (Json). */
export type Ink = { v: 1; w: number; h: number; strokes: Stroke[]; svg: string };

export class InkError extends Error {
  constructor(public code: 'inkInvalid' | 'inkTooLarge') {
    super(code);
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ink stroke size in the logical space (thicker than the signature, which is drawn at screen size). */
export function inkPath(points: Stroke): string {
  return strokePath(points.map(([x, y, p]) => [x / 2.4, y / 2.4, p] as [number, number, number]));
}

export function inkSvg(strokes: Stroke[], w: number, h: number): string {
  // perfect-freehand sizes are in pixels; draw at 1/2.4 scale and scale up, so lines are as thick as on the pad
  const paths = strokes.map(inkPath).filter(Boolean);
  const vw = r1(w / 2.4);
  const vh = r1(h / 2.4);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vw} ${vh}" width="${w}" height="${h}">${paths
    .map((d) => `<path d="${d}" fill="#1b2a5c"/>`)
    .join('')}</svg>`;
}

/** Validates raw strokes from a form (JSON) and builds the stored note. Returns null for an empty pad. */
export function inkFromJson(json: string): Ink | null {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    throw new InkError('inkInvalid');
  }
  if (!data || typeof data !== 'object') throw new InkError('inkInvalid');
  const { h, strokes } = data as { h?: unknown; strokes?: unknown };
  if (typeof h !== 'number' || !Array.isArray(strokes)) throw new InkError('inkInvalid');
  const lines = Math.round(h / INK_LINE_HEIGHT);
  if (lines < INK_MIN_LINES || lines > INK_MAX_LINES) throw new InkError('inkInvalid');
  const height = lines * INK_LINE_HEIGHT;
  if (strokes.length > INK_MAX_STROKES) throw new InkError('inkTooLarge');
  let total = 0;
  const clean: Stroke[] = [];
  for (const s of strokes) {
    if (!Array.isArray(s) || s.length === 0) throw new InkError('inkInvalid');
    total += s.length;
    if (total > INK_MAX_POINTS) throw new InkError('inkTooLarge');
    const pts: Stroke = [];
    for (const p of s) {
      if (!Array.isArray(p) || p.length !== 3 || !p.every((n) => typeof n === 'number' && Number.isFinite(n)))
        throw new InkError('inkInvalid');
      const [x, y, pr] = p as number[];
      pts.push([r1(clamp(x, 0, INK_WIDTH)), r1(clamp(y, 0, height)), Math.round(clamp(pr, 0, 1) * 100) / 100]);
    }
    clean.push(pts);
  }
  if (!clean.length) return null;
  // The stored note ends below the last written line, so empty lines of the pad do not take up room
  const lowest = Math.max(...clean.flat().map((p) => p[1]));
  const used = Math.min(height, Math.max(1, Math.ceil((lowest + 16) / INK_LINE_HEIGHT)) * INK_LINE_HEIGHT);
  return { v: 1, w: INK_WIDTH, h: used, strokes: clean, svg: inkSvg(clean, INK_WIDTH, used) };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Reads a stored note defensively (Json column). */
export function asInk(value: unknown): Ink | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Partial<Ink>;
  if (v.v !== 1 || typeof v.svg !== 'string' || !Array.isArray(v.strokes)) return null;
  return v as Ink;
}

/** data: URL of the stored SVG for an <img>; the SVG is built by the server, so it holds only paths. */
export function inkDataUrl(ink: Pick<Ink, 'svg'>): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(ink.svg)}`;
}

/** Joins the lines of a recognition result; trims and drops empty lines. */
export function joinRecognizedLines(lines: string[]): string {
  return lines
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** Inserts recognized text at the cursor (or appends on a new line), as in design D4. */
export function insertRecognized(current: string, recognized: string, cursor: number | null): string {
  if (!recognized) return current;
  if (!current.trim()) return recognized;
  const at = cursor === null || cursor < 0 || cursor > current.length ? current.length : cursor;
  const before = current.slice(0, at);
  const after = current.slice(at);
  const sepBefore = before === '' || /\s$/.test(before) ? '' : at === current.length ? '\n' : ' ';
  const sepAfter = after === '' || /^\s/.test(after) ? '' : ' ';
  return before + sepBefore + recognized + sepAfter + after;
}
