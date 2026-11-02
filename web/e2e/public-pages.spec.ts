import { test, expect } from '@playwright/test';

// Static public info/legal pages — no auth, no stubs needed.
const PAGES: { path: string; h1: RegExp }[] = [
  { path: '/privacy', h1: /Política de Privacidad/ },
  { path: '/terms', h1: /Términos de Servicio/ },
  { path: '/cookies', h1: /Política de Cookies/ },
  { path: '/aml', h1: /Prevención de Lavado de Activos/ },
  { path: '/help', h1: /Centro de Ayuda/ },
  { path: '/academy', h1: /Academia/ },
  { path: '/status', h1: /Estado del Sistema/ },
  { path: '/about', h1: /Sobre BitFlow/ },
  { path: '/news', h1: /Noticias/ },
];

test.describe('public info pages', () => {
  for (const p of PAGES) {
    test(`${p.path} renders its heading`, async ({ page }) => {
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1, name: p.h1 })).toBeVisible();
    });
  }

  test('register terms link points to /terms (reconciled)', async ({ page }) => {
    await page.goto('/register');
    // Scope to the form — the footer also links /terms now (both reconciled).
    await expect(page.locator('form a[href="/terms"]')).toBeVisible();
  });

  test('screenshots of a legal, a resource and the status page', async ({ page }) => {
    await page.goto('/terms');
    await page.screenshot({ path: 'test-results/public-terms.png', fullPage: true });
    await page.goto('/help');
    await page.screenshot({ path: 'test-results/public-help.png', fullPage: true });
    await page.goto('/status');
    await page.screenshot({ path: 'test-results/public-status.png' });
  });
});
