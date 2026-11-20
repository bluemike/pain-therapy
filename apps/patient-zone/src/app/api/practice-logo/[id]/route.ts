import { practiceLogo } from '@/lib/db';

/** Logo of a practice for the header of the zone (practice-settings: Logo in der Zone); logos are not secret */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return new Response(null, { status: 404 });
  const p = await practiceLogo(id);
  if (!p?.logo || !p.logoType) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(p.logo), {
    headers: {
      'Content-Type': p.logoType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
