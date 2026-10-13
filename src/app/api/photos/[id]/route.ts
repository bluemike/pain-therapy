import { photoResponse } from '@/lib/photo-route';

/** clinical-photos: full-size photo, only signed in with a role, never cached, every view logged */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return photoResponse((await params).id, 'full');
}
