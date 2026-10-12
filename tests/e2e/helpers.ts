import { expect, type Page } from '@playwright/test';

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

/** Fills the required fields of the new-patient form. */
export async function fillPatient(
  page: Page,
  p: { first: string; last: string; dob: string; lang?: 'de' | 'en'; email?: string; street?: string },
) {
  await page.locator('#f_firstName').fill(p.first);
  await page.locator('#f_lastName').fill(p.last);
  await page.locator('#f_dateOfBirth').fill(p.dob);
  if (p.lang) await page.locator('#f_preferredLanguage').selectOption(p.lang);
  if (p.email !== undefined) await page.locator('#f_email').fill(p.email);
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

export async function scrollReaderToEnd(page: Page) {
  const reader = page.getByTestId('reader');
  await reader.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  await expect(page.getByText(/Text vollständig gelesen|Text read to the end/)).toBeVisible();
}
