import { NextResponse, type NextRequest } from 'next/server';

/**
 * patient-zone-app: Datenschutz und Sicherheit (design D14). Strict content security policy with a nonce per
 * request and no third-party sources; Next.js adds the nonce to its scripts. HTTP is redirected to HTTPS behind a
 * proxy that forwards x-forwarded-proto (Azure ingress also redirects).
 */
export function contentSecurityPolicy(nonce: string, dev: boolean) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    // Development injects styles at runtime; production serves only the CSS files
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function middleware(req: NextRequest) {
  if (process.env.FORCE_HTTPS === 'true' && req.headers.get('x-forwarded-proto') === 'http') {
    const url = req.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV !== 'production');
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
