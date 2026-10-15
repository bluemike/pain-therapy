import { programSession } from '@/lib/access';
import { mainImageOf } from '@/lib/entries';
import { contentTypeOf, mediaStore } from '@/lib/media';
import { getZoneSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * patient-zone-app: Nur das eigene Heimprogramm. The main image of an exercise only for a valid session and only
 * for exercises of the patient's current program; anything else is "not found".
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  // Nothing while a signature is pending (zone-consent-signing: Unterschrift vor den Übungen)
  const s = programSession(await getZoneSession());
  if (!s || !/^[1-9][A-Z]$/.test(code)) return notFound();
  const name = await mainImageOf(s, code);
  const data = name ? await mediaStore().get(name) : null;
  if (!name || !data) return notFound();
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': contentTypeOf(name),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
