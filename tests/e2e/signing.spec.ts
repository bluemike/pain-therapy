import { expect, test } from '@playwright/test';
import { createSignedPatient, fillPatient, login, pdfSrcOf, unique } from './helpers';

/**
 * Iteration 6, signing-zone-only (task 1.4): the patient mode on the iPad is gone; the practice invites to sign in the
 * patient zone, and the signed PDF lands in the record and the patient finds it in the zone (iteration 9: no email).
 */
test.describe('signing only in the patient zone', () => {
  test('no hand-over, no pages under /sign, invitation after saving', async ({ page }) => {
    await login(page);
    await page.goto('/patients/new');
    await fillPatient(page, { first: 'Peter', last: `Ohne${unique()}`, dob: '30.01.1955' });
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText(/ist angelegt.*Patienten-Zone einladen/)).toBeVisible();
    await expect(page.locator('.banner').getByRole('button', { name: 'Zur Unterschrift einladen' })).toBeVisible();
    await expect(page.getByText(/übergeben/)).toHaveCount(0);
    for (const path of ['/sign/abc', '/sign/abc/thanks', '/sign/abc/leave'])
      expect((await page.request.get(path)).status(), path).toBe(404);
  });

  test('signed PDF in the record, in the zone instead of an email', async ({ page }) => {
    test.setTimeout(120_000);
    await login(page);
    const email = `sarah.${unique()}@example.com`;
    await createSignedPatient(page, {
      first: 'Sarah',
      last: `Thompson${unique()}`,
      dob: '22.07.1991',
      email,
      emailConsent: true,
    });
    await page.goto(`${page.url().split('?')[0]}?tab=documents`);
    await expect(page.getByText('gültig')).toBeVisible();
    await expect(page.getByText(/Textversion \d+/)).toBeVisible();
    // iteration 9 (design D4): no email with the PDF, the patient finds it in the zone
    await expect(
      page.getByText('Der Patient findet das Dokument in der Patienten-Zone unter «Dokumente».'),
    ).toBeVisible();
    await expect(page.getByText(`Per E-Mail an ${email} gesendet`)).toHaveCount(0);
    const href = await page.getByRole('link', { name: 'PDF öffnen' }).getAttribute('href');
    const res = await page.request.get(pdfSrcOf(href!, page.url()));
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('application/pdf');
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  });
});
