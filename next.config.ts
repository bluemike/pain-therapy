import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  output: 'standalone',
  // The Azure SDKs stay in node_modules (traced into the standalone output) so that prisma/catalog/sync.mjs can load
  // them in the migration job to read exercises-content.json from the container exercise-media
  serverExternalPackages: ['@react-pdf/renderer', '@azure/storage-blob', '@azure/identity'],
  // pdfkit loads its standard fonts and data files dynamically, which file tracing misses
  outputFileTracingIncludes: {
    '/**': [
      './node_modules/pdfkit/js/data/**/*',
      './node_modules/pdfkit/js/standard-fonts/**/*',
      './assets/fonts/**/*',
    ],
  },
  poweredByHeader: false,
  experimental: {
    // clinical-photos: forms with up to 10 resized photos go through Server Actions (design D6)
    serverActions: { bodySizeLimit: '25mb' },
    // The middleware sees every request body; without this, uploads above 10 MB would be cut off
    middlewareClientMaxBodySize: '25mb',
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
