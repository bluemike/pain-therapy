import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isAllowedInPatientMode } from '@/lib/patient-mode';

const PUBLIC = ['/login', '/no-access', '/api/auth', '/api/health'];
const SESSION_COOKIES = ['authjs.session-token', '__Secure-authjs.session-token'];

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

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

  // consent-signing: Patientenmodus shows nothing but the signing screens of that one session
  const pm = session.patientMode;
  if (pm) {
    if (isAllowedInPatientMode(pathname, pm.sid)) return NextResponse.next();
    return NextResponse.redirect(new URL(`/sign/${pm.sid}`, req.nextUrl));
  }
  if (pathname.startsWith('/sign/')) return NextResponse.redirect(new URL('/', req.nextUrl));
  if (pathname === '/login') return NextResponse.redirect(new URL('/', req.nextUrl));
  return NextResponse.next();
});

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
