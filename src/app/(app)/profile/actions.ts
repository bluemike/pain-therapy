'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { fieldErrors, profileSchema } from '@/lib/schemas';
import { updateProfile } from '@/lib/users';

export type ProfileFormState = { errors?: Record<string, string> };

/** user-profile (iteration 8, design D9): "Mein Profil" speichern; only the own profile */
export async function saveProfile(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const actor = await requireUser();
  const parsed = profileSchema.safeParse({ displayName: fd.get('displayName') ?? '', title: fd.get('title') ?? '' });
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  await updateProfile(actor, parsed.data);
  revalidatePath('/', 'layout');
  redirect('/profile?flash=saved');
}
