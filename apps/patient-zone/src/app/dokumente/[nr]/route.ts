import { redirect } from 'next/navigation';
import { zoneAudit } from '@/lib/audit';
import { documentStore } from '@/lib/media';
import { documentOf } from '@/lib/record';
import { getZoneSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * zone-documents: Dokument ansehen und herunterladen (iteration 6, design D4). Only for a valid device session and
 * only a document of its patient; another patient's number is "not found" like an unknown one. The archived PDF is
 * delivered unchanged, never cached in shared caches, and every retrieval is logged (document.viewedInZone).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ nr: string }> }) {
  const s = await getZoneSession();
  // Sitzung beendet: no PDF, the neutral start page
  if (!s) redirect('/');
  if (s.signaturePending) redirect('/unterschrift');
  const { nr } = await params;
  const notFound = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const doc = await documentOf(s, nr);
  const data = doc ? await documentStore().get(doc.path) : null;
  if (!doc || !data) return notFound();
  await zoneAudit('document.viewedInZone', {
    patientId: s.patient.id,
    linkId: s.session.linkId,
    after: doc.documentNumber,
    details: { documentNumber: doc.documentNumber, sessionId: s.session.id },
  });
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.documentNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
