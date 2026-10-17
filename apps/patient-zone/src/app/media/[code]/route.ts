import { programSession } from '@/lib/access';
import { BANDS, mainImageOf, type Band } from '@/lib/entries';
import { contentTypeOf, mediaStore } from '@/lib/media';
import { getZoneSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * patient-zone-app: Nur das eigene Heimprogramm. The main image or an image band of an exercise only for a valid
 * session and only for exercises of the patient's current program; anything else is "not found".
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  // Nothing while a signature is pending (zone-consent-signing: Unterschrift vor den Übungen)
  const s = programSession(await getZoneSession());
  if (!s || !/^[1-9][A-Z]$/.test(code)) return notFound();
  // ?teil=frm|std|var: an image band of FRM or of the prescribed EPD (iteration 8, design D2)
  const teil = new URL(req.url).searchParams.get('teil');
  if (teil && !BANDS.includes(teil as Band)) return notFound();
  const name = await mainImageOf(s, code, (teil as Band | null) ?? undefined);
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
