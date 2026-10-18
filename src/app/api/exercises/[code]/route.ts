import { auth } from '@/auth';
import { can } from '@/lib/access';
import { exerciseDetail } from '@/lib/exercise-sheets';

/**
 * home-exercises: Zugeschnittenes Übungsblatt (iteration 9). Texts of FRM, Standardübung and variants with the tools
 * and aids of one exercise, for the sheet the session form opens; the images come from /api/exercise-media.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const headers = { 'Cache-Control': 'private, no-store' };
  const session = await auth();
  if (!session?.user?.id || !can.managePatients(session.user.roles ?? [])) {
    return new Response('Forbidden', { status: 403, headers });
  }
  const x = await exerciseDetail((await params).code);
  if (!x) return new Response('Not found', { status: 404, headers });
  return Response.json(
    {
      segments: x.segments,
      tools: x.sheet?.rollingTools ?? [],
      standardAids: x.sheet?.standardAids ?? [],
      variants: x.epdVariants.map((v) => ({ number: v.number, aids: v.aids })),
    },
    { headers },
  );
}
