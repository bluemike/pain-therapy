import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { expectNoA11yViolations, login, unique } from './helpers';

/**
 * Iteration 12, phase 5: the platform account creates, suspends, exports and deletes a practice (design D3, D9); the
 * practice admin invites people on «Team» (design D4).
 */
test.describe('platform and team', () => {
  test('a therapist signing in on a platform link lands on the start page', async ({ page }) => {
    // The platform account signed out on /platform, a therapist signs in on the same device
    await login(page, { role: 'Therapist', name: 'Thea Test', email: `thea.${unique()}@example.test` });
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Kein Zugang')).toHaveCount(0);
  });

  test('the platform account manages a practice from creation to deletion', async ({ page }) => {
    test.setTimeout(120_000);
    const id = unique();
    const slug = `e2e-${id}`;
    await login(page, { role: 'platform', name: 'Plattform Admin', email: `platform.${id}@example.test` });
    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Praxen' })).toBeVisible();
    // No patient data: the practice navigation is not there
    await expect(page.getByRole('link', { name: 'Patienten' })).toHaveCount(0);
    await expectNoA11yViolations(page, 'platform');

    const form = page.locator('section', { has: page.getByRole('heading', { name: 'Neue Praxis' }) });
    await form.getByLabel(/^Name der Praxis \*/).fill(`E2E Praxis ${id}`);
    await form.getByLabel(/^Kurzname/).fill(slug);
    await form.getByLabel(/^Ort/).fill('Chur');
    await form.getByLabel(/^Kontakt-E-Mail/).fill(`praxis.${id}@example.test`);
    await form.getByLabel(/^Kürzel/).fill('EP');
    await form.getByLabel(/^Name der Praxis-Admin/).fill('Erika Praxis');
    await form.getByLabel(/^E-Mail der Praxis-Admin/).fill(`erika.${id}@example.test`);
    await page.getByRole('button', { name: 'Praxis anlegen und einladen' }).click();
    await expect(page.getByText('Die Praxis ist angelegt und die Praxis-Admin eingeladen.')).toBeVisible();
    const card = page.getByTestId('practice').filter({ hasText: `E2E Praxis ${id}` });
    await expect(card).toContainText(`Einladung offen: erika.${id}@example.test`);

    // Iteration 13: details of an existing practice, with the invitation of a further practice admin
    await card.locator('summary', { hasText: 'Praxisangaben und Praxis-Admin' }).click();
    await expect(card.getByLabel(/^Ort \*/)).toHaveValue('Chur');
    await expect(card.getByLabel(/^Ort \*/)).toHaveCSS('border-top-style', 'solid');
    await card.getByLabel(/^Ort \*/).fill('Falera');
    await card.getByLabel(/^Standardort/).fill('Falera');
    await card.getByLabel(/^Telefon/).fill('081 000 00 00');
    await expect(card.getByRole('button', { name: 'Angaben speichern' })).toBeVisible();
    await card.getByLabel(/^Name der Praxis-Admin/).fill('Chris Praxis');
    await card.getByLabel(/^E-Mail der Praxis-Admin/).fill(`chris.${id}@example.test`);
    await expectNoA11yViolations(page, 'platform details');
    await card.getByRole('button', { name: 'Speichern und einladen' }).click();
    await expect(page.getByText('Die Praxisangaben sind gespeichert und die Praxis-Admin eingeladen.')).toBeVisible();
    await expect(card).toContainText(`chris.${id}@example.test`);
    await card.locator('summary', { hasText: 'Praxisangaben und Praxis-Admin' }).click();
    await expect(card.getByLabel(/^Ort \*/)).toHaveValue('Falera');
    await expect(card.getByLabel(/^Telefon/)).toHaveValue('081 000 00 00');

    await card.getByRole('button', { name: 'Sperren' }).click();
    await expect(page.getByText('Die Praxis ist gesperrt.')).toBeVisible();
    await expect(card.locator('h2 .pill')).toHaveText('gesperrt');
    await card.locator('summary', { hasText: 'Praxis löschen' }).click();
    await card.getByLabel(/^Zur Bestätigung/).fill(slug);
    await card.getByLabel(/Ich habe den Export gesichert/).check();
    await card.getByRole('button', { name: 'Praxis löschen' }).click();
    await expect(page.getByText('Bitte zuerst einen Export erstellen und herunterladen.')).toBeVisible();

    await card.getByRole('button', { name: 'Export erstellen' }).click();
    await expect(page.getByText('Der Export wird erstellt.')).toBeVisible();
    const download = card.getByRole('link', { name: /^Herunterladen/ });
    await expect(async () => {
      await page.reload();
      await expect(download).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 20_000 });
    const res = await page.request.get((await download.getAttribute('href'))!);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/zip');

    await card.locator('summary', { hasText: 'Praxis löschen' }).click();
    await card.getByLabel(/^Zur Bestätigung/).fill(slug);
    await card.getByLabel(/Ich habe den Export gesichert/).check();
    await card.getByRole('button', { name: 'Praxis löschen' }).click();
    await expect(page.getByText('Die Praxis ist gelöscht.')).toBeVisible();
    await expect(card.locator('h2 .pill')).toContainText('gelöscht am');
  });

  test('the practice admin invites a person and withdraws the invitation', async ({ page }) => {
    const id = unique();
    await login(page);
    await page.getByRole('link', { name: 'Team' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Team' })).toBeVisible();
    await expect(page.getByTestId('member').filter({ hasText: 'Mike Franz (Sie)' })).toBeVisible();
    await page.getByLabel('Name', { exact: true }).fill('Tina Test');
    // Iteration 16: SMS is preselected; this invitation goes by e-mail to the person's own address
    await page.getByLabel('per E-Mail', { exact: true }).check();
    await page.getByLabel('E-Mail', { exact: true }).fill(`tina.${id}@example.test`);
    await page.getByRole('button', { name: 'Einladung senden' }).click();
    await expect(page.getByText('Die Einladung ist unterwegs.')).toBeVisible();
    const invitation = page.getByTestId('invitation').filter({ hasText: `tina.${id}@example.test` });
    await expect(invitation).toContainText('Therapeut:in');
    await expectNoA11yViolations(page, 'team');
    await invitation.getByRole('button', { name: 'Zurückziehen' }).click();
    await expect(page.getByText('Die Einladung gilt nicht mehr.')).toBeVisible();
    await expect(invitation).toHaveCount(0);
  });

  test('a person invited by SMS gets a new mailbox, and the platform account hands over its access', async ({
    browser,
    page,
  }) => {
    test.setTimeout(90_000);
    const id = unique();
    const address = `nora.${id}@pain-therapy.online`;
    await login(page);
    await page.getByRole('link', { name: 'Team' }).first().click();
    await page.getByLabel('Name', { exact: true }).fill(`Nora ${id}`);
    await page.getByLabel('Handynummer').fill('079 123 45 67');
    await page.getByRole('radio', { name: /Neues Postfach @pain-therapy\.online/ }).check();
    // A brand-new mailbox is read by nobody yet: e-mail is not offered
    await expect(page.getByLabel('per E-Mail', { exact: true })).toBeDisabled();
    await page.getByLabel('Neue Adresse').fill(`nora.${id}`);
    await page.getByRole('button', { name: 'Einladung senden' }).click();
    await expect(page.getByText('Die Einladung ist unterwegs.')).toBeVisible();
    await expect(page.getByTestId('invitation').filter({ hasText: address })).toBeVisible();

    const context = await browser.newContext();
    const platform = await context.newPage();
    await login(platform, { role: 'platform', name: 'Plattform Admin', email: `platform.${id}@example.test` });
    const row = platform.getByTestId('mailbox').filter({ hasText: address });
    await expect(row).toContainText('Postfach: Zugang offen');
    await expectNoA11yViolations(platform, 'platform-mailboxes');
    // What the Manager does with «Gerät hinzufügen», in the local Infomaniak fake (src/lib/infomaniak.ts)
    const fake = path.join(process.env.E2E_OUTBOX_DIR!, 'infomaniak.json');
    const state = JSON.parse(await readFile(fake, 'utf8'));
    state.devices = { ...state.devices, [`nora.${id}`]: ['device-password-e2e'] };
    await writeFile(fake, JSON.stringify(state));
    await row.getByLabel('Gerätepasswort').fill('device-password-e2e');
    await row.getByRole('button', { name: 'Zugang übergeben' }).click();
    await expect(platform.getByText(/bereit zur Abholung/)).toBeVisible();
    await context.close();
  });
});
