import 'server-only';
import { Prisma, type NoteInputMode } from '@prisma/client';
import { asInk, inkFromJson, InkError, joinRecognizedLines, type Ink } from '@pain-therapy/shared/ink';
import { config } from './config';
import { db } from './db';
import { audit } from './audit';
import type { Actor } from './session';

/** Handschrift in Bemerkungsfeldern (iteration 10): Eingabeart, Erkennung und Speichern als Bild. */

export { InkError };

// ---------- Eingabeart pro Benutzer (design D3) ----------

export async function inputModeOf(userId: string): Promise<NoteInputMode> {
  const u = await db.user.findUnique({ where: { id: userId }, select: { noteInputMode: true } });
  return u?.noteInputMode ?? 'KEYBOARD';
}

export async function setInputMode(actor: Actor, mode: NoteInputMode): Promise<void> {
  const u = await db.user.findUnique({ where: { id: actor.id }, select: { noteInputMode: true } });
  if (!u || u.noteInputMode === mode) return;
  await db.user.update({ where: { id: actor.id }, data: { noteInputMode: mode } });
}

// ---------- Speichern als Bild (design D5, D7) ----------

/**
 * What the form sends for a remark field next to its text, in the hidden field <name>Ink:
 * - missing or "keep": the stored image stays as it is
 * - "": no image (removed, or replaced by text)
 * - JSON of the strokes: a new image, built by the server
 */
export type InkChange = { kind: 'keep' } | { kind: 'clear' } | { kind: 'set'; ink: Ink };

export function inkChangeFrom(fd: FormData, field: string): InkChange {
  const raw = fd.get(`${field}Ink`);
  if (raw === null || raw === 'keep') return { kind: 'keep' };
  if (typeof raw !== 'string' || raw === '') return { kind: 'clear' };
  const ink = inkFromJson(raw);
  return ink ? { kind: 'set', ink } : { kind: 'clear' };
}

/** The image after the change; text and image never coexist: saved text replaces the image. */
export function resolveInk(stored: unknown, change: InkChange, text: string | null): Ink | null {
  if (text && text.trim()) return null;
  if (change.kind === 'set') return change.ink;
  if (change.kind === 'clear') return null;
  return asInk(stored);
}

/** For the Json column: Prisma needs DbNull to clear it. */
export function inkColumn(ink: Ink | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return ink ? (ink as unknown as Prisma.InputJsonValue) : Prisma.DbNull;
}

/** Will the field have content after saving (required fields: text or image)? */
export function hasInkAfter(stored: unknown, change: InkChange): boolean {
  if (change.kind === 'set') return true;
  if (change.kind === 'clear') return false;
  return asInk(stored) !== null;
}

/** For the history: an image is recorded as "[Handschrift]" without its strokes. */
export function noteForHistory(text: string | null | undefined, ink: unknown): string | null {
  if (text && text.trim()) return text;
  return asInk(ink) ? '[Handschrift]' : null;
}

// ---------- Erkennung (design D4, D8) ----------

export class RecognitionError extends Error {
  constructor(public code: 'unavailable' | 'tooLarge' | 'invalid' | 'rateLimited' | 'empty') {
    super(code);
  }
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const isPng = (b: Uint8Array) => b.length > 8 && PNG.every((x, i) => b[i] === x);

import { RECOGNIZABLE_FIELDS, type RecognizableField } from './handwriting-fields';
export { RECOGNIZABLE_FIELDS, type RecognizableField };

/**
 * Recognises handwriting in a PNG. The image and the text are neither stored nor logged; the audit log records the
 * field and the number of characters only.
 */
export async function recognize(
  actor: Actor,
  field: RecognizableField,
  png: Uint8Array,
  locale: string,
): Promise<string> {
  if (png.length > config.handwriting.maxImageBytes) throw new RecognitionError('tooLarge');
  if (!isPng(png)) throw new RecognitionError('invalid');
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.auditEvent.count({
    where: { userId: actor.id, action: 'note.recognized', at: { gte: since } },
  });
  if (recent >= config.handwriting.perUserPerHour) throw new RecognitionError('rateLimited');
  const text = config.handwriting.stub ? stubText(field) : await readWithDocumentIntelligence(png, locale);
  if (!text) throw new RecognitionError('empty');
  await audit(actor, 'note.recognized', { field, details: { characters: text.length } });
  return text;
}

/** Fixed result for development and end-to-end tests (DOCINTEL_STUB=1). */
function stubText(field: RecognizableField): string {
  return field.endsWith('comparison') ? 'Nacht ruhiger, morgens noch steif' : 'Schulter re, Abduktion eingeschränkt';
}

async function token(): Promise<string> {
  const { DefaultAzureCredential } = await import('@azure/identity');
  const t = await new DefaultAzureCredential().getToken('https://cognitiveservices.azure.com/.default');
  if (!t?.token) throw new RecognitionError('unavailable');
  return t.token;
}

/** Document Intelligence prebuilt-read: start the analysis, then poll the result until it succeeds or times out. */
async function readWithDocumentIntelligence(png: Uint8Array, locale: string): Promise<string> {
  const { endpoint, apiVersion, timeoutMs } = config.handwriting;
  if (!endpoint) throw new RecognitionError('unavailable');
  const deadline = Date.now() + timeoutMs;
  try {
    const auth = `Bearer ${await token()}`;
    const q = new URLSearchParams({ 'api-version': apiVersion });
    if (locale === 'de') q.set('locale', 'de');
    const start = await fetch(`${endpoint}/documentintelligence/documentModels/prebuilt-read:analyze?${q}`, {
      method: 'POST',
      headers: { Authorization: auth, 'Content-Type': 'image/png' },
      body: Buffer.from(png),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const location = start.headers.get('operation-location');
    if (start.status !== 202 || !location) throw new RecognitionError('unavailable');
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 700));
      const res = await fetch(location, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())),
      });
      if (!res.ok) throw new RecognitionError('unavailable');
      const body = (await res.json()) as {
        status: string;
        analyzeResult?: { pages?: { lines?: { content: string }[] }[] };
      };
      if (body.status === 'succeeded')
        return joinRecognizedLines(
          (body.analyzeResult?.pages ?? []).flatMap((p) => (p.lines ?? []).map((l) => l.content)),
        );
      if (body.status === 'failed') throw new RecognitionError('unavailable');
    }
    throw new RecognitionError('unavailable');
  } catch (e) {
    if (e instanceof RecognitionError) throw e;
    // network, timeout, quota (429): the strokes stay on the pad (design: Fehler der Erkennung)
    console.error('handwriting recognition failed', e instanceof Error ? e.name : 'error');
    throw new RecognitionError('unavailable');
  }
}
