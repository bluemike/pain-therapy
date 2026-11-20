import { expect, test } from '@playwright/test';
import { confirmInZone, fillPatient, inviteFromOutbox, login, outboxFiles, phone, unique } from './helpers';

/** practice-settings (iteration 12, task 3.1 to 3.4): Seite «Praxis», Logo, Zone mit Praxisangaben, neutrale Marke */

// 1×1 PNG
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('practice-settings', () => {
  test('only the Praxis-Admin opens the page «Praxis» (Nur Praxis-Admin)', async ({ page }) => {
    await login(page, { role: 'Therapist' });
    await expect(page.getByRole('link', { name: 'Praxis', exact: true })).toHaveCount(0);
    await page.goto('/practice');
    await expect(page.getByText('Für diese Seite fehlt Ihnen die Berechtigung.')).toBeVisible();
  });

  test('the Praxis-Admin changes details and logo; the header shows the logo', async ({ page }) => {
    await login(page, { role: 'Therapist,Admin' });
    await page.getByRole('link', { name: 'Praxis', exact: true }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Praxis' })).toBeVisible();
    await expect(page.getByText(/Kopfzeile im PDF: .*Via Prau da Cuort 5 \| 7153 Falera/)).toBeVisible();

    await page.getByLabel('Kürzel für Dokumentnummern').fill('P1');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Bitte 2 bis 4 Grossbuchstaben eingeben.')).toBeVisible();

    await page.getByLabel('Kürzel für Dokumentnummern').fill('PT');
    await page.getByLabel('Telefon').fill('081 000 00 00');
    await page.getByLabel('Logo hochladen').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/^Praxis gespeichert\./)).toBeVisible();
    await expect(page.locator('header img.plogo')).toHaveAttribute('alt', 'Pain Therapy Falera');

    // Back to the name as text for the other tests
    await page.getByLabel('Logo entfernen').check();
    await page.getByLabel('Telefon').fill('');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/^Praxis gespeichert\./)).toBeVisible();
    await expect(page.locator('header img.plogo')).toHaveCount(0);
    await expect(page.locator('header')).toContainText('Pain Therapy Falera');
    await expect(page.getByText('Pain Therapy · betrieben von Ayanta')).toBeVisible();
  });

  test('the zone names the practice of the patient, an invalid link names no address', async ({ page }) => {
    const zone = process.env.ZONE_URL!;
    const patient = await phone(page.context().browser()!);
    await patient.goto(`${zone}/l/${'x'.repeat(43)}`);
    await expect(patient.getByTestId('invalid')).toContainText('Bitte wenden Sie sich an die Praxis.');
    await expect(patient.locator('body')).not.toContainText(/ayanta/i);

    await login(page);
    const id = unique();
    const first = `Zone${id}`;
    const email = `${first.toLowerCase()}@example.ch`;
    await page.goto('/patients/new');
    await fillPatient(page, { first, last: `Praxis${id}`, dob: '05.03.1980', email });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/ist angelegt/)).toBeVisible();
    const before = await outboxFiles();
    await page.locator('.banner').getByRole('button', { name: 'Zur Unterschrift einladen' }).click();
    const dialog = page.getByTestId('invite-dialog').filter({ visible: true });
    await dialog.getByRole('button', { name: `Per E-Mail an ${email}` }).click();
    await expect(dialog.getByText(`Die Einladung geht per E-Mail an ${email}.`)).toBeVisible();
    const link = await inviteFromOutbox(email, before);
    await confirmInZone(patient, link, '05.03.1980');
    await expect(patient.locator('header.top')).toContainText('Pain Therapy Falera');
    await expect(patient.locator('footer')).toContainText(
      'Fragen: Pain Therapy Falera · christina.franz@pain-therapy.online',
    );
    await patient.getByRole('link', { name: 'Datenschutz' }).click();
    await expect(patient.getByText(/Via Prau da Cuort 5 \| 7153 Falera/)).toBeVisible();
    await patient.context().close();
  });
});
