import { auth } from '@/auth';
import { can } from './access';
import { loadExerciseMedia, type MediaKind } from './exercise-sheets';

/**
 * exercise-library: Schutz der Übungsinhalte. Images only for signed-in users with a role;
 * patients get them only inside their exercise sheet. Not patient data, so a private browser cache is fine.
 */
export async function exerciseMediaResponse(code: string, kind: string) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles ?? [])) {
    return new Response('Forbidden', { status: 403, headers });
  }
  if (kind !== 'main' && kind !== 'sheet') return new Response('Not found', { status: 404, headers });
  const media = await loadExerciseMedia(code, kind as MediaKind);
  if (!media) return new Response('Not found', { status: 404, headers });
  return new Response(new Uint8Array(media.data), {
    headers: {
      'Content-Type': media.contentType,
      'Content-Disposition': `inline; filename="${media.name}"`,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
