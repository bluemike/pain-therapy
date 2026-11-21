import { programSession } from '@/lib/access';
import { AUDIO_PARTS, BANDS, audioOf, mainImageOf, type AudioPart, type Band } from '@/lib/entries';
import { contentTypeOf, mediaStore } from '@/lib/media';
import { getZoneSession } from '@/lib/session';
import { isAudioLanguage } from '@pain-therapy/shared/audio-language';

export const dynamic = 'force-dynamic';

/** A single "bytes=a-b" range of a file of `size` bytes, or null if absent or not satisfiable */
function byteRange(header: string | null, size: number): { start: number; end: number } | 'invalid' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return 'invalid';
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  return start > end || start >= size ? 'invalid' : { start, end };
}

/**
 * patient-zone-app: Nur das eigene Heimprogramm. The main image, an image band or (iteration 14, "Anhören") the
 * recording of FRM or of the prescribed EPD of an exercise, only for a valid session and only for exercises of the
 * patient's current programs; anything else is "not found". Audio answers byte ranges, which Safari needs.
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  // Nothing while a signature is pending (zone-consent-signing: Unterschrift vor den Übungen)
  const s = programSession(await getZoneSession());
  if (!s || !/^[1-9][A-Z]$/.test(code)) return notFound();
  const url = new URL(req.url);
  // ?teil=frm|std|var: an image band of FRM or of the prescribed EPD (iteration 8, design D2); frm-audio|epd-audio
  const teil = url.searchParams.get('teil');
  if (teil && !BANDS.includes(teil as Band) && !AUDIO_PARTS.includes(teil as AudioPart)) return notFound();
  if (teil && AUDIO_PARTS.includes(teil as AudioPart)) {
    const lang = url.searchParams.get('lang');
    const name = audioOf(s, code, teil as AudioPart, url.searchParams.get('b'), isAudioLanguage(lang) ? lang : 'de');
    const data = name ? await mediaStore().get(name) : null;
    if (!name || !data) return notFound();
    const size = data.length;
    const common = {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Accept-Ranges': 'bytes',
    };
    const range = byteRange(req.headers.get('range'), size);
    if (range === 'invalid')
      return new Response(null, { status: 416, headers: { ...common, 'Content-Range': `bytes */${size}` } });
    if (range)
      return new Response(new Uint8Array(data.subarray(range.start, range.end + 1)), {
        status: 206,
        headers: { ...common, 'Content-Range': `bytes ${range.start}-${range.end}/${size}` },
      });
    return new Response(new Uint8Array(data), { headers: common });
  }
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
