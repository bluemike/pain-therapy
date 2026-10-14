import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  {
    // apps/patient-zone has its own configuration (npm run lint runs both)
    ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts', 'apps/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];

export default config;
