import { expect, test } from '@playwright/test';
import { drawSignature, fillPatient, login, scrollReaderToEnd, unique } from './helpers';

/** Task 8.1: sign in, create a patient, hand over, read, sign, return, PDF in the record, email noted. */
test.describe('consent-signing and consent-documents', () => {
  test('full flow in the patient language', async ({ page }) => {
    const last = `Thompson${unique()}`;
    await login(page);
    await page.goto('/patients/new');
    await fillPatient(page, { first: 'Sarah', last, dob: '22.07.1991', lang: 'en', email: 'sarah@example.com' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/ist angelegt/)).toBeVisible();
    const recordUrl = page.url().split('?')[0];

    await page.locator('.banner').getByRole('button', { name: 'An Patient:in übergeben' }).click();
    await expect(page.getByRole('heading', { name: 'Liability waiver and consent' })).toBeVisible();
    await expect(page.locator('.pm')).toHaveAttribute('lang', 'en');

    // Patient mode: no other page reachable
    await page.goto('/patients');
    await expect(page.getByRole('heading', { name: 'Liability waiver and consent' })).toBeVisible();
    await page.goto(recordUrl);
    await expect(page).toHaveURL(/\/sign\//);
    await expect(page.locator('nav.nav')).toHaveCount(0);

    // Signature and consents locked until the text was read
    await expect(page.getByText('Please read the text to the end first')).toBeVisible();
    await expect(page.getByTestId('consent-liability')).toBeDisabled();
    await page.getByRole('button', { name: 'Sign', exact: true }).click();
    await expect(page.getByText('Please read the text to the end first.')).toBeVisible();

    await page.getByLabel('Is something wrong? Note it here.').fill('New mobile: 079 000 11 22');
    await scrollReaderToEnd(page);
    await page.getByTestId('consent-liability').check();
    await page.getByTestId('consent-unencryptedEmail').check();
    await page.getByRole('button', { name: 'Sign', exact: true }).click();
    await expect(page.getByText('Unfortunately, treatment is not possible without this consent.')).toBeVisible();
    await expect(page.getByText('Please sign in the box.')).toBeVisible();
    await page.getByTestId('consent-dataProcessing').check();
    await drawSignature(page);
    await page.getByRole('button', { name: 'Clear signature' }).click();
    await page.getByRole('button', { name: 'Sign', exact: true }).click();
    await expect(page.getByText('Please sign in the box.')).toBeVisible();
    await drawSignature(page);
    await page.getByRole('button', { name: 'Sign', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Thank you, Sarah' })).toBeVisible();
    await expect(page.getByText('You will receive the signed document by email at sarah@example.com.')).toBeVisible();
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Thank you, Sarah' })).toBeVisible();

    // Back to the practice only with a new sign-in
    await page.getByRole('link', { name: 'Back to practice' }).click();
    await expect(page.getByRole('heading', { name: 'Patientenmodus verlassen' })).toBeVisible();
    await page.getByRole('button', { name: 'Erneut anmelden' }).click();
    await expect(page.getByText(/Haftungsausschluss unterschrieben · Sarah/)).toBeVisible();
    await expect(page.getByText('«New mobile: 079 000 11 22»')).toBeVisible();
    await expect(page.locator('.mono')).toHaveText(/^[0-9a-f]{64}$/);
    await expect(page.getByText(/Per E-Mail an sarah@example.com gesendet|E-Mail wird gesendet/)).toBeVisible();

    // PDF in the record
    await page.getByRole('link', { name: 'Zur Akte' }).click();
    await expect(page.getByText('gültig')).toBeVisible();
    await expect(page.getByText(/Textversion \d+/)).toBeVisible();
    await expect
      .poll(
        async () => {
          await page.reload();
          return page.getByText(/Per E-Mail an sarah@example.com gesendet/).count();
        },
        { timeout: 15_000 },
      )
      .toBe(1);
    const pdfLink = page.getByRole('link', { name: 'PDF öffnen' });
    const href = await pdfLink.getAttribute('href');
    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
    await expect(page.locator('.pill', { hasText: 'Unterschrieben' })).toBeVisible();
  });

  test('aborting keeps the disclaimer unsigned', async ({ page }) => {
    const last = `Abbruch${unique()}`;
    await login(page);
    await page.goto('/patients/new');
    await fillPatient(page, { first: 'Peter', last, dob: '30.01.1955' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.locator('.banner').getByRole('button', { name: 'An Patient:in übergeben' }).click();
    await expect(page.getByRole('heading', { name: 'Haftungsausschluss und Einwilligung' })).toBeVisible();
    await page.getByRole('link', { name: 'Praxis' }).click();
    await expect(page.getByText(/bleibt in der Akte als «nicht unterschrieben»/)).toBeVisible();
    await page.getByRole('button', { name: 'Erneut anmelden' }).click();
    await expect(page.getByText(/Unterschrift abgebrochen/)).toBeVisible();
    await page.getByRole('link', { name: 'Zur Akte' }).click();
    await expect(
      page.getByText(/Der Haftungsausschluss ist noch nicht unterschrieben.*Unterschrift am .* abgebrochen/),
    ).toBeVisible();
  });
});
