import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { legacyTarget } from '@/lib/legacy-host';

// /api/internal: calls of the patient zone and the finalize job, signed with ZONE_INTERNAL_SECRET (iteration 5, D7)
// /foto: upload page of a photo handoff, protected by its token (iteration 15, design D5)
const PUBLIC = [
  '/login',
  '/einladung',
  // Iteration 16 (design D1): short invitation link of the SMS
  '/e',
  '/impressum',
  '/no-access',
  '/api/auth',
  '/api/health',
  '/api/internal',
  '/foto',
];
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];
export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  // Iteration 12 (design D10): former host names redirect to AUTH_URL
  const moved = legacyTarget(req.headers, req.nextUrl, process.env.LEGACY_HOSTS, process.env.AUTH_URL);
  if (moved) return NextResponse.redirect(moved, 308);

  // app-shell: Erreichbarkeit nur über HTTPS (Azure ingress also redirects; this covers other proxies)
  if (process.env.FORCE_HTTPS === 'true' && req.headers.get('x-forwarded-proto') === 'http') {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  const session = req.auth;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!session) {
    if (isPublic) return NextResponse.next();
    const url = new URL('/login', req.nextUrl);
    if (SESSION_COOKIES.some((c) => req.cookies.has(c))) url.searchParams.set('expired', '1');
    if (pathname !== '/') url.searchParams.set('callbackUrl', pathname + search);
    const res = NextResponse.redirect(url);
    SESSION_COOKIES.forEach((c) => res.cookies.delete(c));
    return res;
  }

  // An invitation link opened while signed in still shows the invitation (e.g. a second account on the iPad)
  if (pathname === '/login') return NextResponse.redirect(new URL('/', req.nextUrl));
  return NextResponse.next();
});

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
