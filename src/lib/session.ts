import 'server-only';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { can } from './access';

export type Actor = { id: string; name: string; email: string; roles: ('THERAPIST' | 'ADMIN')[] };

/** Returns the signed-in practice user, or redirects. */
export async function requireUser(permission: keyof typeof can = 'managePatients'): Promise<Actor> {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');
  const roles = session.user.roles ?? [];
  if (!can[permission](roles)) redirect('/no-access?reason=forbidden');
  return { id: session.user.id, name: session.user.name ?? '', email: session.user.email ?? '', roles };
}
