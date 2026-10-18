import type { Language, ProfessionalTitle } from '@prisma/client';
import { db } from './db';
import { audit } from './audit';
import { translator } from './i18n-server';
import type { Actor } from './session';

export { presetFor } from './profile-presets';

/** user-profile (iteration 8, design D9): Anzeigename and Berufsbezeichnung of the practice users. */

/** First name from the Entra name, the fallback while no display name is set */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

export async function profileOf(entraOid: string) {
  const u = await db.user.findUnique({ where: { entraOid } });
  if (!u) return null;
  return { ...u, greetingName: u.displayName?.trim() || firstName(u.name) };
}

export class ProfileError extends Error {
  constructor(public code: 'notFound') {
    super(code);
  }
}

/** "Mein Profil": each user changes only their own profile; changes go into the audit log */
export async function updateProfile(
  actor: Actor,
  input: { displayName: string; title: ProfessionalTitle },
): Promise<void> {
  const u = await db.user.findUnique({ where: { entraOid: actor.id } });
  if (!u) throw new ProfileError('notFound');
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: u.id }, data: input });
    if ((u.displayName ?? '') !== input.displayName)
      await audit(
        actor,
        'profile.updated',
        { field: 'displayName', before: u.displayName, after: input.displayName },
        tx,
      );
    if (u.title !== input.title)
      await audit(actor, 'profile.updated', { field: 'title', before: u.title, after: input.title }, tx);
  });
}

/** "Therapeutin: Christina Franz" for documents; just the name if the user is unknown */
export async function therapistLine(name: string, language: Language) {
  const u = await db.user.findFirst({ where: { name }, orderBy: { lastLoginAt: 'desc' }, select: { title: true } });
  if (!u) return name;
  return `${translator(language, 'profile')(`title_${u.title}`)}: ${name}`;
}
