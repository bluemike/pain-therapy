import { expect, test } from '@playwright/test';
import { createSignedPatient, fillPatient, login, unique } from './helpers';
import { TINY_JPEG, withExif } from '../fixtures/jpeg';

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
  await page.getByRole('button', { name: 'Zur Unterschrift einladen' }).first().click();
  await expect(page.getByTestId('invite-dialog').filter({ visible: true })).toBeVisible();
  await shot('06-invite');
});

/** Iteration 2: record with treatments, treatment form, session form and catalog (task 5.2, 5.3 preparation) */
test('treatment screens', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `test-results/screenshots/${info.project.name}/${name}.png`, fullPage: true });
  await login(page);
  await createSignedPatient(page, { first: 'Anna', last: `Müller${unique()}`, dob: '05.03.1980' });
  await shot('10-record-empty');
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await page.locator('#f_regionId').selectOption('6');
  await page.locator('#f_painStart').selectOption('60');
  await page.locator('#f_diagnosis').fill('Lumbalgie rechts, ausstrahlend in die Leiste');
  await page
    .locator('#f_photos')
    .setInputFiles([{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: withExif(TINY_JPEG) }]);
  await expect(page.locator('.ph.new')).toHaveCount(1);
  await shot('11-new-treatment');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
  await page.locator('section.treat').first().getByRole('link', { name: 'Sitzung', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sitzung Nr. 1' })).toBeVisible();
  await page.getByRole('group', { name: 'Schmerz vorher, %' }).getByRole('button', { name: '60' }).click();
  await page.getByTestId('point-filter').selectOption('all');
  await page.getByLabel('Punkt 2.11.1 rechts behandelt').check();
  await page
    .getByRole('group', { name: 'Empfindlichkeit Punkt 2.11.1' })
    .getByRole('button', { name: 'stark' })
    .click();
  await shot('12-session');
  await page.getByRole('button', { name: 'Sitzung speichern' }).click();
  await expect(page.getByText('Sitzung Nr. 1 gespeichert.')).toBeVisible();
  await shot('13-record-treatments');
  await page.goto('/catalog?tab=points&region=6');
  await shot('14-catalog-points');
});

/** Iteration 3: block "Selbstausführung", Abschluss and the catalog exercise (task 4.3 preparation) */
test('home exercise screens', async ({ page }, info) => {
  const shot = (name: string) =>
    page.screenshot({ path: `test-results/screenshots/${info.project.name}/${name}.png`, fullPage: true });
  await login(page);
  await createSignedPatient(page, { first: 'Anna', last: `Heim${unique()}`, dob: '05.03.1980', emailConsent: true });
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await page.locator('#f_regionId').selectOption('6');
  await page.locator('#f_painStart').selectOption('60');
  await page.locator('#f_diagnosis').fill('Lumbalgie');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
  await page.locator('section.treat').first().getByRole('link', { name: 'Sitzung', exact: true }).click();
  await page.getByLabel('Übung 2A verordnet').check();
  await page.getByLabel('Übung 2D verordnet').check();
  const group = (name: string) => page.getByRole('group', { name, exact: true });
  for (const d of ['Samstag', 'Sonntag']) await group('Übung 2D: Wochentage').getByRole('button', { name: d }).click();
  await page.getByLabel('Übung 2C verordnet').check();
  await page.getByLabel('Übung 2C: EPD').selectOption('1');
  for (const code of ['2A', '2C', '2D'])
    await group(`Übung ${code}: Übung fällt`).getByRole('button', { name: 'mittel' }).click();
  await page.locator('section[aria-labelledby="h_home"]').scrollIntoViewIfNeeded();
  await shot('20-home-exercises');
  await page.getByRole('button', { name: 'Sitzung speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
  await shot('21-handout');
  await page.goto('/catalog/exercises/2A');
  await shot('22-catalog-exercise');
});
