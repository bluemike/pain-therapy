import { auth } from '@/auth';
import { currentPractice } from '@/lib/practice';

/** Logo of the practice of the signed-in user (practice-settings), for the header of the app */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const p = await currentPractice();
  if (!p?.logo || !p.logoType) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(p.logo), {
    headers: {
      'Content-Type': p.logoType,
      'Cache-Control': 'private, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
