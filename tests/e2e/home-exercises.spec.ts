import { expect, test, type Page } from '@playwright/test';
import { createSignedPatient, login, unique } from './helpers';

/**
 * Iteration 3, task 4.1: prescribe home exercises, choose repetitions, check the time needed, send the exercise
 * sheet and find it in the record. Needs the placeholder media (npm run media:placeholders, then catalog:sync).
 */

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
const block = (page: Page) => page.locator('section[aria-labelledby="h_home"]');
const row = (page: Page, code: string) => block(page).locator(`li.rx[data-code="${code}"]`);

async function openConsultation(page: Page, emailConsent: boolean) {
  await login(page);
  await createSignedPatient(page, { first: 'Anna', last: `Heim${unique()}`, dob: '05.03.1980', emailConsent });
  const recordUrl = page.url().split('?')[0];
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await page.locator('#f_regionId').selectOption('6');
  await page.locator('#f_painStart').selectOption('60');
  await page.locator('#f_diagnosis').fill('Lumbalgie');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
  await page.locator('section.treat').first().getByRole('link', { name: 'Konsultation', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Konsultation Nr. 1' })).toBeVisible();
  return recordUrl;
}

test.describe('home exercises and exercise sheet', () => {
  test('prescribe, time needed, send by email, document in the record, new version printed', async ({ page }) => {
    const recordUrl = await openConsultation(page, true);
    await expect(block(page).getByText('Noch keine Übung verordnet.')).toBeVisible();

    // Verordnete Übung erscheint, "täglich 1x" vorgewählt
    await page.getByLabel('Übung 2A verordnet').check();
    await expect(row(page, '2A')).toBeVisible();
    const daily2A = group(page, 'Wiederholung 2A täglich');
    await expect(daily2A.getByRole('button', { name: '1x' })).toHaveAttribute('aria-pressed', 'true');
    // Zehn Optionen
    await expect(daily2A.getByRole('button')).toHaveText(['1x', '2x', '3x']);
    await expect(group(page, 'Wiederholung 2A wöchentlich').getByRole('button')).toHaveText([
      '1x',
      '2x',
      '3x',
      '4x',
      '5x',
      '6x',
      '7x',
    ]);
    await expect(row(page, '2A')).toContainText('4 min pro Ausführung');
    // Intensität 10 is never offered
    await expect(page.getByLabel('Intensität 2A').locator('option')).toHaveText([
      '–',
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    ]);

    // Zwei Übungen: 2A täglich 2x and 2D wöchentlich 5x → 76 min per week, about 11 per day
    await daily2A.getByRole('button', { name: '2x' }).click();
    await page.getByLabel('Übung 2D verordnet').check();
    await group(page, 'Wiederholung 2D wöchentlich').getByRole('button', { name: '5x' }).click();
    const total = page.getByTestId('home-total');
    await expect(total).toContainText('76 min');
    await expect(total).toContainText('11 min');
    await page.getByLabel('Intensität 2A').selectOption('7');
    await page.getByLabel('Schritte 2A').selectOption('3');

    // 2C: stretch not set, only the rolling counts
    await page.getByLabel('Übung 2C verordnet').check();
    await expect(row(page, '2C')).toContainText('Dehnung noch nicht festgelegt');
    await expect(block(page)).toContainText('Nur mit Rollmassage gerechnet: 2C');
    await row(page, '2C').getByRole('button', { name: 'Verordnung 2C entfernen' }).click();
    await expect(row(page, '2C')).toHaveCount(0);
    await expect(page.getByLabel('Übung 2C verordnet')).not.toBeChecked();

    // Weitere Übung aus dem Katalog: 4B appears and counts as prescribed
    await block(page).getByRole('button', { name: '+ Übung hinzufügen' }).click();
    await page.getByLabel('Übung aus dem Katalog').selectOption('4B');
    await block(page).getByRole('button', { name: 'Hinzufügen', exact: true }).click();
    await expect(row(page, '4B')).toContainText('6 min pro Ausführung');
    await expect(page.getByLabel('Übung 4B verordnet')).toBeChecked();
    await expect(total).toContainText('118 min');
    // The main image comes from the exercise media
    await expect
      .poll(() =>
        row(page, '2A')
          .locator('img')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);

    // Saving creates no exercise sheet; the Abschluss page offers it
    await page.getByRole('button', { name: 'Konsultation speichern' }).click();
    await expect(page.getByText('Konsultation Nr. 1 gespeichert.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
    await expect(page.getByText('3 Übungen zur Selbstausführung verordnet, Zeitbedarf 17 min pro Tag.')).toBeVisible();
    await expect(page.getByText('Für diese Konsultation wurde noch kein Übungsblatt erstellt.')).toBeVisible();
    await expect(page.getByLabel(/Per E-Mail senden/)).toBeChecked();

    // Senden
    await page.getByRole('button', { name: 'Übungsblatt senden' }).click();
    await expect(page.getByText(/Übungsblatt PT-\d{4}-\d{5} erstellt und an anna@example.ch gesendet\./)).toBeVisible();
    const versions = page.locator('[data-testid="handout"]');
    await expect(versions).toHaveCount(1);
    await expect(async () => {
      await page.reload();
      await expect(versions.first()).toContainText('Per E-Mail an anna@example.ch gesendet', { timeout: 1000 });
    }).toPass({ timeout: 20_000 });

    // Dokument in der Akte
    await page.goto(`${recordUrl}?tab=documents`);
    const docs = page.locator('[data-testid="handout"]');
    await expect(docs).toHaveCount(1);
    await expect(docs.first()).toContainText('Übungsblatt · Konsultation Nr. 1');
    await expect(docs.first()).toContainText('aktuell');
    const href = await docs.first().getByRole('link', { name: 'PDF öffnen' }).getAttribute('href');
    const pdf = await page.request.get(href!);
    expect(pdf.headers()['content-type']).toBe('application/pdf');

    // Change the prescription, then print a new version; the older one stays
    await page.goto(recordUrl);
    await page.locator('section.treat').first().locator('.conslist a').first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Konsultation Nr. 1' })).toBeVisible();
    await expect(group(page, 'Wiederholung 2A täglich').getByRole('button', { name: '2x' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await group(page, 'Wiederholung 2A täglich').getByRole('button', { name: '3x' }).click();
    await page.getByRole('button', { name: 'Konsultation speichern' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
    await page.getByLabel(/Drucken/).check();
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Drucken', exact: true }).click();
    await expect(page.getByText(/Übungsblatt PT-\d{4}-\d{5} erstellt, Ausdruck vermerkt\./)).toBeVisible();
    await (await popup).close();
    await page.goto(`${recordUrl}?tab=documents`);
    await expect(docs).toHaveCount(2);
    await expect(docs.first()).toContainText('Version 2');
    await expect(docs.first()).toContainText('aktuell');
    await expect(docs.first()).toContainText('Ausgedruckt');
    await expect(docs.nth(1)).toContainText('frühere Version');

    // History: prescription change and the two sheets
    await page.goto(`${recordUrl}?tab=history`);
    const change = page.locator('table.hist tr', { hasText: 'Selbstausführung 2A Wiederholung geändert' });
    await expect(change.locator('del')).toHaveText('täglich 2x');
    await expect(change.locator('ins')).toHaveText('täglich 3x');
    await expect(page.locator('table.hist')).toContainText('Konsultation Nr. 1: Übungsblatt ausgedruckt');
  });

  test('without consent to unencrypted email only printing is offered', async ({ page }) => {
    await openConsultation(page, false);
    await page.getByLabel('Übung 2D verordnet').check();
    await page.getByRole('button', { name: 'Konsultation speichern' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
    await expect(page.getByLabel(/Per E-Mail senden/)).toBeDisabled();
    await expect(page.getByText('Keine Einwilligung in unverschlüsselte E-Mail: nur Ausdruck möglich.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Übungsblatt senden' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Drucken', exact: true })).toBeVisible();
  });

  test('a consultation without home exercises goes back to the record', async ({ page }) => {
    await openConsultation(page, false);
    await page.getByRole('button', { name: 'Konsultation speichern' }).click();
    await expect(page.getByText('Konsultation Nr. 1 gespeichert.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toHaveCount(0);
  });
});

test.describe('catalog exercise', () => {
  test('shows main image, sections, time needed and the whole sheet, only signed in', async ({ page, browser }) => {
    await login(page);
    await page.goto('/catalog?tab=exercises');
    await page.getByRole('link', { name: '2A', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: '2A Wirbelsäulen-Übung' })).toBeVisible();
    await expect(page.getByText('Sammelmappe Seite 7')).toBeVisible();
    for (const h of ['Faszien-Rollmassage', 'Engpassdehnung', 'Varianten', 'Zeitbedarf', 'Ganzes Blatt'])
      await expect(page.getByRole('heading', { name: h })).toBeVisible();
    await expect(page.locator('main')).toContainText('Platzhalter 2A');
    await expect(page.locator('dl.kv')).toContainText('2 min pro Seite');
    await expect(page.locator('dl.kv')).toContainText('4 min');
    for (const alt of ['Hauptbild 2A', 'Übungsblatt 2A'])
      await expect
        .poll(() => page.getByAltText(alt).evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);

    await page.goto('/catalog/exercises/1C');
    await expect(page.locator('dl.kv')).toContainText('noch nicht festgelegt');
    await expect(page.locator('dl.kv')).toContainText('Dehnung noch nicht festgelegt');

    // Bild ohne Anmeldung
    const anonymous = await browser.newContext();
    const res = await anonymous.request.get('/api/exercise-media/2A/main', { maxRedirects: 0 });
    expect(res.status()).not.toBe(200);
    expect(res.headers()['content-type'] ?? '').not.toContain('image/');
    await anonymous.close();
  });
});

test.describe('exercise preview and audio (iteration 7)', () => {
  test('Engpassdehnungen: the image opens in a popup, the audio plays and stops', async ({ page }) => {
    await openConsultation(page, false);
    const table = page.locator('section[aria-labelledby="h_ex"]');
    await expect(table.getByRole('columnheader', { name: 'Bild · Audio' })).toBeVisible();

    // Bild gross öffnen
    await table.getByRole('button', { name: 'Bild von Übung 2A gross öffnen' }).click();
    const popup = page.getByRole('dialog', { name: /^2A / });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('img', { name: 'Hauptbild 2A' })).toBeVisible();
    await popup.getByRole('button', { name: 'Schliessen' }).click();
    await expect(popup).toBeHidden();

    // Audio anhören und stoppen (placeholder: three seconds of silence)
    const play = table.getByRole('button', { name: 'Übung 2A vorlesen' });
    await play.click();
    const stop = table.getByRole('button', { name: 'Vorlesen von Übung 2A stoppen' });
    await expect(stop).toHaveAttribute('aria-pressed', 'true');
    await stop.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    // Audio not uploaded yet
    await page.route('**/api/exercise-media/2D/audio', (r) => r.fulfill({ status: 404, body: 'Not found' }));
    await table.getByRole('button', { name: 'Übung 2D vorlesen' }).click();
    await expect(table.getByText('Audio nicht verfügbar')).toBeVisible();
  });

  test('catalog: preview and audio for every exercise', async ({ page }) => {
    await login(page);
    await page.goto('/catalog?tab=exercises');
    await expect(page.getByRole('button', { name: 'Bild von Übung 1A gross öffnen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Übung 4G vorlesen' })).toBeVisible();
    const res = await page.request.get('/api/exercise-media/1A/audio', { headers: { range: 'bytes=0-1' } });
    expect(res.status()).toBe(206);
    expect(res.headers()['content-type']).toBe('audio/mpeg');
  });
});
