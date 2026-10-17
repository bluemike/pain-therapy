import { exerciseMediaResponse } from '@/lib/exercise-media-route';

/**
 * exercise-library: main image (`main`), whole sheet (`sheet`), spoken sheet (`audio`) and since iteration 8 the bands
 * and recordings of FRM, Standardübung and Varianten (`frm`, `std`, `var`, `frm-audio`, `std-audio`, `v<n>-audio`),
 * only with a sign-in
 */
export async function GET(req: Request, { params }: { params: Promise<{ code: string; kind: string }> }) {
  const { code, kind } = await params;
  return exerciseMediaResponse(req, code, kind);
}
