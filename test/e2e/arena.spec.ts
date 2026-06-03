import { expect, test, type Page } from '@playwright/test';
import { createLocalStore } from '../../lib/persistence/localStore';

test.setTimeout(60_000);

const PLAYWRIGHT_STORE_PATH = '/tmp/predictarena-playwright-store.json';

test.beforeEach(async () => {
  await createLocalStore({ storagePath: PLAYWRIGHT_STORE_PATH }).replaceArenaState({
    markets: [],
    signals: [],
    autonomyRuns: []
  });
});

async function runAgentsViaApi(page: Page) {
  const response = await page.request.post('/api/run-agents', { data: { limit: 20 } });
  expect(response.ok()).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
}

async function loginToAdmin(page: Page, token: string) {
  await page.getByLabel('Access Token').fill(token);
  await page.getByRole('button', { name: 'Enter Admin' }).click();
}

test('arena loads without manual inputs and keeps wallet-follow workflow', async ({
  page
}, testInfo) => {
  await page.goto('/arena');

  await expect(page.getByRole('heading', { name: 'PredictArena' })).toBeVisible();
  await expect(page.getByText('Arc Forecast Arena')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agent Run Context' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Wallet Funding' })).toBeVisible();
  await expect(page.getByRole('img', { name: /probability radar/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-Scan Markets' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Agents' })).toBeVisible();
  await expect(
    page.getByLabel('PredictArena controls').getByRole('button', { name: 'Connect Wallet' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit Eligible Signals' })).toHaveCount(0);
  await expect(page.getByText('Agent Modes')).toBeVisible();
  await expect(page.getByText('Recent Runs')).toBeVisible();
  await expect(page.getByText('Current Wallet')).toBeVisible();
  await expect(page.getByText('USDC Balance')).toBeVisible();
  await expect(page.getByText('Allowance')).toBeVisible();
  await expect(page.getByText('Latest Arc Tx')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  await page.getByRole('button', { name: '中文', exact: true }).click();
  await expect(page.getByRole('button', { name: '重新扫描市场' })).toBeVisible();
  await page.getByRole('button', { name: 'EN', exact: true }).click();

  const reScanButton = page.getByRole('button', { name: 'Re-Scan Markets' });
  await reScanButton.click();
  await expect(page.getByText('Scan hash')).toBeVisible();
  await expect(page.getByText('Scan delta')).toBeVisible();
  await expect(reScanButton).toBeEnabled({ timeout: 30_000 });
  await expect(page.locator('.command-deck')).toHaveCSS('display', 'grid');
  await expect(page.locator('.command-deck')).toHaveCSS('border-radius', '8px');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByPlaceholder(/question/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /create market/i })).toHaveCount(0);

  await runAgentsViaApi(page);
  await expect(page.getByRole('heading', { name: 'Signal Board' })).toBeVisible();
  await expect(page.getByText('Wallet Follows').first()).toBeVisible();
  await expect(page.getByText('Open Signal Detail').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Signal Detail' })).toHaveCount(0);
  await expect(page.getByText('Agent Probability').first()).toBeVisible();
  await expect(page.getByText('Market Price').first()).toBeVisible();
  await expect(page.getByText('YES Price').first()).toBeVisible();
  await expect(page.getByText('Capped Kelly').first()).toBeVisible();
  await expect(page.getByText('Risk Flags').first()).toBeVisible();
  await expect(page.getByText('Status').first()).toBeVisible();

  const marketCards = page.locator('.market-list .market-card');
  const signalCards = page.locator('.signal-list .signal-card');
  await expect.poll(() => marketCards.count()).toBeGreaterThan(0);
  await expect.poll(() => signalCards.count()).toBeGreaterThan(0);
  expect(await marketCards.count()).toBeLessThanOrEqual(5);
  expect(await signalCards.count()).toBeLessThanOrEqual(5);
  await expect(page.locator('a[href*="/signals/"]')).toHaveCount(0);
  await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  await expect(page.locator('.signal-card-top h3').first()).toBeVisible();

  const marketPagination = page.getByRole('navigation', { name: 'Market Scan Rail pages' });
  if (await marketPagination.count()) {
    await expect(marketPagination).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next Market Scan Rail page' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Previous Market Scan Rail page' })).toHaveCount(1);
  }

  const signalPagination = page.getByRole('navigation', { name: 'Signal Board pages' });
  if (await signalPagination.count()) {
    await expect(signalPagination).toBeVisible();
    await expect(page.getByRole('button', { name: 'Next Signal Board page' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Previous Signal Board page' })).toHaveCount(1);
  }

  await page.screenshot({ path: testInfo.outputPath('arena-stage2.png'), fullPage: true });
});

test('admin auth gates migrated resolution and proof pages', async ({ page }) => {
  await page.goto('/admin', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/admin(?:-login|\/login)/);
  await expect(page.getByRole('heading', { level: 1, name: 'Admin Login' })).toBeVisible();
  await expect(page.getByLabel('Access Token')).toBeVisible();

  await loginToAdmin(page, 'wrong-token');
  await expect(page.getByRole('alert')).toHaveText('Invalid token');
  await expect(page).toHaveURL(/error=1/);

  await loginToAdmin(page, 'playwright-admin-token');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Operator surface staged.' })).toBeVisible();

  await page.goto('/admin/resolution', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Admin Resolution' })).toBeVisible();
  await expect(page.getByText('Resolution Demo Script')).toBeVisible();
  await expect(page.getByText('Demo/Admin Only').first()).toBeVisible();
  await expect(page.getByLabel('Admin Token')).toBeVisible();

  await page.goto('/admin/proof', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: 'Admin Proof' })).toBeVisible();
  await expect(page.getByText('Latest Receipt').first()).toBeVisible();
  await expect(page.getByText('Arc Readiness').first()).toBeVisible();
  await expect(page.getByText('Operator Health')).toBeVisible();
  await expect(page.getByText('Proof Smoke')).toBeVisible();
  await expect(page.getByLabel('Proof Secret')).toBeVisible();
  await expect(page.getByLabel('Signal ID')).toBeVisible();

  const resolution404 = await page.goto('/demo-resolution', { waitUntil: 'domcontentloaded' });
  expect(resolution404?.status()).toBe(404);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await expect(page.getByText('Resolution Demo Script')).toHaveCount(0);

  const proof404 = await page.goto('/proof', { waitUntil: 'domcontentloaded' });
  expect(proof404?.status()).toBe(404);
  await expect(page.getByText('This page could not be found.')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'Admin Proof' })).toHaveCount(0);
});
