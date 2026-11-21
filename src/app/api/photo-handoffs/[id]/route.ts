import { auth } from '@/auth';
import { can } from '@/lib/access';
import { handoffState } from '@/lib/photo-handoff';

export const dynamic = 'force-dynamic';

/** Fotos mit dem Smartphone (iteration 15, design D5): the form asks every 3 seconds for new photos */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles ?? []))
    return Response.json({ error: 'forbidden' }, { status: 403, headers });
  const state = await handoffState((await params).id);
  if (!state) return Response.json({ error: 'notFound' }, { status: 404, headers });
  return Response.json(state, { headers });
}
