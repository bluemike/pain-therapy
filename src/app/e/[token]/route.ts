import { NextResponse } from 'next/server';
import { config } from '@/lib/config';
import { invitationTokenKey } from '@/lib/auth/accounts';

/**
 * Iteration 16 (design D1): short link of the SMS invitation, so the SMS stays within 160 characters. Since
 * iteration 19 (design D3) also the typed link of the printed sheet (7KQ4-M2XD-9PRT, any case).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const key = invitationTokenKey(decodeURIComponent(token));
  if (!key) return NextResponse.redirect(`${config.auth.appUrl}/login`);
  return NextResponse.redirect(`${config.auth.appUrl}/einladung/${key.startsWith('S:') ? key.slice(2) : key}`);
}
