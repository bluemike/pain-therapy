import { getZoneSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 204 with a valid device session, 401 otherwise; no data (used by SessionProbe) */
export async function GET() {
  const s = await getZoneSession();
  return new Response(null, { status: s ? 204 : 401, headers: { 'Cache-Control': 'no-store' } });
}
