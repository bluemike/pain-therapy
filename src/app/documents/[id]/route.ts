import { auth } from '@/auth';
import { can } from '@/lib/access';
import { audit } from '@/lib/audit';
import { db } from '@/lib/db';
import { documentStore, sha256 } from '@/lib/storage';

/** consent-documents: Dokument ansehen. Streams the archived PDF after checking its checksum. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.patientMode || !can.managePatients(session.user.roles)) {
    return new Response('Forbidden', { status: 403 });
  }
  const { id } = await params;
  const doc = await db.signedDocument.findUnique({ where: { id } });
  if (!doc) return new Response('Not found', { status: 404 });
  const data = await documentStore().get(doc.blobPath);
  if (sha256(data) !== doc.sha256) return new Response('Checksum mismatch', { status: 500 });
  await audit({ id: session.user.id, name: session.user.name ?? '' }, 'document.viewed', {
    patientId: doc.patientId,
    after: doc.documentNumber,
  });
  return new Response(new Uint8Array(data), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${doc.documentNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Frame-Options': 'SAMEORIGIN',
    },
  });
}
