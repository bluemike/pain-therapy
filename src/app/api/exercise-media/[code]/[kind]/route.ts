import { exerciseMediaResponse } from '@/lib/exercise-media-route';

/** exercise-library: main image (`main`), whole sheet (`sheet`) or spoken sheet (`audio`), only with a sign-in */
export async function GET(req: Request, { params }: { params: Promise<{ code: string; kind: string }> }) {
  const { code, kind } = await params;
  return exerciseMediaResponse(req, code, kind);
}
