import { auth } from '@/auth';
import { takeProfile } from '@/lib/mailboxes';

export const dynamic = 'force-dynamic';

/**
 * Apple profile of the mailbox (iteration 16, design D4): one-time link valid 10 minutes, only for the signed-in user
 * it was made for (the middleware already requires a session). Never cached.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response('Unauthorized', { status: 401 });
  const { token } = await params;
  const p = await takeProfile(token, session.user.id);
  if (!p)
    return new Response('Dieser Link ist abgelaufen. Unter «Mein Profil» können Sie einen neuen Zugang anfordern.', {
      status: 410,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  return new Response(p.xml, {
    headers: {
      'Content-Type': 'application/x-apple-aspen-config',
      'Content-Disposition': `attachment; filename="${p.address.replace(/[^a-z0-9.@-]/gi, '_')}.mobileconfig"`,
      'Cache-Control': 'no-store',
    },
  });
}
