import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('access-control', () => {
  test('without sign-in the app shows only the sign-in page', async ({ page }) => {
    await page.goto('/patients');
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /Willkommen/ })).toBeVisible();
  });

  test('an account of another tenant gets "Kein Zugang"', async ({ page }) => {
    await login(page, { tenant: 'other' });
    await expect(page).toHaveURL(/no-access/);
    await expect(page.getByRole('heading', { name: 'Kein Zugang' })).toBeVisible();
  });

  test('a guest account gets "Kein Zugang"', async ({ page }) => {
    await login(page, { tenant: 'guest' });
    await expect(page.getByRole('heading', { name: 'Kein Zugang' })).toBeVisible();
  });

  test('an Ayanta user without role is told to request one', async ({ page }) => {
    await login(page, { role: 'none' });
    await expect(page.getByText(/keine Rolle für diese Anwendung/)).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('a therapist cannot manage form texts', async ({ page }) => {
    await login(page, { role: 'Therapist' });
    await expect(page.getByRole('heading', { name: /Guten (Morgen|Tag|Abend), Mike/ })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Formulartexte' })).toHaveCount(0);
    await page.goto('/admin/consent-texts');
    await expect(page.getByText('Für diese Seite fehlt Ihnen die Berechtigung.')).toBeVisible();
  });

  test('sign out ends the session', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Abmelden' }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});
