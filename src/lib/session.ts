import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can } from './access';
import type { AppRole } from './auth/accounts';

export type Actor = { id: string; name: string; email: string; roles: AppRole[] };

/** Returns the signed-in practice user, or redirects. */
export async function requireUser(permission: keyof typeof can = 'managePatients'): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const roles = session.user.roles ?? [];
  // The platform account has no practice (design D3): its start page is the list of practices
  if (!roles.length && session.user.platformAdmin) redirect('/platform');
  if (!can[permission](roles)) redirect('/no-access?reason=forbidden');
  return { id: session.user.id, name: session.user.name ?? '', email: session.user.email ?? '', roles };
}

/** The signed-in user without a permission check (own sign-in settings, also for the platform administrator) */
export async function requireSignedIn(): Promise<{ id: string; authTime: number }> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  return { id: session.user.id, authTime: session.user.authTime ?? 0 };
}

/**
 * The platform administrator (iteration 12, design D3): manages practices, never sees patient data. Others are sent
 * to the start page of their practice.
 */
export async function requirePlatformAdmin(): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  if (!session.user.platformAdmin) redirect('/no-access?reason=forbidden');
  return { id: session.user.id, name: session.user.name ?? '', email: session.user.email ?? '', roles: [] };
}
