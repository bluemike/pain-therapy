import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, type Browser, type Locator, type Page } from '@playwright/test';

const OUTBOX = path.resolve(process.env.E2E_OUTBOX_DIR ?? 'data/e2e-outbox');

/** Mails in the outbox (MAIL_DRIVER=outbox), to pass as `before` so only newer mails count */
export async function outboxFiles() {
  return new Set((await readdir(OUTBOX).catch(() => [] as string[])).filter((f) => f.endsWith('.json')));
}

/** The link of the newest invitation to sign to `to`, ignoring mails listed in `before` */
export async function inviteFromOutbox(to: string, before = new Set<string>()) {
  let url = '';
  await expect(async () => {
    const files = (await readdir(OUTBOX)).filter((f) => f.endsWith('.json') && !before.has(f)).sort();
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

/** A phone (390 px, touch) in its own browser context, like the patient's own device */
export async function phone(browser: Browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
  });
  return context.newPage();
}

/** Opens a zone link on `patient` and confirms with the date of birth (DD.MM.YYYY) */
export async function confirmInZone(patient: Page, link: string, dob: string) {
  const [d, m, y] = dob.split('.');
  await patient.goto(link);
  await patient.getByLabel('Tag (TT)').fill(d);
  await patient.getByLabel('Monat (MM)').fill(m);
  // zone-login (iteration 9): 4 digits of the year submit the form
  await patient.getByLabel('Jahr (JJJJ)').fill(y);
  await expect(patient.getByRole('heading', { level: 1, name: /^Guten Tag/ })).toBeVisible();
}

export async function login(
  page: Page,
  opts: {
    role?: 'Therapist' | 'Admin' | 'Therapist,Admin' | 'none';
    tenant?: 'member' | 'guest' | 'other';
    name?: string;
  } = {},
) {
  await page.goto('/login');
  await page.getByLabel(/^(Name)$/).fill(opts.name ?? 'Mike Franz');
  await page.locator('#role').selectOption(opts.role ?? 'Therapist,Admin');
  await page.locator('#tenant').selectOption(opts.tenant ?? 'member');
  await page.getByRole('button', { name: /^(Anmelden|Sign in)$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'));
}

export const unique = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

/** Fills the required fields of the new-patient form; email defaults to <first>@example.ch. */
export async function fillPatient(
  page: Page,
  p: { first: string; last: string; dob: string; lang?: 'de' | 'en'; email?: string; street?: string },
) {
  await page.locator('#f_firstName').fill(p.first);
  await page.locator('#f_lastName').fill(p.last);
  await page.locator('#f_dateOfBirth').fill(p.dob);
  if (p.lang) await page.locator('#f_preferredLanguage').selectOption(p.lang);
  await page.locator('#f_email').fill(p.email ?? `${p.first.toLowerCase()}@example.ch`);
  if (p.street) await page.locator('#f_street').fill(p.street);
}

export async function drawSignature(page: Page) {
  const pad = page.getByTestId('signature');
  await pad.scrollIntoViewIfNeeded();
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 40, box.y + box.height * 0.6);
  await page.mouse.down();
  for (let i = 0; i <= 30; i++)
    await page.mouse.move(box.x + 40 + i * 9, box.y + box.height * 0.6 + Math.sin(i / 2.5) * 30);
  await page.mouse.up();
}

/**
 * Creates a German-speaking patient, invites them by email and signs the disclaimer in the patient zone on a phone
 * (the only way to sign since Iteration 6), then opens the record once the PDF is archived. With `emailConsent` the
 * patient also agrees to unencrypted email.
 */
export async function createSignedPatient(
  page: Page,
  p: { first: string; last: string; dob: string; emailConsent?: boolean; email?: string },
) {
  const email = p.email ?? `${p.first.toLowerCase()}@example.ch`;
  await page.goto('/patients/new');
  await fillPatient(page, { ...p, email });
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/ist angelegt/)).toBeVisible();
  const recordUrl = page.url().split('?')[0];
  const before = await outboxFiles();
  await page.locator('.banner').getByRole('button', { name: 'Zur Unterschrift einladen' }).click();
  const dialog = page.getByTestId('invite-dialog').filter({ visible: true });
  await dialog.getByRole('button', { name: `Per E-Mail an ${email}` }).click();
  await expect(dialog.getByText(`Die Einladung geht per E-Mail an ${email}.`)).toBeVisible();
  const link = await inviteFromOutbox(email, before);

  const patient = await phone(page.context().browser()!);
  await confirmInZone(patient, link, p.dob);
  await patient.getByRole('link', { name: 'Formular öffnen' }).click();
  await patient.getByText('Ende des Textes.').scrollIntoViewIfNeeded();
  await expect(patient.getByText('✓ Text gelesen')).toBeVisible();
  await patient.getByTestId('consent-liability').check();
  await patient.getByTestId('consent-dataProcessing').check();
  if (p.emailConsent) await patient.getByTestId('consent-unencryptedEmail').check();
  await drawSignature(patient);
  await patient.getByRole('button', { name: 'Unterschreiben', exact: true }).click();
  await expect(patient.getByRole('heading', { level: 1, name: 'Vielen Dank' })).toBeVisible();
  await patient.context().close();

  await expect(async () => {
    await page.goto(`${recordUrl}?tab=documents`);
    await expect(page.locator('.doc').filter({ hasText: 'Kanal: Patienten-Zone' })).toContainText('PT-');
  }).toPass({ timeout: 20_000 });
  await page.goto(recordUrl);
  await expect(page.getByRole('heading', { level: 1, name: `${p.first} ${p.last}` })).toBeVisible();
}

/** ui-foundation: axe check, no WCAG 2.1 AA violations */
export async function expectNoA11yViolations(page: Page, name: string) {
  const { default: AxeBuilder } = await import('@axe-core/playwright');
  // @axe-core/playwright is typed against its own playwright-core copy
  const { violations } = await new AxeBuilder({ page: page as never })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const summary = violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(summary, `${name} has accessibility violations`).toEqual([]);
}

/** app-navigation (iteration 9, design D1): opens the menu of the initials button ("Mein Profil", "Abmelden") */
export async function openUserMenu(page: Page) {
  await page.getByRole('button', { name: /^Menü für / }).click();
}

/** app-navigation (iteration 9, design D3): the PDF behind a link to the in-app view `/pdf?src=…` */
export function pdfSrcOf(href: string, base: string) {
  const url = new URL(href, base);
  expect(url.pathname).toBe('/pdf');
  return new URL(url.searchParams.get('src')!, base).toString();
}

/** Opens a PDF link in the in-app view, waits for the rendered pages and goes back with «Zurück» */
export async function viewPdfAndBack(page: Page, link: Locator) {
  const from = page.url();
  await link.click();
  const viewer = page.getByTestId('pdf-viewer');
  await expect(viewer).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
  await expect(viewer.locator('canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(from);
}

/** app-navigation (iteration 9, design D2): a dialog sits in the middle of the viewport */
export async function expectCentered(page: Page, dialog: Locator) {
  const box = (await dialog.boundingBox())!;
  const view = page.viewportSize()!;
  expect(Math.abs(box.x + box.width / 2 - view.width / 2)).toBeLessThan(4);
  if (box.height < view.height - 40) expect(Math.abs(box.y + box.height / 2 - view.height / 2)).toBeLessThan(4);
}
