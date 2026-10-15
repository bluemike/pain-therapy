'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_DAYS } from '@pain-therapy/shared/access';
import { DAY_MS } from '@pain-therapy/shared/time';
import { confirmLink, endSession, programSession, type ConfirmResult } from '@/lib/access';
import { correctEntry, createEntry, deleteEntry, parseEntryForm, quickEntry, type EntryError } from '@/lib/entries';
import { getZoneSession } from '@/lib/session';

/** Server actions of the patient zone; the rules live in src/lib/access.ts and src/lib/entries.ts */

export type ConfirmState = {
  error?: Exclude<ConfirmResult, { ok: true }>['error'];
  /** What was typed, so the form shows it again after an error (React resets a form after its action) */
  values?: { day: string; month: string; year: string };
};

/**
 * Client address as seen by the Azure ingress: it appends the address to X-Forwarded-For, so the last entry is the
 * one a client cannot choose (Begrenzung pro IP-Adresse).
 */
async function clientIp() {
  const h = await headers();
  const xff = h.get('x-forwarded-for');
  return xff?.split(',').at(-1)?.trim() || h.get('x-real-ip') || 'unknown';
}

/** Bestätigung mit dem Geburtsdatum; on success the device session cookie, then "/" without the token */
export async function confirmAction(_prev: ConfirmState, fd: FormData): Promise<ConfirmState> {
  const values = {
    day: String(fd.get('day') ?? '').slice(0, 2),
    month: String(fd.get('month') ?? '').slice(0, 2),
    year: String(fd.get('year') ?? '').slice(0, 4),
  };
  const result = await confirmLink({ token: String(fd.get('token') ?? ''), ...values, ip: await clientIp() });
  if (!result.ok) return { error: result.error, values };
  (await cookies()).set(SESSION_COOKIE, result.sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: (SESSION_DAYS * DAY_MS) / 1000,
  });
  redirect('/');
}

export async function logoutAction() {
  const jar = await cookies();
  await endSession(jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect('/?out=1');
}

/** Entries only with the home program; while a signature is pending the task to sign comes first (iteration 5) */
async function requireSession() {
  const s = await getZoneSession();
  if (s?.signaturePending) redirect('/unterschrift');
  const p = programSession(s);
  if (!p) redirect('/');
  return p;
}

export type EntryValues = { done: boolean; rating: number | null; date: string; time: string; note: string };
/** After an error the form shows what was entered again (React resets a form after its action) */
export type EntryState = { error?: EntryError; values?: EntryValues; attempt?: number };

function entryValues(fd: FormData): EntryValues {
  const rating = Number(fd.get('rating'));
  return {
    done: fd.get('done') !== 'no',
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 10 ? rating : null,
    date: String(fd.get('date') ?? '').slice(0, 10),
    time: String(fd.get('time') ?? '').slice(0, 5),
    note: String(fd.get('note') ?? '').slice(0, 2000),
  };
}

export async function createEntryAction(prev: EntryState, fd: FormData): Promise<EntryState> {
  const s = await requireSession();
  const failed = (error: EntryError) => ({ error, values: entryValues(fd), attempt: (prev.attempt ?? 0) + 1 });
  const parsed = parseEntryForm(fd);
  if (!parsed.ok) return failed(parsed.error);
  const error = await createEntry(s, parsed.data);
  if (error) return failed(error);
  redirect('/?ok=saved');
}

export async function correctEntryAction(prev: EntryState, fd: FormData): Promise<EntryState> {
  const s = await requireSession();
  const failed = (error: EntryError) => ({ error, values: entryValues(fd), attempt: (prev.attempt ?? 0) + 1 });
  const parsed = parseEntryForm(fd);
  if (!parsed.ok) return failed(parsed.error);
  const error = await correctEntry(s, String(fd.get('id') ?? ''), parsed.data);
  if (error) return failed(error);
  redirect('/?ok=corrected');
}

export async function deleteEntryAction(fd: FormData) {
  const s = await requireSession();
  const error = await deleteEntry(s, String(fd.get('id') ?? ''));
  redirect(error ? '/?err=notEditable' : '/?ok=deleted');
}

export async function quickEntryAction() {
  const s = await requireSession();
  const n = await quickEntry(s);
  redirect(`/?ok=quick&n=${n}`);
}
