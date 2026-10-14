import { Page, Route, expect } from '@playwright/test';

/** Fulfill a route with a JSON body. */
export function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}

/** A verified, non-admin user for GET /api/user/me. */
export const VERIFIED_USER = {
  id: '1',
  username: 'neo',
  email: 'a@b.co',
  active: true,
  role: 'user',
  emailVerified: true,
  twoFactorEnabled: false,
  kycVerified: false,
  kycLevel: 'none',
};

/**
 * Reach an authenticated state the way a real user does — by logging in through
 * the UI. This sets the token client-side and lands on /dashboard via a
 * client-side router push, so there is NO server render with a token in hand and
 * therefore no hydration mismatch (which a pre-seeded localStorage token + a full
 * page.goto would trigger, popping the Next dev error overlay). Navigate to money
 * pages afterwards with gotoApp() (a nav-link click = SPA navigation, no reload).
 */
export async function loginViaUI(page: Page, user: Record<string, unknown> = VERIFIED_USER) {
  await page.route('**/api/user/login', (r) => r.fulfill(json({ user: { username: user.username }, token: 'e2e-jwt' })));
  await page.route('**/api/user/me', (r) => r.fulfill(json(user)));
  await page.goto('/login');
  await page.getByLabel('Email').fill('a@b.co');
  await page.getByLabel('Password').fill('secret12');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Client-side navigation to an (app) page via its nav link (no full reload). */
export async function gotoApp(page: Page, linkName: string, urlRe: RegExp) {
  await page.getByRole('link', { name: linkName }).click();
  await expect(page).toHaveURL(urlRe);
}

/**
 * Capture the Idempotency-Key header sent to a money endpoint while fulfilling it.
 * Returns an object whose `.keys` array collects every key seen for that route.
 */
export function captureIdempotencyKeys(
  page: Page,
  urlGlob: string,
  responder: (route: Route) => { status?: number; body: unknown },
) {
  const keys: (string | undefined)[] = [];
  page.route(urlGlob, (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    const { status = 200, body } = responder(route);
    route.fulfill(json(body, status));
  });
  return { keys };
}
