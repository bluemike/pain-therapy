import { auth } from '@/auth';
import { can } from '@/lib/access';
import { consentStateOf } from '@/lib/patient-access';

export const dynamic = 'force-dynamic';

/** zone-documents (iteration 9, design D5): state of the signature, polled by the patient page; never cached */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles ?? []))
    return new Response('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store' } });
  const state = await consentStateOf((await params).id);
  return Response.json({ state }, { headers: { 'Cache-Control': 'no-store' } });
}
