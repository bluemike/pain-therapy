import { headers } from 'next/headers';
import { HandoffError, uploadToHandoff } from '@/lib/photo-handoff';
import { PhotoError } from '@/lib/photos';

export const dynamic = 'force-dynamic';

/**
 * Fotos mit dem Smartphone (iteration 15, design D5): one photo per request from the public page. Only uploads; the
 * answer says how many photos the link still takes, nothing else.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const noStore = { 'Cache-Control': 'no-store' };
  const h = await headers();
  // The Azure ingress appends the client to X-Forwarded-For, so its last entry is the one a client cannot choose
  const ip = h.get('x-forwarded-for')?.split(',').at(-1)?.trim() || h.get('x-real-ip') || 'unknown';
  try {
    const fd = await req.formData();
    const photo = fd.get('photo');
    const thumb = fd.get('thumb');
    if (!(photo instanceof File) || !photo.size) return Response.json({ error: 'photoType' }, { status: 400 });
    const result = await uploadToHandoff(
      (await params).token,
      {
        data: new Uint8Array(await photo.arrayBuffer()),
        thumb: thumb instanceof File && thumb.size ? new Uint8Array(await thumb.arrayBuffer()) : null,
        takenAt: typeof fd.get('takenAt') === 'string' ? (fd.get('takenAt') as string) : null,
      },
      ip,
    );
    return Response.json(result, { headers: noStore });
  } catch (e) {
    if (e instanceof HandoffError) {
      const status = e.code === 'rateLimited' ? 429 : e.code === 'notFound' ? 404 : 410;
      return Response.json({ error: e.code }, { status, headers: noStore });
    }
    if (e instanceof PhotoError) return Response.json({ error: e.code }, { status: 400, headers: noStore });
    console.error('photo handoff upload failed', e instanceof Error ? e.message : e);
    return Response.json({ error: 'generic' }, { status: 500, headers: noStore });
  }
}
