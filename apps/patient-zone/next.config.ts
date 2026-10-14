import path from 'node:path';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Patient zone (patient-zone-app, iteration 4 design D11, D14): separate Next.js app with its own image. The content
 * security policy with a nonce is set per request in src/middleware.ts; the other security headers are static.
 */
const nextConfig: NextConfig = {
  output: 'standalone',
  // npm workspaces: trace from the repository root so the hoisted node_modules (Prisma client) are included
  outputFileTracingRoot: path.join(__dirname, '../..'),
  transpilePackages: ['@pain-therapy/shared'],
  serverExternalPackages: ['@azure/storage-blob', '@azure/identity'],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
