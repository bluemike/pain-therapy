'use server';

import { after } from 'next/server';
import { redirect } from 'next/navigation';
import { requestFinalize, submitSignature, type SignResult } from '@/lib/signing';
import { getZoneSession } from '@/lib/session';

export type SignState = { error?: Exclude<SignResult, { ok: true }>['error'] | 'session' };

/**
 * zone-consent-signing: Abschluss in der Patienten-Zone. On success the practice app is asked for the PDF after the
 * response (design D7), and the patient goes to the thank-you page; "p=1" offers the way to her exercises.
 */
export async function signAction(sid: string, payload: unknown): Promise<SignState> {
  const s = await getZoneSession();
  if (!s) return { error: 'session' };
  const result = await submitSignature(s, sid, payload);
  if (!result.ok) return { error: result.error };
  after(() => requestFinalize(sid));
  redirect(`/unterschrift/danke?p=${s.program?.active ? 1 : 0}`);
}
