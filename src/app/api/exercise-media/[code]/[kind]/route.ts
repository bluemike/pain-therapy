import { exerciseMediaResponse } from '@/lib/exercise-media-route';

/** exercise-library: main image (`main`) or whole sheet (`sheet`) of an exercise, only with a sign-in */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string; kind: string }> }) {
  const { code, kind } = await params;
  return exerciseMediaResponse(code, kind);
}
