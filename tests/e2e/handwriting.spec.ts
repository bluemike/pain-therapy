import { expect, test, type Page } from '@playwright/test';
import { createSignedPatient, login, setPain, unique } from './helpers';

/** Writes a short wavy line on the handwriting pad of a remark field (iteration 10, note-input). */
async function write(page: Page, name: string) {
  const pad = page.getByTestId(`pad-${name}`);
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + box.height * 0.4);
  await page.mouse.down();
  for (let i = 0; i <= 25; i++)
    await page.mouse.move(box.x + 30 + i * 8, box.y + box.height * 0.4 + Math.sin(i / 2) * 12);
  await page.mouse.up();
}

const modes = (page: Page) => page.getByRole('group', { name: 'Eingabe für Schmerzlokalisation und Schmerzzustand' });

/** Iteration 10, task 5.2: handwriting as image, «In Text umwandeln», replacing text, default per user. */
test('remarks with handwriting as image or recognised text', async ({ page }) => {
  test.setTimeout(120_000);
  // An own user: the input mode is stored per user and must not change the other tests
  await login(page, { name: 'Ink Tester', email: `ink-${unique()}@example.ch` });
  await createSignedPatient(page, { first: 'Hanna', last: `Handschrift${unique()}`, dob: '12.04.1975' });
  const recordUrl = page.url().split('?')[0];

  // Neue Behandlung with the diagnosis written by hand; empty pad = missing diagnosis
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await page.locator('#f_regionId').selectOption('6');
  await setPain(page, 'f_painStart', 60);
  await modes(page).getByRole('button', { name: 'Handschrift als Bild' }).click();
  await expect(page.locator('#f_diagnosis')).toHaveCount(0);
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.locator('#f_diagnosis_m')).toHaveText('Bitte ausfüllen.');
  await write(page, 'diagnosis');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
  const card = page.locator('section.treat').first();
  const note = card.getByRole('img', { name: 'Handschriftliche Notiz' });
  await expect(note).toBeVisible();
  await expect.poll(() => note.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);

  // Ändern: the field opens as image; «In Text umwandeln» puts the recognised text up for review
  await card
    .getByRole('link', { name: /^Ändern: / })
    .first()
    .click();
  await expect(page.getByTestId('ink-diagnosis')).toBeVisible();
  await page.getByRole('button', { name: 'In Text umwandeln' }).click();
  await expect(page.locator('#f_diagnosis')).toHaveValue('Schulter re, Abduktion eingeschränkt');
  await expect(page.getByText('Erkannt – bitte prüfen')).toBeVisible();
  await page.locator('#f_diagnosis').fill('Schulter re, Abduktion eingeschränkt bis 90°');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect(page.getByText('Änderungen an der Behandlung gespeichert.')).toBeVisible();
  await expect(card).toContainText(
    'Schmerzlokalisation und Schmerzzustand: Schulter re, Abduktion eingeschränkt bis 90°',
  );
  await expect(card.getByRole('img', { name: 'Handschriftliche Notiz' })).toHaveCount(0);

  // Text durch Handschrift ersetzen: asked before saving
  await card
    .getByRole('link', { name: /^Ändern: / })
    .first()
    .click();
  await modes(page).getByRole('button', { name: 'Handschrift als Bild' }).click();
  await expect(page.getByText('Bisheriger Text, bleibt bis Sie schreiben:')).toBeVisible();
  await write(page, 'diagnosis');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  const confirm = page.getByRole('dialog', { name: 'Text durch Handschrift ersetzen?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Ersetzen' }).click();
  await expect(page.getByText('Änderungen an der Behandlung gespeichert.')).toBeVisible();
  await expect(card.getByRole('img', { name: 'Handschriftliche Notiz' })).toBeVisible();
  await page.goto(`${recordUrl}?tab=history`);
  await expect(page.locator('main')).toContainText('[Handschrift]');

  // Handschrift → Text on a new session: «Erkennen» fills the field, the pad is emptied
  await page.goto(recordUrl);
  await page.locator('section.treat').first().getByRole('link', { name: 'Sitzung', exact: true }).click();
  await modes(page).getByRole('button', { name: 'Handschrift → Text' }).click();
  await write(page, 'diagnosis');
  await page.getByRole('button', { name: 'Erkennen', exact: true }).click();
  await expect(page.locator('#f_diagnosis')).toHaveValue('Schulter re, Abduktion eingeschränkt');

  // The last choice is the default of the user, shown under «Mein Profil»
  await page.goto('/profile');
  await expect(page.locator('#f_noteInputMode')).toHaveValue('HANDWRITING_TEXT');
});
