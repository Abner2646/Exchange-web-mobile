import { test, expect, Page } from '@playwright/test';

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

async function stubAuth(page: Page) {
  await page.route('**/api/user/register', (r) => r.fulfill(json({ user: { username: 'neo' }, token: 'temp', message: 'ok' }, 201)));
  await page.route('**/api/user/verify-email', (r) => r.fulfill(json({ user: { username: 'neo' }, token: 'jwt', message: 'ok' })));
  await page.route('**/api/user/login', (r) => r.fulfill(json({ user: { username: 'neo' }, token: 'jwt' })));
  await page.route('**/api/user/me', (r) => r.fulfill(json({ id: '1', username: 'neo', email: 'a@b.co', active: true, role: 'user', emailVerified: true, twoFactorEnabled: false, kycVerified: false, kycLevel: 'none' })));
}

test('register → verify email → dashboard', async ({ page }) => {
  await stubAuth(page);
  await page.goto('/register');
  await page.getByLabel('Email').fill('a@b.co');
  await page.getByLabel('Username').fill('neo');
  await page.getByLabel('Password').fill('secret12');
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/verify-email$/);
  await page.getByLabel('Code').fill('123456');
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});

test('direct login → dashboard', async ({ page }) => {
  await stubAuth(page);
  await page.goto('/login');
  await page.getByLabel('Email').fill('a@b.co');
  await page.getByLabel('Password').fill('secret12');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test('unauthenticated dashboard redirects to login', async ({ page }) => {
  await stubAuth(page);
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});
