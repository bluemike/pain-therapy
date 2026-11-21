import { auth } from '@/auth';
import { can } from '@/lib/access';
import { handoffPhoto } from '@/lib/photo-handoff';

export const dynamic = 'force-dynamic';

/** Preview of a photo from the phone before the form is saved (?v=thumb for the thumbnail) */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; upload: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles ?? []))
    return new Response('Forbidden', { status: 403, headers });
  const { id, upload } = await params;
  const thumb = new URL(req.url).searchParams.get('v') === 'thumb';
  const data = await handoffPhoto(id, upload, thumb ? 'thumb' : 'full');
  if (!data) return new Response('Not found', { status: 404, headers });
  return new Response(new Uint8Array(data), {
    headers: { ...headers, 'Content-Type': 'image/jpeg', 'X-Content-Type-Options': 'nosniff' },
  });
}
