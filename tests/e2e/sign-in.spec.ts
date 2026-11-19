import { createHash, randomBytes } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { expect, test, type Page } from '@playwright/test';
import { totpAt } from '../../src/lib/auth/totp';
import { codeFromOutbox, openUserMenu, outboxFiles, unique } from './helpers';

/**
 * therapist-login (iteration 12, task 7.3): invitation with authenticator app or passkey (virtual authenticator of
 * Chromium), sign-in with email code plus authenticator, passkey sign-in, lock after wrong codes.
 */

const db = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL ?? 'postgresql://app:app@localhost:5432/pain_therapy',
});

// Wrong codes of earlier runs from the same address would count towards the lock per IP
test.beforeAll(async () => {
  await db.loginFailure.deleteMany();
});

test.afterAll(async () => {
  await db.$disconnect();
});

/** An invitation to the practice Falera, as the team page (phase 5) will create it */
async function invite(email: string, roles: ('THERAPIST' | 'PRACTICE_ADMIN')[] = ['THERAPIST']) {
  const token = randomBytes(32).toString('base64url');
  await db.invitation.create({
    data: {
      email,
      practiceId: 'prc_falera',
      roles,
      tokenHash: createHash('sha256').update(token).digest('base64url'),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600_000),
      invitedBy: 'Chrissie',
    },
  });
  return `/einladung/${token}`;
}

async function confirmEmail(page: Page, email: string) {
  const before = await outboxFiles();
  await page.getByRole('button', { name: 'Code senden' }).click();
  await page.getByLabel('Code aus der E-Mail').fill(await codeFromOutbox(email, before));
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
}

async function finishRecovery(page: Page) {
  await expect(page.getByTestId('recovery-codes').locator('li')).toHaveCount(10);
  const first = (await page.getByTestId('recovery-codes').locator('li').first().textContent()) ?? '';
  await page.getByLabel('Ich habe die Codes sicher aufbewahrt.').check();
  await page.getByRole('button', { name: 'Weiter zur Anwendung' }).click();
  await expect(page.getByRole('link', { name: 'Patient:innen' }).first()).toBeVisible();
  return first;
}

async function signOut(page: Page) {
  await openUserMenu(page);
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page).toHaveURL(/\/login/);
}

const totpNow = (secret: string) => totpAt(secret, Date.now());

test.describe('therapist-login', () => {
  test('invitation with authenticator app, then sign-in with email code plus authenticator', async ({ page }) => {
    const email = `totp-${unique()}@example.test`;
    await page.goto(await invite(email));
    await expect(page.getByRole('heading', { name: 'Willkommen bei Pain Therapy Falera' })).toBeVisible();
    await confirmEmail(page, email);
    await page.getByRole('button', { name: 'Stattdessen Authenticator-App verwenden' }).click();
    const secret = ((await page.getByTestId('totp-secret').textContent()) ?? '').replace(/\s/g, '');
    await page.getByLabel('Code aus der App').fill(totpNow(secret));
    await page.getByRole('button', { name: 'Bestätigen' }).click();
    const recovery = await finishRecovery(page);
    await signOut(page);

    // Email code alone is not enough
    await page.getByLabel('E-Mail-Adresse').fill(email);
    let before = await outboxFiles();
    await page.getByRole('button', { name: 'Code senden' }).click();
    await expect(page.getByText('Falls zu dieser Adresse ein Konto besteht')).toBeVisible();
    await page.getByLabel('Code aus der E-Mail').fill(await codeFromOutbox(email, before));
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await page.getByLabel('Code aus der Authenticator-App').fill(totpNow(secret) === '000000' ? '111111' : '000000');
    await page.getByRole('button', { name: 'Anmelden mit Code' }).click();
    await expect(page.getByText('Der Code stimmt nicht.')).toBeVisible();
    await page.getByLabel('Code aus der Authenticator-App').fill(totpNow(secret));
    await page.getByRole('button', { name: 'Anmelden mit Code' }).click();
    await expect(page.getByRole('link', { name: 'Patient:innen' }).first()).toBeVisible();
    await signOut(page);

    // Lost phone: a recovery code instead of the authenticator
    await page.getByLabel('E-Mail-Adresse').fill(email);
    before = await outboxFiles();
    await page.getByRole('button', { name: 'Code senden' }).click();
    await page.getByLabel('Code aus der E-Mail').fill(await codeFromOutbox(email, before));
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await page.getByRole('button', { name: 'Stattdessen Wiederherstellungscode' }).click();
    await page.getByLabel('Wiederherstellungscode').fill(recovery);
    await page.getByRole('button', { name: 'Anmelden mit Code' }).click();
    await expect(page.getByRole('link', { name: 'Patient:innen' }).first()).toBeVisible();
  });

  test('invitation with passkey, then sign-in with the passkey alone', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'virtual authenticator of Chromium');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('WebAuthn.enable');
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });
    const email = `passkey-${unique()}@example.test`;
    await page.goto(await invite(email, ['PRACTICE_ADMIN', 'THERAPIST']));
    await expect(page.getByText('als Praxis-Admin eingeladen')).toBeVisible();
    await confirmEmail(page, email);
    await page.getByRole('button', { name: 'Passkey auf diesem Gerät einrichten' }).click();
    await finishRecovery(page);
    await page.goto('/profile/security');
    await expect(page.getByRole('heading', { name: 'Passkeys' })).toBeVisible();
    await expect(page.getByText(/eingerichtet am/)).toHaveCount(1);
    await signOut(page);

    await page.getByRole('button', { name: 'Mit Passkey anmelden' }).click();
    await expect(page.getByRole('link', { name: 'Patient:innen' }).first()).toBeVisible();
    // Roles come from the membership: a Praxis-Admin manages the form texts
    await expect(page.getByRole('link', { name: 'Formulartexte' })).toBeVisible();
  });

  test('an unknown address gets the same answer; 5 wrong codes lock the address', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('E-Mail-Adresse').fill(`niemand-${unique()}@example.test`);
    await page.getByRole('button', { name: 'Code senden' }).click();
    await expect(page.getByText('Falls zu dieser Adresse ein Konto besteht')).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.getByLabel('Code aus der E-Mail').fill('123456');
      await page.getByRole('button', { name: 'Weiter', exact: true }).click();
      await expect(page.getByText('Der Code stimmt nicht.')).toBeVisible();
    }
    await page.getByLabel('Code aus der E-Mail').fill('123456');
    await page.getByRole('button', { name: 'Weiter', exact: true }).click();
    await expect(page.getByText('Zu viele falsche Codes. Bitte versuchen Sie es in 15 Minuten wieder.')).toBeVisible();
  });
});
