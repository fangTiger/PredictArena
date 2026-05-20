import { expect, test } from '@playwright/test';

test('arena, signal detail, and leaderboard load without manual inputs', async ({ page }, testInfo) => {
  await page.goto('/arena');

  await expect(page.getByRole('heading', { name: 'PredictArena' })).toBeVisible();
  await expect(page.getByText('Arc Forecast Arena')).toBeVisible();
  await expect(page.getByRole('img', { name: /probability radar/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-Scan Markets' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Agents' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit Eligible Signals' })).toBeVisible();
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

  const runAgentsButton = page.getByRole('button', { name: 'Run Agents' });
  await runAgentsButton.click();
  await expect(runAgentsButton).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Signal Board' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Signal Detail' }).first()).toBeVisible();
  await expect(page.getByText('Agent Probability').first()).toBeVisible();
  await expect(page.getByText('Market Price').first()).toBeVisible();
  await expect(page.getByText('YES Price').first()).toBeVisible();
  await expect(page.getByText('Capped Kelly').first()).toBeVisible();
  await expect(page.getByText('Risk Flags').first()).toBeVisible();
  await expect(page.getByText('Status').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('arena-stage2.png'), fullPage: true });

  await Promise.all([
    page.waitForURL(/\/signals\//),
    page.getByRole('link', { name: 'Open Signal Detail' }).first().click()
  ]);
  await expect(page.getByText('Deterministic Thesis')).toBeVisible();
  await expect(page.getByText('Audit Trail')).toBeVisible();
  await expect(page.getByText('Model Params')).toBeVisible();
  await expect(page.getByText('Signal ID')).toBeVisible();
  await expect(page.getByText('Model Hash')).toBeVisible();
  await expect(page.getByText('Data Hash')).toBeVisible();
  await expect(page.locator('.page-hero')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('.detail-layout')).toBeVisible();

  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Resolved' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Accuracy' })).toBeVisible();
  await expect(page.locator('.page-hero')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('.leaderboard-table-shell')).toBeVisible();
});
