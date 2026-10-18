import { expect, test, type Page } from '@playwright/test';
import { createSignedPatient, expectCentered, login, pdfSrcOf, unique, viewPdfAndBack } from './helpers';

/**
 * Iteration 3, task 4.1 (iteration 8, task 5.3): prescribe home exercises, choose times per day and weekdays, check
 * the time needed, send the exercise sheet and find it in the record. Needs the placeholder media (npm run media:placeholders, then catalog:sync).
 */

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });
const block = (page: Page) => page.locator('section[aria-labelledby="h_home"]');
const row = (page: Page, code: string) => block(page).locator(`li.rx[data-code="${code}"]`);

async function openSession(page: Page, emailConsent: boolean) {
  await login(page);
  await createSignedPatient(page, { first: 'Anna', last: `Heim${unique()}`, dob: '05.03.1980', emailConsent });
  const recordUrl = page.url().split('?')[0];
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await page.locator('#f_regionId').selectOption('6');
  await page.locator('#f_painStart').selectOption('60');
  await page.locator('#f_diagnosis').fill('Lumbalgie');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
  await page.locator('section.treat').first().getByRole('link', { name: 'Sitzung', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Sitzung Nr. 1' })).toBeVisible();
  return recordUrl;
}

test.describe('home exercises and exercise sheet', () => {
  test('prescribe, time needed, send by email, document in the record, new version printed', async ({ page }) => {
    const recordUrl = await openSession(page, true);
    await expect(block(page).getByText('Noch keine Übung verordnet.')).toBeVisible();

    // Verordnete Übung erscheint mit FRM + EPD, "1× pro Tag" an allen Wochentagen vorgewählt (iteration 8)
    await page.getByLabel('Übung 2A verordnet').check();
    await expect(row(page, '2A')).toBeVisible();
    await expect(row(page, '2A')).toContainText('FRM + EPD Standard');
    const perDay2A = group(page, 'Übung 2A: pro Tag');
    await expect(perDay2A.getByRole('button')).toHaveText(['1×', '2×', '3×']);
    await expect(perDay2A.getByRole('button', { name: '1×' })).toHaveAttribute('aria-pressed', 'true');
    const days2A = group(page, 'Übung 2A: Wochentage');
    await expect(days2A.getByRole('button')).toHaveText(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    await expect(days2A.locator('button[aria-pressed="true"]')).toHaveCount(7);
    await expect(row(page, '2A')).toContainText('4 min pro Ausführung');
    await expect(page.getByLabel('Intensität 2A')).toHaveCount(0);

    // Zwei Übungen: 2A 2× pro Tag and 2D 1× Mo–Fr → 76 min per week, about 11 per day
    await perDay2A.getByRole('button', { name: '2×' }).click();
    await page.getByLabel('Übung 2D verordnet').check();
    const days2D = group(page, 'Übung 2D: Wochentage');
    await days2D.getByRole('button', { name: 'Samstag' }).click();
    await days2D.getByRole('button', { name: 'Sonntag' }).click();
    const total = page.getByTestId('home-total');
    await expect(total).toContainText('76 min');
    await expect(total).toContainText('11 min');
    // At least one weekday
    for (const d of ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'])
      await days2D.getByRole('button', { name: d }).click();
    await expect(row(page, '2D')).toContainText('Mindestens einen Wochentag wählen.');
    await days2D.getByRole('button', { name: 'Montag' }).click();
    for (const d of ['Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag'])
      await days2D.getByRole('button', { name: d }).click();
    await expect(total).toContainText('76 min');

    // 2C: stretch not set, only the rolling counts
    await page.getByLabel('Übung 2C verordnet').check();
    await expect(row(page, '2C')).toContainText('Dehnung noch nicht festgelegt');
    await expect(block(page)).toContainText('Nur mit Rollmassage gerechnet: 2C');
    await row(page, '2C').getByRole('button', { name: 'Verordnung 2C entfernen' }).click();
    await expect(row(page, '2C')).toHaveCount(0);
    await expect(page.getByLabel('Übung 2C verordnet')).not.toBeChecked();

    // Übung aus anderem Bereich: 4B appears and counts as prescribed
    await page.getByLabel('Übung aus anderem Bereich hinzufügen').selectOption('4B');
    await page
      .locator('section[aria-labelledby="h_ex"]')
      .getByRole('button', { name: 'Hinzufügen', exact: true })
      .click();
    await expect(row(page, '4B')).toContainText('6 min pro Ausführung');
    await expect(page.getByLabel('Übung 4B verordnet')).toBeChecked();
    await expect(total).toContainText('118 min');
    // The main image comes from the exercise media
    await expect
      .poll(() =>
        row(page, '2A')
          .locator('img.rximg')
          .evaluate((img: HTMLImageElement) => img.naturalWidth),
      )
      .toBeGreaterThan(0);
    for (const code of ['2A', '2D', '4B'])
      await group(page, `Übung ${code}: Übung fällt`).getByRole('button', { name: 'mittel' }).click();

    // Saving creates no exercise sheet; the Abschluss page offers it
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByText('Sitzung Nr. 1 gespeichert.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
    await expect(page.getByText('3 Übungen zur Selbstausführung verordnet, Zeitbedarf 17 min pro Tag.')).toBeVisible();
    await expect(page.getByText('Für diese Sitzung wurde noch kein Übungsblatt erstellt.')).toBeVisible();
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
    await expect(docs.first()).toContainText('Übungsblatt · Sitzung Nr. 1');
    await expect(docs.first()).toContainText('aktuell');
    const href = await docs.first().getByRole('link', { name: 'PDF öffnen' }).getAttribute('href');
    const pdf = await page.request.get(pdfSrcOf(href!, page.url()));
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    // In-app full-screen view with «Zurück», no new tab (iteration 9)
    await viewPdfAndBack(page, docs.first().getByRole('link', { name: 'PDF öffnen' }));

    // Change the prescription, then print a new version; the older one stays
    await page.goto(recordUrl);
    await page.locator('section.treat').first().locator('.conslist a').first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sitzung Nr. 1' })).toBeVisible();
    await expect(group(page, 'Übung 2A: pro Tag').getByRole('button', { name: '2×' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await group(page, 'Übung 2A: pro Tag').getByRole('button', { name: '3×' }).click();
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
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
    const change = page.locator('table.hist tr', { hasText: 'Selbstausführung 2A pro Tag geändert' });
    await expect(change.locator('del')).toHaveText('2× pro Tag');
    await expect(change.locator('ins')).toHaveText('3× pro Tag');
    await expect(page.locator('table.hist')).toContainText('Sitzung Nr. 1: Übungsblatt ausgedruckt');
  });

  test('without consent to unencrypted email only printing is offered', async ({ page }) => {
    await openSession(page, false);
    await page.getByLabel('Übung 2D verordnet').check();
    await group(page, 'Übung 2D: Übung fällt').getByRole('button', { name: 'leicht' }).click();
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
    await expect(page.getByLabel(/Per E-Mail senden/)).toBeDisabled();
    await expect(page.getByText('Keine Einwilligung in unverschlüsselte E-Mail: nur Ausdruck möglich.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Übungsblatt senden' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Drucken', exact: true })).toBeVisible();
    // «Abbrechen» next to «Sitzung ändern» goes back to the record without a sheet (iteration 9)
    await page.getByRole('link', { name: 'Abbrechen' }).click();
    await expect(page).toHaveURL(/\/patients\/[^/?]+(\?|$)/);
    await expect(page.locator('section.treat').first()).toContainText('Sitzung Nr. 1');
  });

  // Also iteration 7 (Engpassdehnungen: preview and audio), in this test because the zone allows only 20
  // confirmations per hour and IP address over the whole run
  test('a session without home exercises goes back to the record', async ({ page }) => {
    await openSession(page, false);
    const table = page.locator('section[aria-labelledby="h_ex"]');
    await expect(table.getByRole('columnheader', { name: 'Bild', exact: true })).toBeVisible();
    // «Anhören» only in the Selbstausführung (iteration 9)
    await expect(table.getByRole('button', { name: /vorlesen/ })).toHaveCount(0);

    // Bild gross öffnen, centered with a backdrop (iteration 9)
    await table.getByRole('button', { name: 'Bild von Übung 2A gross öffnen' }).click();
    const popup = page.getByRole('dialog', { name: /^2A / });
    await expect(popup).toBeVisible();
    await expect(popup.getByRole('img', { name: 'Hauptbild 2A' })).toBeVisible();
    await expectCentered(page, popup);
    await popup.getByRole('button', { name: 'Schliessen' }).click();
    await expect(popup).toBeHidden();

    // Prescribed: the Selbstausführung offers the tailored sheet and «Anhören» (FRM, then the EPD)
    await page.getByLabel('Übung 2A verordnet').check();
    await group(page, 'Übung 2A: Übung fällt').getByRole('button', { name: 'leicht' }).click();
    const home = page.locator('section[aria-labelledby="h_home"]');
    await home.getByRole('button', { name: /^2A / }).click();
    const sheet = page.getByTestId('tailored-2A');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('heading', { name: /^Faszien-Rollmassage/ })).toBeVisible();
    await expect(sheet.getByRole('heading', { name: /^Engpassdehnung · Standard/ })).toBeVisible();
    await expect(sheet.getByRole('img', { name: /2A FRM: Bildband/ })).toBeVisible();
    await expect(sheet.getByText(/^Variante \d:/)).toHaveCount(0);
    await expectCentered(page, sheet);
    await sheet.getByRole('button', { name: 'Schliessen' }).click();
    await expect(sheet).toBeHidden();

    // Audio anhören und stoppen (placeholder: three seconds of silence)
    const play = home.getByRole('button', { name: 'Übung 2A Standard vorlesen' });
    await play.click();
    const stop = home.getByRole('button', { name: 'Vorlesen von Übung 2A Standard stoppen' });
    await expect(stop).toHaveAttribute('aria-pressed', 'true');
    await stop.click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    // Audio not uploaded yet
    await page.route('**/api/exercise-media/2A/frm-audio', (r) => r.fulfill({ status: 404, body: 'Not found' }));
    await play.click();
    await expect(home.getByText('Audio nicht verfügbar')).toBeVisible();

    // Without a prescription the session goes back to the record
    await home.getByRole('button', { name: 'Verordnung 2A entfernen' }).click();
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByText('Sitzung Nr. 1 gespeichert.')).toBeVisible();
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
    for (const h of ['Faszien-Rollmassage', 'Standardübung', 'Varianten', 'Zeitbedarf', 'Ganzes Blatt'])
      await expect(page.getByRole('heading', { name: h, exact: true })).toBeVisible();
    await expect(page.locator('main')).toContainText('Platzhalter 2A');
    await expect(page.locator('main')).toContainText('Bereich 2 Rumpf');
    // Image bands and one recording per part (iteration 8, exercise-segments)
    for (const part of ['Faszien-Rollmassage', 'Standardübung'])
      await expect
        .poll(() => page.getByAltText(`2A ${part}: Bildband`).evaluate((img: HTMLImageElement) => img.naturalWidth))
        .toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: 'Übung 2A Faszien-Rollmassage vorlesen' })).toBeVisible();
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
