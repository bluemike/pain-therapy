import { auth } from '@/auth';
import { can } from './access';
import { loadExerciseMedia, MEDIA_KINDS, type MediaKind } from './exercise-sheets';

/** A single "bytes=a-b" range of a file of `size` bytes, or null if absent or not satisfiable */
export function byteRange(header: string | null, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  let start: number, end: number;
  if (m[1] === '') {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  return start > end || start >= size ? 'invalid' : { start, end };
}

/**
 * exercise-library: Schutz der Übungsinhalte. Images and audio only for signed-in users with a role;
 * patients get them only inside their exercise sheet. Not patient data, so a private browser cache is fine.
 * Audio answers byte ranges, which Safari on iPad and iPhone needs to play it (iteration 7, design D4).
 */
export async function exerciseMediaResponse(req: Request, code: string, kind: string) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles ?? [])) {
    return new Response('Forbidden', { status: 403, headers });
  }
  if (!MEDIA_KINDS.includes(kind as MediaKind)) return new Response('Not found', { status: 404, headers });
  const media = await loadExerciseMedia(code, kind as MediaKind);
  if (!media) return new Response('Not found', { status: 404, headers });
  const size = media.data.length;
  const common = {
    'Content-Type': media.contentType,
    'Content-Disposition': `inline; filename="${media.name}"`,
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'Accept-Ranges': 'bytes',
  };
  const range = byteRange(req.headers.get('range'), size);
  if (range === 'invalid')
    return new Response(null, { status: 416, headers: { ...common, 'Content-Range': `bytes */${size}` } });
  if (range)
    return new Response(new Uint8Array(media.data.subarray(range.start, range.end + 1)), {
      status: 206,
      headers: { ...common, 'Content-Range': `bytes ${range.start}-${range.end}/${size}` },
    });
  return new Response(new Uint8Array(media.data), { headers: common });
}
