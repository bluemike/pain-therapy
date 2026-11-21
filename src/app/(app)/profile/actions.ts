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
