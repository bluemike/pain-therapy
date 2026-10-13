import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { fillPatient, login, scrollReaderToEnd, unique } from './helpers';

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
  await page.getByRole('button', { name: 'An Patient:in übergeben' }).first().click();
  await expect(page.getByRole('heading', { name: 'Haftungsausschluss und Einwilligung' })).toBeVisible();
  await expectNoViolations(page, 'signing page');
  await scrollReaderToEnd(page);
  await expectNoViolations(page, 'signing page after reading');
});
