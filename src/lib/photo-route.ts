import { auth } from '@/auth';
import { can } from './access';
import { loadPhoto } from './photos';

/** Datenschutz der Fotos (design D6): sign-in with a role, no patient mode, `Cache-Control: private, no-store`. */
export async function photoResponse(id: string, variant: 'full' | 'thumb') {
  const session = await auth();
  if (!session?.user?.id || session.patientMode || !can.managePatients(session.user.roles ?? [])) {
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  }
  const data = await loadPhoto({ id: session.user.id, name: session.user.name ?? '' }, id, variant);
  if (!data) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Content-Disposition': `inline; filename="${id}${variant === 'thumb' ? '-thumb' : ''}.jpg"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
