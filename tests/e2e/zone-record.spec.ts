import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { confirmInZone, createSignedPatient, expectNoA11yViolations, login, phone, unique } from './helpers';

/**
 * Iteration 6, task 6.1: the record in the patient zone on a phone (390 px). Tabs, a treatment with its
 * consultation, opening a document (PDF response), recording yesterday afterwards, and the mark "nachgetragen" and the
 * retrieval in the practice. Needs both apps (playwright.config.ts starts them).
 */

const OUTBOX = path.resolve(process.env.E2E_OUTBOX_DIR ?? 'data/e2e-outbox');

/** The link of the newest email with the exercise sheet to `to` */
async function sheetLink(to: string) {
  let url = '';
  await expect(async () => {
    const files = (await readdir(OUTBOX)).filter((f) => f.endsWith('.json')).sort();
    for (const f of files.reverse()) {
      const mail = JSON.parse(await readFile(path.join(OUTBOX, f), 'utf8')) as { to: string; text: string };
      const m = mail.to === to ? /https?:\/\/\S+\/l\/[A-Za-z0-9_-]{43}/.exec(mail.text) : null;
      if (m && /Übungsblatt/.test(mail.text)) {
        url = m[0];
        return;
      }
    }
    throw new Error(`No exercise sheet with a link to ${to} yet`);
  }).toPass({ timeout: 20_000 });
  return url;
}

/** "YYYY-MM-DDTHH:mm" in Swiss time, `days` days ago at the given hour */
function zurichLocal(days: number, hour: number) {
  const d = new Date(Date.now() - days * 86400_000);
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(d);
  return `${day}T${String(hour).padStart(2, '0')}:00`;
}

async function expectNoHorizontalScroll(page: Page, name: string) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, `${name} scrolls sideways at 390 px`).toBeLessThanOrEqual(client);
}

test('record in the patient zone: tabs, treatment, document, recording yesterday', async ({ page, browser }) => {
  test.setTimeout(240_000);
  const id = unique();
  const email = `lena.${id}@example.ch`;
  const last = `Akte${id}`;

  // Practice: treatment and consultation 3 days ago with 2A täglich 1x, pain 60 → 30, sheet by email with the link
  await login(page);
  await createSignedPatient(page, { first: 'Lena', last, dob: '14.02.1985', emailConsent: true, email });
  const recordUrl = page.url().split('?')[0];
  await page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' }).click();
  await page.locator('#f_startedAt').fill(zurichLocal(3, 10));
  await page.locator('#f_regionId').selectOption('6');
  await page.locator('#f_painStart').selectOption('60');
  await page.locator('#f_diagnosis').fill('Lumbalgie links');
  await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
  await page.locator('section.treat').first().getByRole('link', { name: 'Konsultation', exact: true }).click();
  await page.locator('#f_at').fill(zurichLocal(3, 10));
  await page
    .getByRole('group', { name: 'Schmerz vor der Konsultation, %' })
    .getByRole('button', { name: '60' })
    .click();
  await page
    .getByRole('group', { name: 'Schmerz nach der Konsultation (Restschmerz), %' })
    .getByRole('button', { name: '30' })
    .click();
  await page.getByLabel('Übung 2A verordnet').check();
  await page.getByRole('button', { name: 'Konsultation speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Übungsblatt' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Übungsblatt senden' }).click();
  await expect(page.getByText('Der Link zur Patienten-Zone steht im Text der E-Mail.')).toBeVisible();
  const link = await sheetLink(email);

  // Patient: tabs Übungen, Behandlungen, Dokumente
  const patient = await phone(browser);
  await confirmInZone(patient, link, '14.02.1985');
  const tabs = patient.getByRole('navigation', { name: 'Bereiche der Patienten-Zone' });
  await expect(tabs.getByRole('link')).toHaveText(['Übungen', 'Behandlungen', 'Dokumente']);
  await expect(tabs.getByRole('link', { name: 'Übungen' })).toHaveAttribute('aria-current', 'page');

  // Gestern nachtragen: previous day, record 2A, back to today
  await patient.getByRole('link', { name: 'Vorheriger Tag' }).click();
  await expect(patient.getByTestId('day')).toContainText('Gestern');
  await patient.locator('li.ex[data-code="2A"] summary').click();
  const form = patient.getByRole('form', { name: 'Eintrag 2A', exact: true });
  await expect(form.getByLabel('Zeit')).toHaveValue('12:00');
  await form.getByText('Ja', { exact: true }).click();
  await form.getByText('6', { exact: true }).click();
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(patient.getByText('Gespeichert.')).toBeVisible();
  await expect(patient.getByTestId('day')).toContainText('Gestern');
  await expect(patient.locator('li.ex[data-code="2A"]').getByTestId('progress')).toHaveText('1 von 1 an diesem Tag');
  await expectNoHorizontalScroll(patient, 'day view');
  await expectNoA11yViolations(patient, 'day view');
  // Two days ago with "Alle Übungen dieses Tages erledigt"
  await patient.getByRole('link', { name: 'Vorheriger Tag' }).click();
  await patient.getByRole('button', { name: 'Alle Übungen dieses Tages erledigt' }).click();
  await expect(patient.getByText(/1 Ausführung für .* als gemacht erfasst/)).toBeVisible();
  await expect(patient.getByTestId('entry')).toHaveCount(2);
  // The consultation day is the first day
  await patient.getByRole('link', { name: 'Vorheriger Tag' }).click();
  await expect(patient.getByRole('link', { name: 'Vorheriger Tag' })).toHaveCount(0);

  // Behandlungen and the treatment with its consultation
  await tabs.getByRole('link', { name: 'Behandlungen' }).click();
  await expect(patient.getByRole('heading', { level: 1, name: 'Meine Behandlungen' })).toBeVisible();
  await expect(patient.getByTestId('treatment')).toHaveCount(1);
  await expect(patient.getByTestId('treatment')).toContainText('Lumbalgie links');
  await expectNoHorizontalScroll(patient, 'treatments');
  await expectNoA11yViolations(patient, 'treatments');
  await patient.getByTestId('treatment').click();
  await expect(patient.getByRole('heading', { level: 2, name: 'Schmerzverlauf' })).toBeVisible();
  const cons = patient.getByTestId('consultation');
  await expect(cons).toHaveCount(1);
  await expect(cons).toContainText('60 % → 30 %');
  await expect(cons).toContainText('2A täglich 1x');
  await expect(patient.locator('img')).toHaveCount(0);
  await expectNoHorizontalScroll(patient, 'treatment');
  await expectNoA11yViolations(patient, 'treatment');

  // Dokumente: exercise sheet and disclaimer, PDF response
  await tabs.getByRole('link', { name: 'Dokumente' }).click();
  await expect(patient.getByRole('heading', { level: 1, name: 'Meine Dokumente' })).toBeVisible();
  await expect(patient.getByTestId('sheets').locator('a.doc')).toHaveCount(1);
  await expect(patient.getByTestId('disclaimers')).toContainText('unterschrieben online');
  await expectNoHorizontalScroll(patient, 'documents');
  await expectNoA11yViolations(patient, 'documents');
  // Absolute: the request context's base URL is the practice app
  const href = new URL((await patient.getByTestId('sheets').locator('a.doc').getAttribute('href'))!, patient.url());
  const pdf = await patient.request.get(href.toString());
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect(pdf.headers()['content-disposition']).toMatch(/^inline; filename="PT-\d{4}-\d{5}\.pdf"$/);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  // Without a session no PDF
  const stranger = await browser.newContext();
  const anon = await stranger.request.get(href.toString(), { maxRedirects: 0 });
  expect(anon.status()).not.toBe(200);
  await stranger.close();
  await patient.context().close();

  // Practice: the entry of yesterday counts for yesterday; retrieval in the history
  await page.goto(`${recordUrl}?tab=history`);
  await expect(page.getByText('Dokument in der Patienten-Zone abgerufen')).toBeVisible();
  await page.goto(`${recordUrl}?tab=log`);
  await expect(page.getByTestId('log-entry')).toHaveCount(2);
  // The entry of two days ago was recorded more than 24 hours later
  await expect(page.getByTestId('backfilled').first()).toContainText('nachgetragen am');
});
