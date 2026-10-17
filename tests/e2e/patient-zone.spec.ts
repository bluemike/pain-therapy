import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { createSignedPatient, expectNoA11yViolations, login, unique } from './helpers';

/**
 * Iteration 4, tasks 8.3 and 8.4: send the exercise sheet with the link (mail to the outbox instead of Graph), open
 * the link on a phone (390 px), confirm with the date of birth, record and correct entries, check the adherence in
 * the tile and the tab, revoke the link. Needs the patient zone on ZONE_URL (playwright.config.ts starts both apps).
 */

const ZONE = process.env.ZONE_URL ?? 'http://localhost:3100';
const OUTBOX = path.resolve(process.env.E2E_OUTBOX_DIR ?? 'data/e2e-outbox');

/** The link from the newest email to `to` in the outbox */
async function linkFromOutbox(to: string) {
  let url = '';
  await expect(async () => {
    const files = (await readdir(OUTBOX)).filter((f) => f.endsWith('.json')).sort();
    for (const f of files.reverse()) {
      const mail = JSON.parse(await readFile(path.join(OUTBOX, f), 'utf8')) as { to: string; text: string };
      const m = mail.to === to ? /https?:\/\/\S+\/l\/[A-Za-z0-9_-]{43}/.exec(mail.text) : null;
      if (m) {
        url = m[0];
        return;
      }
    }
    throw new Error(`No email with a link to ${to} yet`);
  }).toPass({ timeout: 20_000 });
  return url;
}

async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  });
  return context.newPage();
}

async function expectNoHorizontalScroll(page: Page, name: string) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `${name} scrolls sideways at 390 px`).toBeLessThanOrEqual(client);
}

const entryForm = (page: Page, code: string) => page.getByRole('form', { name: `Eintrag ${code}`, exact: true });

test.describe('patient zone', () => {
  test('exercise sheet with link, confirmation, entries, adherence in the practice, revoke', async ({
    page,
    browser,
  }) => {
    test.setTimeout(180_000);
    const id = unique();
    const email = `anna.${id}@example.ch`;
    const last = `Zone${id}`;

    // Practice: session with 2A 2× per day and 2D on every day but today, exercise sheet by email with the link
    await login(page);
    await createSignedPatient(page, { first: 'Anna', last, dob: '05.03.1980', emailConsent: true, email });
    const recordUrl = page.url().split('?')[0];
    await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
    await page.locator('#f_regionId').selectOption('6');
    await page.locator('#f_painStart').selectOption('60');
    await page.locator('#f_diagnosis').fill('Lumbalgie');
    await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
    await page.locator('section.treat').first().getByRole('link', { name: 'Sitzung', exact: true }).click();
    const group = (name: string) => page.getByRole('group', { name, exact: true });
    await page.getByLabel('Übung 2A verordnet').check();
    await group('Übung 2A: Übung fällt').getByRole('button', { name: 'mittel' }).click();
    await group('Übung 2A: pro Tag').getByRole('button', { name: '2×' }).click();
    await page.getByLabel('Übung 2D verordnet').check();
    await page.getByLabel('Übung 2D: EPD').selectOption('1');
    await group('Übung 2D: Übung fällt').getByRole('button', { name: 'leicht' }).click();
    const today = new Intl.DateTimeFormat('de-CH', { weekday: 'long', timeZone: 'Europe/Zurich' }).format(new Date());
    await group('Übung 2D: Wochentage').getByRole('button', { name: today }).click();
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible();
    await expect(page.getByLabel(/Link zur Patienten-Zone mitsenden/)).toBeChecked();
    await page.getByRole('button', { name: 'Übungsblatt senden' }).click();
    await expect(page.getByText('Der Link zur Patienten-Zone steht im Text der E-Mail.')).toBeVisible();
    const link = await linkFromOutbox(email);
    expect(link.startsWith(`${ZONE}/l/`)).toBe(true);

    // Patient on the phone: confirmation with the date of birth
    const patient = await phone(browser);
    await patient.goto(link);
    await expect(patient.getByRole('heading', { level: 1, name: 'Willkommen' })).toBeVisible();
    await expect(patient.locator('body')).not.toContainText(last);
    await expectNoHorizontalScroll(patient, 'confirmation');
    await expectNoA11yViolations(patient, 'confirmation');
    await patient.getByLabel('Tag (TT)').fill('06');
    await patient.getByLabel('Monat (MM)').fill('03');
    await patient.getByLabel('Jahr (JJJJ)').fill('1980');
    await patient.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(patient.getByText('Die Angabe stimmt nicht.')).toBeVisible();
    await patient.getByLabel('Tag (TT)').fill('05');
    await patient.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(patient.getByRole('heading', { level: 1, name: 'Guten Tag, Anna' })).toBeVisible();
    await expect(patient.getByText('Heute 0 von 2 Ausführungen erfasst.')).toBeVisible();
    await expect
      .poll(() => patient.getByAltText('Bild der Übung 2A').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    // Schedule per exercise; 2D is free today; the guide shows FRM and the chosen variant (iteration 8)
    await expect(patient.locator('li.ex[data-code="2A"]')).toContainText('2× pro Tag · jeden Tag');
    await expect(patient.locator('li.ex[data-code="2D"]')).toContainText('heute frei · 0 erfasst');
    await expect(patient.locator('li.ex[data-code="2D"]')).toContainText('FRM + EPD Variante 1');
    await patient.locator('li.ex[data-code="2D"] details.guide summary').click();
    await expect(patient.locator('li.ex[data-code="2D"] .chosen')).toContainText('Platzhalter 2D: Variante 1');

    // Ausführung erfassen: 2A gemacht, 7/10, with a note
    await patient.locator('li.ex[data-code="2A"] summary').click();
    const form = entryForm(patient, '2A');
    await form.getByText('Ja', { exact: true }).click();
    await form.getByText('7', { exact: true }).click();
    await form.getByLabel('Bemerkung (optional)').fill('Rechte Seite spannt');
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(patient.getByText('Gespeichert.')).toBeVisible();
    await expect(patient.getByText('Heute 1 von 2 Ausführungen erfasst.')).toBeVisible();
    const entries = patient.getByTestId('entry');
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText('7/10');
    await expect(entries.first()).toContainText('Rechte Seite spannt');

    // Schnelleintrag: the open execution of 2A today
    await patient.getByRole('button', { name: 'Alle heutigen Übungen erledigt' }).click();
    await expect(patient.getByText(/1 Ausführung als gemacht erfasst/)).toBeVisible();
    await expect(entries).toHaveCount(2);
    await expect(patient.getByRole('button', { name: 'Alle heutigen Übungen erledigt' })).toHaveCount(0);

    // Korrektur innerhalb von 24 Stunden: 7/10 becomes 5/10
    const rated = entries.filter({ hasText: '7/10' });
    await rated.locator('summary').click();
    const correct = patient.getByRole('form', { name: 'Eintrag 2A ändern' });
    await correct.getByText('5', { exact: true }).click();
    await correct.getByRole('button', { name: 'Speichern' }).click();
    await expect(patient.getByText('Korrektur gespeichert.')).toBeVisible();
    await expect(entries.filter({ hasText: '5/10' })).toHaveCount(1);
    await expectNoHorizontalScroll(patient, 'Heute and Letzte 14 Tage');
    await expectNoA11yViolations(patient, 'Heute and Letzte 14 Tage');

    // Image only with a session
    const stranger = await browser.newContext();
    expect((await stranger.request.get(`${ZONE}/media/2A`)).status()).toBe(404);
    await stranger.close();

    // Practice: tile and tab
    await page.goto('/');
    const row = page.getByTestId('home-program-row').filter({ hasText: `Anna ${last}` });
    await expect(row).toBeVisible();
    await expect(row).toContainText('aktiv');
    await expectNoA11yViolations(page, 'dashboard with the tile "Heimprogramm"');
    await row.getByRole('link', { name: `Anna ${last}` }).click();
    await expect(page).toHaveURL(/tab=log/);
    await expect(page.getByTestId('log-entry')).toHaveCount(2);
    await expect(page.getByTestId('link-status')).toContainText('aktiv');
    await expect(page.getByTestId('link-email')).toContainText(`an ${email} gesendet`);
    await expect(page.locator('main')).toContainText('Rechte Seite spannt');
    await expect(page.locator('main')).toContainText('Schnelleintrag');
    await expectNoA11yViolations(page, 'tab "Übungstagebuch"');

    // Link sperren: the phone is signed out, the link no longer works
    await page.getByRole('button', { name: 'Link sperren' }).click();
    await expect(page.getByText(/Link gesperrt\./)).toBeVisible();
    await expect(page.getByTestId('link-status')).toContainText('gesperrt');
    await patient.goto(ZONE);
    await expect(patient.getByRole('heading', { level: 1, name: 'Patienten-Zone' })).toBeVisible();
    await patient.goto(link);
    await expect(patient.getByTestId('invalid')).toContainText('Dieser Link ist nicht gültig.');
    await patient.context().close();
    expect(recordUrl).toContain('/patients/');
  });
});
