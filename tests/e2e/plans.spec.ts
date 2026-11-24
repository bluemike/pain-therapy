import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, login, unique } from './helpers';

/** Iteration 17: usage and plans on the platform page (design D5 to D7), fields in the form text (design D1) */
test.describe('plans, usage and form fields', () => {
  test('the platform account sees the usage of a practice and adds a plan', async ({ page }) => {
    const id = unique();
    await login(page, { role: 'platform', name: 'Plattform Admin', email: `platform.${id}@example.test` });
    const card = page.getByTestId('practice').filter({ hasText: 'Pain Therapy Falera' }).first();
    const usage = card.getByTestId('practice-usage');
    await expect(usage.getByText('Zuletzt angemeldet')).toBeVisible();
    await expect(usage.getByText('Zuletzt geändert')).toBeVisible();
    await expect(usage.getByText('Patient:innen', { exact: true })).toBeVisible();
    await expect(usage.getByText('Sitzungen', { exact: true })).toBeVisible();

    const plans = page.getByTestId('plans');
    await expect(plans.getByTestId('plan').filter({ hasText: 'Freemium' })).toContainText('Limite 20');
    await plans.getByText('Modell anlegen', { exact: true }).first().click();
    await plans.getByLabel('Name').last().fill(`Premium ${id}`);
    await plans.getByLabel('Patientenlimite').last().fill('100');
    await plans.getByRole('button', { name: 'Modell anlegen' }).click();
    await expect(page.getByText('Das Modell ist angelegt.')).toBeVisible();
    await expect(page.getByTestId('plan').filter({ hasText: `Premium ${id}` })).toContainText('Limite 100');
    await expectNoA11yViolations(page, 'platform-plans');
  });

  test('the practice admin sees the fields with the practice details and refuses an unknown field', async ({
    page,
  }) => {
    await login(page);
    await page.goto('/admin/consent-texts');
    const fields = page.getByTestId('fields-de');
    await expect(fields.getByRole('button', { name: '«Praxisname»' })).toBeVisible();
    await expect(fields).toContainText('Pain Therapy');
    // Iteration 18: by default a new version is signed at the next treatment or session
    const mode = page.getByTestId('resign-mode');
    await expect(mode.getByRole('radio', { name: /Bei der nächsten Behandlung oder Sitzung/ })).toBeChecked();
    await expect(mode.getByRole('radio', { name: /Sofort von allen/ })).not.toBeChecked();
    await page.getByLabel('Text (Deutsch)').fill('## 3. Datenschutzhinweis\n- «Praxisname»\n- «Praxisnam»');
    await page.getByText('Vorschau Deutsch').click();
    await expect(page.locator('.consent-preview').first()).not.toContainText('«Praxisname»');
    await page.getByRole('button', { name: /veröffentlichen$/ }).click();
    await expect(page.getByText(/Unbekanntes Feld «Praxisnam»/)).toBeVisible();
  });
});
