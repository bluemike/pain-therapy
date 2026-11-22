import { NextResponse } from 'next/server';
import { config } from '@/lib/config';

/** Iteration 16 (design D1): short link of the SMS invitation, so the SMS stays within 160 characters */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return NextResponse.redirect(`${config.auth.appUrl}/login`);
  return NextResponse.redirect(`${config.auth.appUrl}/einladung/${token}`);
}
