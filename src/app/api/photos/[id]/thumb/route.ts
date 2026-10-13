import { photoResponse } from '@/lib/photo-route';

/** clinical-photos: thumbnail for lists and forms, same access rules as the full photo */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return photoResponse((await params).id, 'thumb');
}
