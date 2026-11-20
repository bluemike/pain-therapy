import { auth } from '@/auth';
import { can } from '@/lib/access';
import { db } from '@/lib/db';
import { consentStateOf } from '@/lib/patient-access';

export const dynamic = 'force-dynamic';

/** zone-documents (iteration 9, design D5): state of the signature, polled by the patient page; never cached */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles ?? []))
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  const { id } = await params;
  // Unknown or of another practice (row-level security, iteration 12): not found, like the record itself
  if (!(await db.patient.findUnique({ where: { id }, select: { id: true } })))
    return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  const state = await consentStateOf(id);
  return Response.json({ state }, { headers: { 'Cache-Control': 'no-store' } });
}
