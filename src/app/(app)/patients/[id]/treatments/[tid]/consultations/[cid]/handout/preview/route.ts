import { auth } from '@/auth';
import { can } from '@/lib/access';
import { buildHandout, handoutContext, handoutLayoutOf } from '@/lib/handouts';
import { translator } from '@/lib/i18n-server';

/** exercise-handout: Vorschau (with ?layout=PARTS only the prescribed parts). Renders the exercise sheet without document number; nothing is stored or sent. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; cid: string }> }) {
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles)) {
    return new Response('Forbidden', { status: 403 });
  }
  const { id, cid } = await params;
  const ctx = await handoutContext(cid);
  if (!ctx || ctx.patient.id !== id || !ctx.prescriptions.length) return new Response('Not found', { status: 404 });
  const preview = translator(ctx.patient.preferredLanguage, 'handoutPdf')('preview');
  const layout = handoutLayoutOf(new URL(req.url).searchParams.get('layout'));
  const { pdf } = await buildHandout(ctx, preview, (ctx.consultation.handouts[0]?.version ?? 0) + 1, { layout });
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      'Cache-Control': 'private, no-store',
    },
  });
}
