import { expect, test } from '@playwright/test';
import { login, openUserMenu } from './helpers';

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
    // "Hallo" only on the first page after signing in (iteration 8, user-profile)
    await expect(page.getByTestId('greeting')).toHaveText(/^Hallo \S+$/);
    await page.reload();
    await expect(page.getByTestId('greeting')).not.toContainText('Hallo');
    await expect(page.getByRole('link', { name: 'Formulartexte' })).toHaveCount(0);
    await page.goto('/admin/consent-texts');
    await expect(page.getByText('Für diese Seite fehlt Ihnen die Berechtigung.')).toBeVisible();
  });

  test('Mein Profil: display name and professional title, greeted again after a new sign-in', async ({ page }) => {
    await login(page, { role: 'Therapist' });
    // app-navigation (iteration 9): profile and sign-out sit in the menu of the initials button
    await openUserMenu(page);
    await expect(page.getByRole('link', { name: 'Mein Profil' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('link', { name: 'Mein Profil' })).toBeHidden();
    await openUserMenu(page);
    await page.getByRole('link', { name: 'Mein Profil' }).click();
    await expect(page.locator('#f_title')).toHaveValue('THERAPIST_M');
    await page.locator('#f_displayName').fill('');
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(page.locator('#f_displayName_m')).toBeVisible();
    await page.locator('#f_displayName').fill('Michael');
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(page.getByText('Profil gespeichert.')).toBeVisible();
    await expect(page.locator('header').first()).toContainText('Therapeut');
    await openUserMenu(page);
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/login/);
    await login(page, { role: 'Therapist' });
    await expect(page.getByTestId('greeting')).toHaveText('Hallo Michael');
    // Back to the preset for the other tests
    await page.goto('/profile');
    await page.locator('#f_displayName').fill('Mike');
    await page.getByRole('button', { name: 'Änderungen speichern' }).click();
    await expect(page.getByText('Profil gespeichert.')).toBeVisible();
  });

  test('sign out ends the session', async ({ page }) => {
    await login(page);
    await openUserMenu(page);
    await page.getByRole('button', { name: 'Abmelden' }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });
});
