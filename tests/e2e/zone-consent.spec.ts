import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { drawSignature, expectNoA11yViolations, fillPatient, login, unique } from './helpers';

/**
 * Iteration 5, task 3.4: invite a new patient to sign (mail to the outbox instead of Graph), open the link on a phone
 * (390 px), confirm with the date of birth, read, consent and sign with the finger; the practice sees the signature,
 * the PDF with channel "Patienten-Zone" and the remark. Needs both apps (playwright.config.ts starts them).
 */

const OUTBOX = path.resolve(process.env.E2E_OUTBOX_DIR ?? 'data/e2e-outbox');

async function inviteFromOutbox(to: string) {
  let url = '';
  await expect(async () => {
    const files = (await readdir(OUTBOX)).filter((f) => f.endsWith('.json')).sort();
    for (const f of files.reverse()) {
      const mail = JSON.parse(await readFile(path.join(OUTBOX, f), 'utf8')) as {
        to: string;
        subject: string;
        text: string;
      };
      const m =
        mail.to === to && mail.subject.includes('unterschreiben')
          ? /https?:\/\/\S+\/l\/[A-Za-z0-9_-]{43}/.exec(mail.text)
          : null;
      if (m) {
        url = m[0];
        return;
      }
    }
    throw new Error(`No invitation to ${to} yet`);
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

test.describe('signature in the patient zone', () => {
  test('invitation by email, signing on the phone, PDF and remark in the record', async ({ page, browser }) => {
    test.setTimeout(180_000);
    const id = unique();
    const email = `zoe.${id}@example.ch`;
    const last = `Unterschrift${id}`;

    // Practice: new patient, invite by email right after saving (Nach der Aufnahme per E-Mail)
    await login(page);
    await page.goto('/patients/new');
    await fillPatient(page, { first: 'Zoe', last, dob: '12.03.1978', email, street: 'Via Prau 3' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/ist angelegt/)).toBeVisible();
    const recordUrl = page.url().split('?')[0];
    await page.locator('.banner').getByRole('button', { name: 'Zur Unterschrift einladen' }).click();
    const dialog = page.getByTestId('invite-dialog').filter({ visible: true });
    await expect(dialog).toBeVisible();
    await expectNoA11yViolations(page, 'invitation dialog');
    await dialog.getByRole('button', { name: `Per E-Mail an ${email}` }).click();
    await expect(dialog.getByText(`Die Einladung geht per E-Mail an ${email}.`)).toBeVisible();
    const link = await inviteFromOutbox(email);
    await dialog.getByRole('button', { name: 'Schliessen' }).click();
    await page.goto(recordUrl);
    await expect(page.getByTestId('invite-state').first()).toContainText(/Einladung per E-Mail versendet am|nicht/);

    // Patient on the phone: confirmation, then only the task to sign (Unterschrift vor den Übungen)
    const patient = await phone(browser);
    await patient.goto(link);
    await patient.getByLabel('Tag (TT)').fill('12');
    await patient.getByLabel('Monat (MM)').fill('03');
    await patient.getByLabel('Jahr (JJJJ)').fill('1978');
    await patient.getByRole('button', { name: 'Bestätigen' }).click();
    await expect(patient.getByRole('heading', { level: 1, name: 'Guten Tag Zoe' })).toBeVisible();
    await expect(patient.getByRole('heading', { name: /Haftungsausschluss unterschreiben/ })).toBeVisible();
    await expectNoHorizontalScroll(patient, 'task');
    await expectNoA11yViolations(patient, 'task');

    // Practice sees "Link geöffnet"
    await page.reload();
    await expect(page.getByTestId('invite-state').first()).toContainText('Link geöffnet am');

    // The form: details for checking, read to the end, consents, signature with the finger
    await patient.getByRole('link', { name: 'Formular öffnen' }).click();
    await expect(patient.getByRole('heading', { level: 1, name: 'Haftungsausschluss unterschreiben' })).toBeVisible();
    await expect(patient.locator('dl.kv')).toContainText(`Zoe ${last}`);
    await expect(patient.locator('dl.kv')).toContainText('Via Prau 3');
    await expect(patient.getByTestId('consent-liability')).toBeDisabled();
    await expectNoHorizontalScroll(patient, 'form');
    await expectNoA11yViolations(patient, 'form');
    await patient.getByLabel('Anmerkung zu meinen Angaben (optional)').fill('Neue Mobile-Nummer 079 765 43 21');

    // Leeres Feld: nothing is saved without a signature
    await patient.getByText('Ende des Textes.').scrollIntoViewIfNeeded();
    await expect(patient.getByText('✓ Text gelesen')).toBeVisible();
    await patient.getByTestId('consent-liability').check();
    await patient.getByTestId('consent-dataProcessing').check();
    await patient.getByRole('button', { name: 'Unterschreiben', exact: true }).click();
    await expect(patient.getByText('Bitte unterschreiben Sie im Feld.')).toBeVisible();

    // Only the field takes the finger (touch-action: none), so drawing does not scroll the page and scrolling the page
    // next to it does not draw
    const pad = patient.getByTestId('signature');
    await pad.scrollIntoViewIfNeeded();
    expect(await pad.evaluate((el) => getComputedStyle(el).touchAction)).toBe('none');
    expect(await patient.locator('main').evaluate((el) => getComputedStyle(el).touchAction)).toBe('auto');
    const scrollBefore = await patient.evaluate(() => window.scrollY);
    await drawSignature(patient);
    expect(await patient.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(patient.getByText('Bitte unterschreiben Sie im Feld.')).toHaveCount(0);
    // Unterschrift wiederholen
    await patient.getByRole('button', { name: 'Unterschrift löschen' }).click();
    await expect(patient.getByText('Hier mit dem Finger unterschreiben')).toBeVisible();
    await drawSignature(patient);
    await patient.getByRole('button', { name: 'Unterschreiben', exact: true }).click();
    await expect(patient.getByRole('heading', { level: 1, name: 'Vielen Dank' })).toBeVisible();
    await expect(patient.getByText('Sie können diese Seite jetzt schliessen.')).toBeVisible();
    await expectNoHorizontalScroll(patient, 'thanks');
    await expectNoA11yViolations(patient, 'thanks');

    // Practice: signed online, remark with "Erledigt", PDF with channel "Patienten-Zone"
    await page.reload();
    await expect(page.getByText(/Unterschrieben online in der Patienten-Zone am/)).toBeVisible();
    const note = page.getByTestId('patient-note');
    await expect(note).toContainText('Neue Mobile-Nummer 079 765 43 21');
    await expect(page.locator('.rechead').getByRole('link', { name: 'Neue Behandlung' })).toBeVisible();
    await expect(async () => {
      await page.goto(`${recordUrl}?tab=documents`);
      await expect(page.locator('.doc').filter({ hasText: 'Kanal: Patienten-Zone' })).toContainText('PT-');
    }).toPass({ timeout: 20_000 });
    await note.getByRole('button', { name: 'Erledigt' }).click();
    await expect(page.getByTestId('patient-note')).toHaveCount(0);
    await page.goto(`${recordUrl}?tab=history`);
    await expect(page.getByText('Haftungsausschluss in der Patienten-Zone unterschrieben')).toBeVisible();
    await expect(page.getByText('Zur Unterschrift in der Patienten-Zone eingeladen')).toBeVisible();
    await patient.context().close();
  });
});
