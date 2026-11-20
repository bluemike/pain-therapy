import { auth } from '@/auth';
import { exportFile } from '@/lib/practice-export';

export const dynamic = 'force-dynamic';

/**
 * Download of a practice export (iteration 12, design D9): the practice admin of that practice, or the platform
 * administrator; only while the 24 hours run. Another practice's export is "not found".
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id) return new Response(null, { status: 401 });
  const { id } = await params;
  const admin = user.roles?.includes('ADMIN') && user.practiceId;
  if (!admin && !user.platformAdmin) return new Response(null, { status: 403 });
  const file = await exportFile(id, user.platformAdmin ? null : user.practiceId!);
  if (!file) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(new Uint8Array(file.data), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${file.name}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
