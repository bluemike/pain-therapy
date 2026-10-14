'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, SESSION_DAYS } from '@pain-therapy/shared/access';
import { DAY_MS } from '@pain-therapy/shared/time';
import { confirmLink, endSession, type ConfirmResult } from '@/lib/access';
import { correctEntry, createEntry, deleteEntry, parseEntryForm, quickEntry, type EntryError } from '@/lib/entries';
import { getZoneSession } from '@/lib/session';

/** Server actions of the patient zone; the rules live in src/lib/access.ts and src/lib/entries.ts */

export type ConfirmState = { error?: Exclude<ConfirmResult, { ok: true }>['error'] };

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
  const result = await confirmLink({
    token: String(fd.get('token') ?? ''),
    day: String(fd.get('day') ?? ''),
    month: String(fd.get('month') ?? ''),
    year: String(fd.get('year') ?? ''),
    ip: await clientIp(),
  });
  if (!result.ok) return { error: result.error };
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

async function requireSession() {
  const s = await getZoneSession();
  if (!s) redirect('/');
  return s;
}

export type EntryState = { error?: EntryError };

export async function createEntryAction(_prev: EntryState, fd: FormData): Promise<EntryState> {
  const s = await requireSession();
  const parsed = parseEntryForm(fd);
  if (!parsed.ok) return { error: parsed.error };
  const error = await createEntry(s, parsed.data);
  if (error) return { error };
  redirect('/?ok=saved');
}

export async function correctEntryAction(_prev: EntryState, fd: FormData): Promise<EntryState> {
  const s = await requireSession();
  const parsed = parseEntryForm(fd);
  if (!parsed.ok) return { error: parsed.error };
  const error = await correctEntry(s, String(fd.get('id') ?? ''), parsed.data);
  if (error) return { error };
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
