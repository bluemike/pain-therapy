import { expect, test } from '@playwright/test';
import { fillPatient, login, unique } from './helpers';

/**
 * ui-foundation: screenshots of the main screens on iPhone, iPad and desktop size (task 3.2).
 * They are written to test-results/screenshots/<project>/ and uploaded by CI for review.
 */
test('main screens', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `test-results/screenshots/${info.project.name}/${name}.png`, fullPage: true });
  await page.goto('/login');
  await shot('01-login');
  await login(page);
  await shot('02-dashboard');
  await page.goto('/patients');
  await shot('03-patients');
  if (info.project.name === 'iphone') {
    await page.getByRole('button', { name: 'Menü' }).click();
    await expect(page.getByRole('link', { name: 'Patienten' }).last()).toBeVisible();
    await shot('03b-menu');
    await page.getByRole('button', { name: 'Menü' }).click();
  }
  await page.goto('/patients/new');
  await shot('04-new-patient');
  await fillPatient(page, {
    first: 'Sarah',
    last: `Thompson${unique()}`,
    dob: '08.11.1990',
    lang: 'en',
    email: 'sarah@example.com',
  });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Sarah Thompson/ })).toBeVisible();
  await shot('05-record');
  await page.getByRole('button', { name: 'An Patient:in übergeben' }).first().click();
  await expect(page.getByRole('heading', { name: 'Liability waiver and consent' })).toBeVisible();
  await shot('06-signing');
});
