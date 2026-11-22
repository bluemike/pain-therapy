'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { fieldErrors, profileSchema } from '@/lib/schemas';
import { updateProfile } from '@/lib/users';
import { setInputMode } from '@/lib/handwriting';
import { setAudioLanguage } from '@/lib/users';
import { GERMAN_AUDIO, type GermanAudio } from '@pain-therapy/shared/audio-language';
import { INPUT_MODES, type InputMode } from '@pain-therapy/shared/ink';
import { confirmMobileChange, requestMobileChangeCode } from '@/lib/auth/login-codes';
import { clientIp } from '@/lib/auth/request';
import { maskMobile, normalizeMobile } from '@/lib/phone';
import { audit } from '@/lib/audit';

export type ProfileFormState = { errors?: Record<string, string> };

/** user-profile (iteration 8, design D9): "Mein Profil" speichern; only the own profile */
export async function saveProfile(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const actor = await requireUser();
  const parsed = profileSchema.safeParse({ displayName: fd.get('displayName') ?? '', title: fd.get('title') ?? '' });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await updateProfile(actor, parsed.data);
  // note-input (iteration 10, design D3): Eingabe bei Bemerkungen
  const mode = String(fd.get('noteInputMode') ?? '') as InputMode;
  if (INPUT_MODES.includes(mode)) await setInputMode(actor, mode);
  // exercise-audio (iteration 15, design D3): only sent while the interface is German
  const audio = String(fd.get('audioLanguage') ?? '') as GermanAudio;
  if (GERMAN_AUDIO.includes(audio)) await setAudioLanguage(actor, audio);
  revalidatePath('/', 'layout');
  redirect('/profile?flash=saved');
}

export type MobileResult = { ok: true; masked?: string } | { ok: false; error: string };

/** Iteration 16 (design D7): new mobile number, confirmed with a code sent by SMS to that number */
export async function mobileSendCodeAction(raw: string): Promise<MobileResult> {
  const actor = await requireUser();
  const mobile = normalizeMobile(raw);
  if (!mobile) return { ok: false, error: 'mobileInvalid' };
  const r = await requestMobileChangeCode(actor.id, mobile, await clientIp());
  return r.ok ? { ok: true, masked: maskMobile(mobile) } : { ok: false, error: r.error };
}

export async function mobileConfirmAction(code: string): Promise<MobileResult> {
  const actor = await requireUser();
  const r = await confirmMobileChange(actor.id, code, await clientIp());
  if (!r.ok) return { ok: false, error: r.error };
  await audit(actor, 'profile.mobileChanged');
  revalidatePath('/profile');
  return { ok: true };
}
