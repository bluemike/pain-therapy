import { expect, test, type Page } from '@playwright/test';
import { createSignedPatient, fillPatient, login, unique } from './helpers';
import { TINY_JPEG, withExif } from '../fixtures/jpeg';

const photoFile = (name: string) => ({ name, mimeType: 'image/jpeg', buffer: withExif(TINY_JPEG) });

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });

/** Task 5.1: treatment LWS/Bauch with photo, consultation with points, exercise, rolling and residual pain,
 * second consultation, change in the history. */
test.describe('treatments and consultations', () => {
  test('full flow on the paper form of area 6', async ({ page, browser }) => {
    const last = `Behandlung${unique()}`;
    await login(page);
    await createSignedPatient(page, { first: 'Anna', last, dob: '05.03.1980' });
    const recordUrl = page.url().split('?')[0];

    // Akte öffnen: "Behandlungen" first, empty state with "Neue Behandlung"
    await expect(page.locator('nav.tabs a[aria-current="page"]')).toHaveText(/^Behandlungen/);
    await expect(page.getByRole('heading', { name: 'Noch keine Behandlung' })).toBeVisible();

    // Neue Behandlung: required area
    await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Neue Behandlung' })).toBeVisible();
    await expect(page.locator('#f_startedAt')).not.toHaveValue('');
    await expect(page.locator('#f_painStart')).toHaveValue('');
    await page.locator('#f_diagnosis').fill('Lumbalgie rechts, ausstrahlend in die Leiste');
    await page.locator('#f_painStart').selectOption('60');
    await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
    await expect(page.getByText('Nicht gespeichert. Bitte prüfen Sie die markierten Felder.')).toBeVisible();
    await expect(page.locator('#f_regionId_m')).toHaveText('Bitte ausfüllen.');

    // Photo with the camera field: preview with the time from EXIF, discard one before saving
    await page.locator('#f_regionId').selectOption('6');
    await page.locator('#f_photos').setInputFiles([photoFile('a.jpg'), photoFile('b.jpg')]);
    await expect(page.locator('.ph.new')).toHaveCount(2);
    await expect(page.locator('.ph.new').first()).toContainText('13.10.2026 09:15');
    await page.getByRole('button', { name: 'Foto vom 13.10.2026 09:15 verwerfen' }).first().click();
    await expect(page.locator('.ph.new')).toHaveCount(1);
    await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();

    await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
    const card = page.locator('section.treat').first();
    await expect(card.getByRole('heading', { name: '6 · Lendenwirbelsäule, Bauch' })).toBeVisible();
    await expect(card).toContainText('Schmerzgrad zu Beginn 60 %');
    await expect(card).toContainText('1 Foto');
    await expect(card).toContainText('Diagnose: Lumbalgie rechts, ausstrahlend in die Leiste');
    const thumb = card.locator('.photos img').first();
    await expect.poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
    const photoUrl = await card.locator('.photos a').first().getAttribute('href');
    expect(photoUrl).toMatch(/^\/api\/photos\/[0-9a-f-]+$/);

    // The photo is delivered only with a sign-in, never cached
    const full = await page.request.get(photoUrl!);
    expect(full.status()).toBe(200);
    expect(full.headers()['content-type']).toBe('image/jpeg');
    expect(full.headers()['cache-control']).toBe('private, no-store');
    expect((await full.body()).includes('Exif')).toBe(false);
    const anonymous = await browser.newContext();
    const res = await anonymous.request.get(photoUrl!, { maxRedirects: 0 });
    expect(res.status()).not.toBe(200);
    expect(res.headers()['content-type'] ?? '').not.toContain('image/jpeg');
    await anonymous.close();

    // Konsultation Nr. 1 on the form of area 6
    await card.getByRole('link', { name: 'Konsultation' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Konsultation Nr. 1' })).toBeVisible();
    await expect(page.getByText('Behandlungsbogen 6 · Lendenwirbelsäule, Bauch')).toBeVisible();
    await expect(page.locator('#f_diagnosis')).toHaveValue('Lumbalgie rechts, ausstrahlend in die Leiste');
    const rows = page.locator('section[aria-labelledby="h_osteo"] tbody tr');
    await expect(rows).toHaveCount(15);
    await expect(rows.first().locator('th')).toHaveText('2.1.1');
    await expect(rows.last().locator('th')).toHaveText('4.5');
    await page.getByLabel('nur Hauptpunkte').check();
    const mainCount = await rows.locator('visible=true').count();
    expect(mainCount).toBeGreaterThan(0);
    expect(mainCount).toBeLessThan(15);
    await page.getByLabel('nur Hauptpunkte').uncheck();
    await expect(page.locator('section[aria-labelledby="h_ex"] tbody th')).toHaveText([
      /^1F/,
      /^2A/,
      /^2B/,
      /^2C/,
      /^2D/,
    ]);

    // Schmerz: two rows, tap again to clear
    const before = group(page, 'Schmerz vor der Konsultation, %');
    const after = group(page, 'Schmerz nach der Konsultation (Restschmerz), %');
    await before.getByRole('button', { name: '60' }).click();
    await after.getByRole('button', { name: '40' }).click();
    await after.getByRole('button', { name: '40' }).click();
    await expect(after.getByRole('button', { name: '40' })).toHaveAttribute('aria-pressed', 'false');
    await after.getByRole('button', { name: '30' }).click();

    // Point 2.11.1 right, "stark"; second tap clears, third sets again
    await page.getByLabel('Punkt 2.11.1 rechts behandelt').check();
    const sens = group(page, 'Empfindlichkeit Punkt 2.11.1');
    await sens.getByRole('button', { name: 'stark' }).click();
    await sens.getByRole('button', { name: 'stark' }).click();
    await expect(sens.getByRole('button', { name: 'stark' })).toHaveAttribute('aria-pressed', 'false');
    await sens.getByRole('button', { name: 'stark' }).press('Enter');
    await expect(sens.getByRole('button', { name: 'stark' })).toHaveAttribute('aria-pressed', 'true');

    // Point from another area
    await page.getByRole('button', { name: 'Punkt aus anderem Bereich' }).click();
    await page.getByLabel('Punkt aus dem Katalog').selectOption('1.1.1');
    await page.getByRole('button', { name: 'Hinzufügen' }).click();
    await expect(rows).toHaveCount(16);
    await page.getByLabel('Punkt 1.1.1 links behandelt').check();

    // Exercise 2D prescribed, "schwer"; rolling row 1
    await page.getByLabel('Übung 2D verordnet').check();
    await group(page, 'Übung 2D: Übung fällt').getByRole('button', { name: 'schwer' }).click();
    await page.getByLabel('Bereich 1', { exact: true }).fill('Beckenkamm');
    await page.getByLabel('Kugel/Rolle 1', { exact: true }).selectOption('MiKu');
    await page.locator('#f_comparison').fill('Erste Konsultation');
    await page.locator('#f_photos').setInputFiles([photoFile('c.jpg')]);
    await expect(page.locator('.ph.new')).toHaveCount(1);
    await page.getByRole('button', { name: 'Konsultation speichern' }).click();

    await expect(page.getByText('Konsultation Nr. 1 gespeichert.')).toBeVisible();
    const list = page.locator('section.treat').first().locator('.conslist li');
    await expect(list).toHaveCount(1);
    await expect(list.first()).toContainText('Nr. 1');
    await expect(list.first()).toContainText('60 % → 30 %');
    await expect(list.first()).toContainText('2 Punkte · 1 Übung · 1 Rollmassage · 1 Foto');

    // Second consultation with only the pain before
    await page.locator('section.treat').first().getByRole('link', { name: 'Konsultation' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Konsultation Nr. 2' })).toBeVisible();
    await group(page, 'Schmerz vor der Konsultation, %').getByRole('button', { name: '50' }).click();
    await page.getByRole('button', { name: 'Konsultation speichern' }).click();
    await expect(page.getByText('Konsultation Nr. 2 gespeichert.')).toBeVisible();
    await expect(list).toHaveCount(2);
    await expect(list.first()).toContainText('Nr. 2');
    await expect(list.first()).toContainText('50 % → –');

    // Change consultation 1: "stark" → "mittel", visible in the history with both values
    await list.nth(1).getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Konsultation Nr. 1' })).toBeVisible();
    await expect(page.getByLabel('Punkt 1.1.1 links behandelt')).toBeChecked();
    await expect(page.locator('.ph:not(.new) img')).toHaveCount(1);
    await group(page, 'Empfindlichkeit Punkt 2.11.1').getByRole('button', { name: 'mittel' }).click();
    await page.getByRole('button', { name: 'Konsultation speichern' }).click();
    await expect(page.getByText('Konsultation Nr. 1 gespeichert.')).toBeVisible();
    await page.goto(`${recordUrl}?tab=history`);
    const row = page.locator('table.hist tr', { hasText: 'Konsultation Nr. 1: Punkt 2.11.1 Empfindlichkeit geändert' });
    await expect(row.locator('del')).toHaveText('stark');
    await expect(row.locator('ins')).toHaveText('mittel');
    await expect(page.locator('table.hist')).toContainText('6 · Lendenwirbelsäule, Bauch · Behandlung eröffnet');

    // Behandlung ändern: diagnosis, remove the photo; no delete offered
    await page.goto(recordUrl);
    await page
      .locator('section.treat')
      .first()
      .getByRole('link', { name: /^Ändern/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Behandlung ändern' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Löschen/ })).toHaveCount(0);
    await page.locator('#f_diagnosis').fill('Lumbalgie rechts');
    await page.getByRole('button', { name: /^Foto vom .* entfernen$/ }).click();
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(page.getByText('Änderungen an der Behandlung gespeichert.')).toBeVisible();
    await expect(page.locator('section.treat').first()).toContainText('keine Fotos');
    await page.goto(`${recordUrl}?tab=history`);
    const diag = page.locator('table.hist tr', { hasText: 'Behandlung: Diagnose geändert' });
    await expect(diag.locator('del')).toHaveText('Lumbalgie rechts, ausstrahlend in die Leiste');
    await expect(diag.locator('ins')).toHaveText('Lumbalgie rechts');
    await expect(page.locator('table.hist')).toContainText('Foto entfernt');
    expect((await page.request.get(photoUrl!)).status()).toBe(404);
  });

  test('without a signed disclaimer no treatment is opened; hand over is offered', async ({ page }) => {
    await login(page);
    await page.goto('/patients/new');
    await fillPatient(page, { first: 'Ohne', last: `Unterschrift${unique()}`, dob: '01.01.1970' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/ist angelegt/)).toBeVisible();
    await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
    await expect(
      page.getByText(/Neue Behandlungen und Konsultationen sind erst nach der Unterschrift möglich/),
    ).toBeVisible();
    await expect(page.locator('#f_diagnosis')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'An Patient:in übergeben' })).toBeVisible();
  });
});

test.describe('therapy catalog', () => {
  test('read-only view with areas, points per area, exercises and tools', async ({ page }) => {
    await login(page, { role: 'Admin' });
    await page.getByRole('link', { name: 'Katalog' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Therapiekatalog' })).toBeVisible();
    await expect(page.locator('main tbody tr')).toHaveCount(12);

    await page.locator('nav.tabs').getByRole('link', { name: 'Osteopressur-Punkte' }).click();
    await expect(page.locator('main tbody tr')).toHaveCount(72);
    await page.getByLabel('Bereich').selectOption('6');
    await page.getByRole('button', { name: 'Anzeigen' }).click();
    const rows = page.locator('main tbody tr');
    await expect(rows).toHaveCount(15);
    await expect(rows.first().locator('td').first()).toHaveText('2.1.1');
    await expect(page.locator('main tbody tr.e-main').first()).toBeVisible();

    await page.locator('nav.tabs').getByRole('link', { name: 'Engpassdehnungen' }).click();
    await expect(page.locator('main tbody tr')).toHaveCount(27);
    await expect(page.locator('main tbody tr', { hasText: '1A' }).getByText('noch nicht erfasst')).toHaveCount(2);
    await expect(page.getByRole('row', { name: /^2A Wirbelsäulen-Übung/ })).toContainText('MiKu');

    await page.locator('nav.tabs').getByRole('link', { name: 'Rollmassage-Werkzeuge' }).click();
    await expect(page.locator('main tbody tr')).toHaveCount(4);

    // Keine Bearbeitung: nothing that changes, adds or removes entries
    for (const tab of ['', '?tab=points', '?tab=exercises', '?tab=tools']) {
      await page.goto(`/catalog${tab}`);
      await expect(
        page.locator('main form[method="post"], main input:not([type="hidden"]), main textarea'),
      ).toHaveCount(0);
      await expect(
        page.locator('main').getByRole('button', { name: /bearbeiten|ändern|hinzufügen|entfernen|löschen|speichern/i }),
      ).toHaveCount(0);
      await expect(
        page.locator('main').getByRole('link', { name: /bearbeiten|ändern|hinzufügen|entfernen|löschen/i }),
      ).toHaveCount(0);
    }
  });
});
