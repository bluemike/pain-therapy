import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createSignedPatient, fillPatient, login, unique } from './helpers';
import { TINY_JPEG } from '../fixtures/jpeg';

/** ui-foundation: axe check, no WCAG 2.1 AA violations (task 3.4) */
async function expectNoViolations(page: Page, name: string) {
  // @axe-core/playwright is typed against its own playwright-core copy
  const { violations } = await new AxeBuilder({ page: page as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary, `${name} has accessibility violations`).toEqual([]);
}

test('sign-in and "Kein Zugang" pages', async ({ page }) => {
  await page.goto('/login');
  await expectNoViolations(page, 'login');
  await page.goto('/no-access?reason=noRole');
  await expectNoViolations(page, 'no-access');
});

test('app pages and the patient signing page', async ({ page }) => {
  await login(page);
  await expectNoViolations(page, 'dashboard');
  await page.goto('/patients');
  await expectNoViolations(page, 'patient list');
  await page.goto('/patients/new');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Nicht gespeichert.', { exact: false })).toBeVisible();
  await expectNoViolations(page, 'form with errors');
  await fillPatient(page, { first: 'Nora', last: `Axe${unique()}`, dob: '12.04.1979', email: 'nora@example.ch' });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^Nora Axe/ })).toBeVisible();
  await expectNoViolations(page, 'patient record');
  const recordUrl = page.url();
  for (const tab of ['Anamnese', 'Dokumente', 'Änderungshistorie']) {
    await page
      .locator('nav.tabs')
      .getByRole('link', { name: new RegExp(`^${tab}`) })
      .click();
    await expectNoViolations(page, `record tab ${tab}`);
  }
  await page.goto('/admin/consent-texts');
  await expectNoViolations(page, 'form texts');
  await page.goto(recordUrl);
  await page.getByRole('button', { name: 'Zur Unterschrift einladen' }).first().click();
  await expect(page.getByTestId('invite-dialog').filter({ visible: true })).toBeVisible();
  await expectNoViolations(page, 'invitation dialog');
});

/** Iteration 2, task 5.2: record with treatments, treatment form, consultation and catalog */
test('treatments, consultation and catalog', async ({ page }) => {
  // Twelve axe passes, since iteration 7 with preview and audio for every exercise; close to 30 s on slow runners
  test.setTimeout(60_000);
  await login(page);
  await createSignedPatient(page, { first: 'Vera', last: `Axe${unique()}`, dob: '03.09.1972' });
  await expectNoViolations(page, 'record, no treatment yet');
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await expectNoViolations(page, 'new treatment');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Nicht gespeichert.', { exact: false })).toBeVisible();
  await expectNoViolations(page, 'new treatment with errors');
  await page.locator('#f_regionId').selectOption('6');
  await page.locator('#f_painStart').selectOption('50');
  await page.locator('#f_diagnosis').fill('Lumbalgie');
  await page.locator('#f_photos').setInputFiles([{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: TINY_JPEG }]);
  await expect(page.locator('.ph.new')).toHaveCount(1);
  await expectNoViolations(page, 'new treatment with photo preview');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
  await page.locator('section.treat').first().getByRole('link', { name: 'Konsultation', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konsultation Nr. 1' })).toBeVisible();
  await page
    .getByRole('group', { name: 'Empfindlichkeit Punkt 2.11.1' })
    .getByRole('button', { name: 'stark' })
    .click();
  await page.getByRole('button', { name: 'Punkt aus anderem Bereich' }).click();
  await expectNoViolations(page, 'consultation');
  await page.getByRole('button', { name: 'Konsultation speichern' }).click();
  await expect(page.getByText('Konsultation Nr. 1 gespeichert.')).toBeVisible();
  await expectNoViolations(page, 'record with treatment and consultation');
  await page.locator('.conslist a').first().click();
  await expectNoViolations(page, 'saved consultation');
  for (const tab of ['', '?tab=points&region=6', '?tab=points', '?tab=exercises', '?tab=tools']) {
    await page.goto(`/catalog${tab}`);
    await expectNoViolations(page, `catalog ${tab || 'regions'}`);
  }
});

/** Iteration 3, task 4.2: block "Selbstausführung", Abschluss with the exercise sheet and the catalog exercise */
test('home exercises, exercise sheet and catalog exercise', async ({ page }) => {
  await login(page);
  await createSignedPatient(page, { first: 'Lea', last: `Axe${unique()}`, dob: '21.06.1985', emailConsent: true });
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await page.locator('#f_regionId').selectOption('6');
  await page.locator('#f_painStart').selectOption('50');
  await page.locator('#f_diagnosis').fill('Lumbalgie');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
  await page.locator('section.treat').first().getByRole('link', { name: 'Konsultation', exact: true }).click();
  await page.getByLabel('Übung 2A verordnet').check();
  await page.getByLabel('Übung 2C verordnet').check();
  await page
    .getByRole('group', { name: 'Wiederholung 2A wöchentlich', exact: true })
    .getByRole('button', { name: '3x' })
    .click();
  await page.locator('section[aria-labelledby="h_home"]').getByRole('button', { name: '+ Übung hinzufügen' }).click();
  await expectNoViolations(page, 'consultation with home exercises');
  await page.getByRole('button', { name: 'Konsultation speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
  await expectNoViolations(page, 'Abschluss');
  await page.getByRole('button', { name: 'Übungsblatt senden' }).click();
  await expect(page.getByText(/Übungsblatt PT-\d{4}-\d{5} erstellt/)).toBeVisible();
  await expectNoViolations(page, 'Abschluss after sending');
  for (const code of ['2A', '1C']) {
    await page.goto(`/catalog/exercises/${code}`);
    await expectNoViolations(page, `catalog exercise ${code}`);
  }
});
