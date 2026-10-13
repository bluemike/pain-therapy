import { expect, test } from '@playwright/test';
import { fillPatient, login, unique } from './helpers';

test.describe('patient-records', () => {
  test.beforeEach(async ({ page }) => login(page));

  test('validates required fields, email and "andere"', async ({ page }) => {
    await page.goto('/patients/new');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Nicht gespeichert. Bitte prüfen Sie die markierten Felder.')).toBeVisible();
    await expect(page.locator('.f.bad')).toHaveCount(4);
    await fillPatient(page, { first: 'Eva', last: `Test${unique()}`, dob: '31.02.1980', email: 'eva@' });
    await page.getByText('andere').first().click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Bitte als TT.MM.JJJJ eingeben, z. B. 05.03.1980.')).toBeVisible();
    await expect(page.getByText(/gültige E-Mail-Adresse/)).toBeVisible();
    await expect(page.getByText('Bitte beschreiben.')).toBeVisible();
  });

  test('create, find, edit with history, deactivate and reactivate', async ({ page }) => {
    const last = `Brunner${unique()}`;
    await page.goto('/patients/new');
    await fillPatient(page, {
      first: 'Lena',
      last,
      dob: '17.02.1985',
      email: 'lena@example.ch',
      street: 'Lindenweg 9',
    });
    await page.getByText('Osteoporose').click();
    await page.getByText('Diabetes').click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(`Lena ${last} ist angelegt.`)).toBeVisible();
    await expect(page.getByRole('heading', { name: `Lena ${last}` })).toBeVisible();

    await page.getByRole('link', { name: 'Anamnese' }).click();
    await expect(page.locator('.tag', { hasText: 'Osteoporose' })).toBeVisible();
    await expect(page.locator('.tag', { hasText: 'Diabetes' })).toBeVisible();

    // Duplicate warning
    await page.goto('/patients/new');
    await fillPatient(page, { first: 'Lena', last, dob: '17.02.1985' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('heading', { name: 'Mögliche Dublette' })).toBeVisible();
    await page.getByRole('link', { name: 'Bestehende Akte öffnen' }).click();
    await expect(page.getByRole('heading', { name: `Lena ${last}` })).toBeVisible();

    // Search
    await page.goto('/patients');
    await page.locator('#lq').fill(last);
    await expect(page.locator('table.list tbody tr')).toHaveCount(1);

    // Edit address, then the history shows old and new value
    await page
      .locator('table.list')
      .getByRole('link', { name: new RegExp(last) })
      .click();
    await page.getByRole('link', { name: 'Bearbeiten' }).click();
    await page.locator('#f_street').fill('Lindenweg 11');
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible();
    await page.getByRole('link', { name: 'Änderungshistorie' }).click();
    const row = page.locator('table.hist tr', { hasText: 'Strasse, Nr. geändert' });
    await expect(row.locator('del')).toHaveText('Lindenweg 9');
    await expect(row.locator('ins')).toHaveText('Lindenweg 11');

    // Deactivate
    await page.getByRole('button', { name: 'Deaktivieren' }).click();
    await page.getByLabel('Grund (optional)').fill('Behandlung abgeschlossen');
    await page.getByRole('dialog').getByRole('button', { name: 'Deaktivieren' }).click();
    await expect(page.getByText(/ist seit .* inaktiv. Grund: Behandlung abgeschlossen/)).toBeVisible();
    await page.goto(`/patients?q=${last}`);
    await expect(page.getByText(`Keine Treffer für «${last}».`)).toBeVisible();
    await page.getByRole('link', { name: 'Inaktiv' }).click();
    await expect(page.locator('table.list tbody tr')).toHaveCount(1);

    // Reactivate
    await page
      .locator('table.list')
      .getByRole('link', { name: new RegExp(last) })
      .click();
    await page.getByRole('button', { name: 'Reaktivieren' }).click();
    await expect(page.getByText(`Lena ${last} ist wieder aktiv.`)).toBeVisible();
  });

  test('language switch to English is remembered', async ({ page }) => {
    await page.getByRole('button', { name: 'EN' }).first().click();
    await expect(page.getByRole('link', { name: 'Patients' }).first()).toBeVisible();
    await page.goto('/patients');
    await expect(page.getByRole('heading', { name: 'Patients' })).toBeVisible();
    await page.getByRole('button', { name: 'DE' }).first().click();
    await expect(page.getByRole('heading', { name: 'Patienten' })).toBeVisible();
  });
});
