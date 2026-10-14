import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 3000);
/** Patient zone (apps/patient-zone, iteration 4) with its own database role patient_zone */
const ZONE_PORT = Number(process.env.ZONE_PORT ?? 3100);
const ZONE_URL = `http://localhost:${ZONE_PORT}`;
process.env.ZONE_URL = ZONE_URL;
// Mails land here (MAIL_DRIVER=outbox); tests/e2e/patient-zone.spec.ts reads the link from them
process.env.E2E_OUTBOX_DIR ??= path.resolve('data/e2e-outbox');
const zoneDatabaseUrl = () => {
  const url = new URL(process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/pain_therapy');
  url.username = 'patient_zone';
  url.password = process.env.PATIENT_ZONE_DB_PASSWORD ?? 'patient_zone';
  return url.toString();
};

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    {
      name: 'ipad',
      testMatch: /(signing|screenshots)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false },
    },
    {
      name: 'iphone',
      testMatch: /screenshots\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: [
    {
      command: process.env.CI ? 'npm run start' : 'npm run dev',
      url: `http://localhost:${PORT}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { PATIENT_ZONE_URL: ZONE_URL, MAIL_OUTBOX_DIR: process.env.E2E_OUTBOX_DIR },
    },
    {
      command: process.env.CI
        ? 'npm run start -w @pain-therapy/patient-zone'
        : 'npm run dev -w @pain-therapy/patient-zone',
      url: `${ZONE_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        DATABASE_URL: zoneDatabaseUrl(),
        PATIENT_ZONE_SECRET: 'e2e-only-patient-zone-secret',
        STORAGE_DRIVER: 'local',
        STORAGE_EXERCISE_LOCAL_DIR: path.resolve('data/exercise-media'),
      },
    },
  ],
});
