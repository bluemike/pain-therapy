import { expect, test, type Page } from '@playwright/test';
import { createSignedPatient, fillPatient, login, unique } from './helpers';
import { TINY_JPEG, withExif } from '../fixtures/jpeg';

const photoFile = (name: string) => ({ name, mimeType: 'image/jpeg', buffer: withExif(TINY_JPEG) });

const group = (page: Page, name: string) => page.getByRole('group', { name, exact: true });

/** Task 5.1 (iteration 8, task 5.3): treatment LWS/Bauch on the right side with photo, session with points, exercise
 * with variant, Selbstausführung by weekday and residual pain, second session, change in the history. */
test.describe('treatments and sessions', () => {
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
    await page.locator('#f_side').selectOption('RIGHT');
    await page.locator('#f_photos').setInputFiles([photoFile('a.jpg'), photoFile('b.jpg')]);
    await expect(page.locator('.ph.new')).toHaveCount(2);
    await expect(page.locator('.ph.new').first()).toContainText('13.10.2026 09:15');
    await page.getByRole('button', { name: 'Foto vom 13.10.2026 09:15 verwerfen' }).first().click();
    await expect(page.locator('.ph.new')).toHaveCount(1);
    await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();

    await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
    const card = page.locator('section.treat').first();
    await expect(card.getByRole('heading', { name: '2.3 · Lendenwirbelsäule, Bauch' })).toBeVisible();
    await expect(card).toContainText('Schmerzgrad zu Beginn 60 %');
    await expect(card).toContainText('1 Foto');
    await expect(card).toContainText('Körperseite rechts');
    await expect(card).toContainText(
      'Schmerzlokalisation und Schmerzzustand: Lumbalgie rechts, ausstrahlend in die Leiste',
    );
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

    // Sitzung Nr. 1 on the form of area 2.3; the treatment is on the right side
    await card.getByRole('link', { name: 'Sitzung', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sitzung Nr. 1' })).toBeVisible();
    await expect(page.getByText('Behandlungsbogen 2.3 · Lendenwirbelsäule, Bauch')).toBeVisible();
    await expect(page.locator('#f_diagnosis')).toHaveValue('Lumbalgie rechts, ausstrahlend in die Leiste');
    // Order of the form: head, pain before, Osteopressur, exercises, Selbstausführung, pain after, photos
    await expect(page.locator('main h2[id^="h_"]')).toHaveText([
      'Schmerz vorher',
      'Osteopressur',
      'Übungen',
      'Selbstausführung',
      'Schmerz nachher',
      'Fotos',
    ]);
    const rows = page.locator('section[aria-labelledby="h_osteo"] tbody tr');
    await expect(rows).toHaveCount(15);
    // Session 1 shows the main points (dark red) first; "Alle" shows every point of the sheet
    const filter = page.getByTestId('point-filter');
    await expect(filter).toHaveValue('main');
    const mainCount = await rows.locator('visible=true').count();
    expect(mainCount).toBeGreaterThan(0);
    expect(mainCount).toBeLessThan(15);
    await filter.selectOption('all');
    await expect(rows.locator('visible=true')).toHaveCount(15);
    await expect(rows.first().locator('th')).toHaveText('2.1.1');
    await expect(rows.last().locator('th')).toHaveText('4.5');
    // Exercises of the sheet first, then the rest of the Bereich Rumpf
    await expect(page.locator('section[aria-labelledby="h_ex"] tbody th')).toHaveText([
      /^1F/,
      /^2A/,
      /^2B/,
      /^2C/,
      /^2D/,
      /^2E/,
      /^2F/,
    ]);

    // Schmerz: two rows, tap again to clear
    const before = group(page, 'Schmerz vorher, %');
    const after = group(page, 'Schmerz nachher, %');
    await before.getByRole('button', { name: '60' }).click();
    await after.getByRole('button', { name: '40' }).click();
    await after.getByRole('button', { name: '40' }).click();
    await expect(after.getByRole('button', { name: '40' })).toHaveAttribute('aria-pressed', 'false');
    await after.getByRole('button', { name: '30' }).click();

    // Only the side of the treatment is offered (iteration 9); a sensitivity ticks it; second tap clears, third sets again
    await expect(page.getByLabel('Punkt 2.11.1 links behandelt')).toHaveCount(0);
    const sens = group(page, 'Empfindlichkeit Punkt 2.11.1');
    await sens.getByRole('button', { name: 'stark' }).click();
    await expect(page.getByLabel('Punkt 2.11.1 rechts behandelt')).toBeChecked();
    await sens.getByRole('button', { name: 'stark' }).click();
    await expect(sens.getByRole('button', { name: 'stark' })).toHaveAttribute('aria-pressed', 'false');
    await sens.getByRole('button', { name: 'stark' }).press('Enter');
    await expect(sens.getByRole('button', { name: 'stark' })).toHaveAttribute('aria-pressed', 'true');

    // Point from another area
    await page.getByRole('button', { name: 'Punkt aus anderem Bereich' }).click();
    await page.getByLabel('Punkt aus den L&B Basisdaten').selectOption('1.1.1');
    await page.getByRole('button', { name: 'Hinzufügen', exact: true }).first().click();
    await expect(rows).toHaveCount(16);
    await page.getByLabel('Punkt 1.1.1 rechts behandelt').check();

    // Exercise 2D prescribed with variant 1; "Übung fällt" is required
    await page.getByLabel('Übung 2D verordnet').check();
    await page.getByLabel('Übung 2D: EPD').selectOption('1');
    // No comparison in session 1 (iteration 9)
    await expect(page.locator('#f_comparison')).toHaveCount(0);
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByText('Nicht gespeichert. Bitte prüfen Sie die markierten Felder.')).toBeVisible();
    await expect(page.locator('section[aria-labelledby="h_ex"] tr.bad')).toHaveCount(1);
    // A treated side needs a sensitivity (iteration 9): the point is marked and nothing is saved
    const p111 = page.locator('tr[data-point="1.1.1"]');
    await expect(p111).toHaveClass(/bad/);
    await expect(p111).toContainText('Bitte die Empfindlichkeit angeben.');
    await group(page, 'Empfindlichkeit Punkt 1.1.1').getByRole('button', { name: 'niedrig' }).click();
    await group(page, 'Übung 2D: Übung fällt').getByRole('button', { name: 'schwer' }).click();
    // Selbstausführung: 2× per day, without Saturday and Sunday
    await group(page, 'Übung 2D: pro Tag').getByRole('button', { name: '2×' }).click();
    const days = group(page, 'Übung 2D: Wochentage');
    await expect(days.getByRole('button', { name: 'Samstag' })).toHaveAttribute('aria-pressed', 'true');
    await days.getByRole('button', { name: 'Samstag' }).click();
    await days.getByRole('button', { name: 'Sonntag' }).click();
    await expect(page.getByTestId('week-2D')).toContainText('pro Woche');
    await page.locator('#f_photos').setInputFiles([photoFile('c.jpg')]);
    await expect(page.locator('.ph.new')).toHaveCount(1);
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();

    await expect(page.getByText('Sitzung Nr. 1 gespeichert.')).toBeVisible();
    // A prescribed exercise leads to the Abschluss with the exercise sheet (iteration 3); "Später" goes to the record
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
    await page.getByRole('link', { name: 'Später' }).click();
    const list = page.locator('section.treat').first().locator('.conslist li');
    await expect(list).toHaveCount(1);
    await expect(list.first()).toContainText('Nr. 1');
    await expect(list.first()).toContainText('60 % → 30 %');
    await expect(list.first()).toContainText('Sitzung Nr. 1');
    await expect(list.first()).toContainText('2 Punkte · 1 Übung · 1 Foto');
    await expect(list.first().getByRole('link', { name: 'Ändern: Sitzung Nr. 1' })).toBeVisible();

    // Second session with only the pain before; it starts with the relevant (red) points
    await page.locator('section.treat').first().getByRole('link', { name: 'Sitzung', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sitzung Nr. 2' })).toBeVisible();
    await expect(page.getByTestId('point-filter')).toHaveValue('relevant');
    await page.locator('#f_comparison').fill('Besser als in Sitzung 1');
    await group(page, 'Schmerz vorher, %').getByRole('button', { name: '50' }).click();
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByText('Sitzung Nr. 2 gespeichert.')).toBeVisible();
    await expect(list).toHaveCount(2);
    await expect(list.first()).toContainText('Nr. 2');
    await expect(list.first()).toContainText('50 % → –');

    // Change session 1: "stark" → "mittel", visible in the history with both values; recorded points stay visible
    await list.nth(1).getByRole('link').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Sitzung Nr. 1' })).toBeVisible();
    await expect(page.getByLabel('Punkt 1.1.1 rechts behandelt')).toBeChecked();
    await expect(page.getByLabel('Übung 2D: EPD')).toHaveValue('1');
    await expect(group(page, 'Übung 2D: Wochentage').getByRole('button', { name: 'Sonntag' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.locator('.ph:not(.new) img')).toHaveCount(1);
    await group(page, 'Empfindlichkeit Punkt 2.11.1').getByRole('button', { name: 'mittel' }).click();
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByText('Sitzung Nr. 1 gespeichert.')).toBeVisible();
    await page.goto(`${recordUrl}?tab=history`);
    const row = page.locator('table.hist tr', { hasText: 'Sitzung Nr. 1: Punkt 2.11.1 Empfindlichkeit geändert' });
    await expect(row.locator('del')).toHaveText('stark');
    await expect(row.locator('ins')).toHaveText('mittel');
    await expect(page.locator('table.hist')).toContainText('2.3 · Lendenwirbelsäule, Bauch · Behandlung eröffnet');

    // Behandlung ändern: diagnosis, remove the photo; no delete offered
    await page.goto(recordUrl);
    await page
      .locator('section.treat')
      .first()
      .getByRole('link', { name: /^Ändern: (?!Sitzung)/ })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Behandlung ändern' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Löschen/ })).toHaveCount(0);
    // With a session saved, area and side are fixed
    await expect(page.locator('#f_regionId')).toBeDisabled();
    await expect(page.locator('#f_regionId_h')).toContainText('Fest seit der ersten Sitzung');
    await expect(page.locator('#f_side')).toBeDisabled();
    await page.locator('#f_diagnosis').fill('Lumbalgie rechts');
    await page.getByRole('button', { name: /^Foto vom .* entfernen$/ }).click();
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(page.getByText('Änderungen an der Behandlung gespeichert.')).toBeVisible();
    await expect(page.locator('section.treat').first()).toContainText('keine Fotos');
    await page.goto(`${recordUrl}?tab=history`);
    const diag = page.locator('table.hist tr', {
      hasText: 'Behandlung: Schmerzlokalisation und Schmerzzustand geändert',
    });
    await expect(diag.locator('del')).toHaveText('Lumbalgie rechts, ausstrahlend in die Leiste');
    await expect(diag.locator('ins')).toHaveText('Lumbalgie rechts');
    await expect(page.locator('table.hist')).toContainText('Foto entfernt');
    expect((await page.request.get(photoUrl!)).status()).toBe(404);
  });

  test('without a signed disclaimer no treatment is opened; the invitation is offered', async ({ page }) => {
    await login(page);
    await page.goto('/patients/new');
    await fillPatient(page, { first: 'Ohne', last: `Unterschrift${unique()}`, dob: '01.01.1970' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/ist angelegt/)).toBeVisible();
    await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
    await expect(
      page.getByText(/Neue Behandlungen und Sitzungen sind erst nach der Unterschrift möglich/),
    ).toBeVisible();
    await expect(page.locator('#f_diagnosis')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Zur Unterschrift einladen' })).toBeVisible();
  });
});

test.describe('therapy catalog', () => {
  test('read-only view with areas, points per area, exercises and tools', async ({ page }) => {
    await login(page, { role: 'Admin' });
    await page.getByRole('link', { name: 'L&B Basisdaten' }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'L&B Basisdaten' })).toBeVisible();
    // 4 Bereiche with 3 Schmerzbereiche each
    await expect(page.locator('main tbody tr.grouprow')).toHaveText([
      /^1 Kopf/,
      /^2 Rumpf/,
      /^3 Schulter\/Arm/,
      /^4 Becken\/Beine/,
    ]);
    await expect(page.locator('main tbody tr:not(.grouprow)')).toHaveCount(12);
    await expect(page.getByRole('row', { name: /^2\.3 Lendenwirbelsäule, Bauch/ })).toBeVisible();

    await page.locator('nav.tabs').getByRole('link', { name: 'Osteopressurpunkte' }).click();
    await expect(page.locator('main tbody tr')).toHaveCount(72);
    await page.getByLabel('Schmerzbereich').selectOption('6');
    await page.getByRole('button', { name: 'Anzeigen' }).click();
    const rows = page.locator('main tbody tr');
    await expect(rows).toHaveCount(15);
    await expect(rows.first().locator('td').first()).toHaveText('2.1.1');
    await expect(page.locator('main tbody tr.e-main').first()).toBeVisible();

    await page.locator('nav.tabs').getByRole('link', { name: 'Übungen' }).click();
    await expect(page.locator('main tbody tr')).toHaveCount(27);
    const twoA = page.getByRole('row', { name: /^2A Wirbelsäulen-Übung/ });
    await expect(twoA).toContainText('2 Rumpf');
    await expect(twoA).toContainText('MiKu');
    await expect(page.getByRole('row', { name: /^1A Kiefer-Übung/ })).toContainText('4 Varianten');

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
