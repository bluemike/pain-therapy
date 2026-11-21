import { expect, test, type Page } from '@playwright/test';
import { createSignedPatient, login, pdfSrcOf, setPain, unique } from './helpers';
import { TINY_JPEG, withExif } from '../fixtures/jpeg';

/** Status of a page or API call in the signed-in context of `page`, without following redirects */
async function statusOf(page: Page, url: string) {
  return (await page.request.get(url, { maxRedirects: 0 })).status();
}

/**
 * Iteration 12, task 7.1 (design D1, risk «Vergessene Abfrage ohne Praxis»): a person of a second practice opens every
 * page and API of the practice Falera by its IDs and gets nothing; the same URLs work for Falera.
 */
test.describe('two practices', () => {
  test('a person of another practice reaches no page, file or API of Falera', async ({ page, browser }) => {
    test.setTimeout(180_000);
    const id = unique();
    const last = `Trennung${id}`;

    // ---- Falera: patient with signed disclaimer, treatment with photo, session, export ----
    await login(page);
    await createSignedPatient(page, { first: 'Iso', last, dob: '05.03.1980' });
    const record = new URL(page.url()).pathname;
    const patientId = record.split('/')[2]!;

    await page.goto(`${record}?tab=documents`);
    const docHref = await page.locator('.doc a[href^="/pdf"]').first().getAttribute('href');
    const documentUrl = new URL(pdfSrcOf(docHref!, page.url())).pathname;
    expect(documentUrl).toMatch(/^\/documents\/[\w-]+$/);

    await page.goto(`${record}/treatments/new`);
    await page.locator('#f_regionId').selectOption('6');
    await page.locator('#f_side').selectOption('RIGHT');
    await page.locator('#f_diagnosis').fill('Trennungstest');
    await setPain(page, 'f_painStart', 60);
    await page
      .locator('#f_photos')
      .setInputFiles([{ name: 'a.jpg', mimeType: 'image/jpeg', buffer: withExif(TINY_JPEG) }]);
    await page.getByRole('button', { name: 'Behandlung eröffnen' }).click();
    await expect(page.getByText('Behandlung eröffnet.')).toBeVisible();
    const card = page.locator('section.treat').first();
    const photoUrl = (await card.locator('.photos a').first().getAttribute('href'))!;
    const sessionNew = (await card.getByRole('link', { name: 'Sitzung', exact: true }).getAttribute('href'))!;
    const treatment = sessionNew.replace(/\/consultations\/new$/, '');

    await page.goto(sessionNew);
    await page.getByRole('button', { name: 'Sitzung speichern' }).click();
    await expect(page.getByText('Sitzung Nr. 1 gespeichert.')).toBeVisible();
    const session = (await page
      .locator(`a[href^="${treatment}/consultations/"]:not([href$="/new"])`)
      .first()
      .getAttribute('href'))!.split('?')[0]!;
    expect(session).not.toMatch(/\/new$/);

    await page.goto('/practice');
    await page.getByRole('button', { name: 'Export erstellen' }).click();
    const download = page.locator('#export').getByRole('link', { name: /^Herunterladen/ });
    await expect(async () => {
      await page.reload();
      await expect(download.first()).toBeVisible({ timeout: 1000 });
    }).toPass({ timeout: 30_000 });
    const exportUrl = (await download.first().getAttribute('href'))!;

    const pages = [
      record,
      `${record}?tab=documents`,
      `${record}?tab=history`,
      `${record}/edit`,
      `${record}/treatments/new`,
      `${treatment}/edit`,
      sessionNew,
      session,
      `${session}/handout`,
    ];
    const files = [documentUrl, photoUrl, `${photoUrl}/thumb`, `/api/patients/${patientId}/consent-state`, exportUrl];

    // Control: Falera reaches all of it
    for (const url of [...pages, ...files]) expect(await statusOf(page, url), url).toBe(200);

    // ---- Second practice, created by the platform account ----
    const slug = `iso-${id}`;
    const platform = await browser.newContext();
    const admin = await platform.newPage();
    await login(admin, { role: 'platform', name: 'Plattform Admin', email: `platform.${id}@example.test` });
    const form = admin.locator('section', { has: admin.getByRole('heading', { name: 'Neue Praxis' }) });
    await form.getByLabel(/^Name der Praxis \*/).fill(`Fremde Praxis ${id}`);
    await form.getByLabel(/^Kurzname/).fill(slug);
    await form.getByLabel(/^Ort/).fill('Chur');
    await form.getByLabel(/^Kontakt-E-Mail/).fill(`fremd.${id}@example.test`);
    await form.getByLabel(/^Kürzel/).fill('FP');
    await form.getByLabel(/^Name der Praxis-Admin/).fill('Fremde Admin');
    await form.getByLabel(/^E-Mail der Praxis-Admin/).fill(`fremd.admin.${id}@example.test`);
    await admin.getByRole('button', { name: 'Praxis anlegen und einladen' }).click();
    await expect(admin.getByText('Die Praxis ist angelegt und die Praxis-Admin eingeladen.')).toBeVisible();
    await platform.close();

    const foreign = await browser.newContext();
    const other = await foreign.newPage();
    await login(other, {
      role: 'Therapist,Admin',
      name: 'Fremde Therapeutin',
      email: `fremd.therapeutin.${id}@example.test`,
      practice: slug,
    });

    // Patient list and search show nothing of Falera
    const toRecord = other.locator(`a[href^="/patients/${patientId}"]`);
    await other.goto(`/patients?q=${last}`);
    await expect(other.getByText(`Keine Treffer für «${last}»`)).toBeVisible();
    await expect(toRecord).toHaveCount(0);
    await other.goto('/');
    await expect(toRecord).toHaveCount(0);

    // Every page and file of Falera by its ID: not found (never a redirect into the record, never the content)
    for (const url of pages) {
      const status = await statusOf(other, url);
      expect(status, url).toBe(404);
    }
    for (const url of files) {
      const res = await other.request.get(url, { maxRedirects: 0 });
      expect([403, 404], url).toContain(res.status());
      expect(res.headers()['content-type'] ?? '', url).not.toMatch(/pdf|image|zip/);
    }

    // The page also renders as «not found» in the browser
    await other.goto(record);
    await expect(other.getByText(`Iso ${last}`)).toHaveCount(0);
    await foreign.close();
  });
});
