import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test('arena, signal detail, and leaderboard load without manual inputs', async ({ page }, testInfo) => {
  await page.goto('/arena');

  await expect(page.getByRole('heading', { name: 'PredictArena' })).toBeVisible();
  await expect(page.getByText('Arc Forecast Arena')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Autonomy Panel' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agent Control Room' })).toBeVisible();
  await expect(page.getByRole('img', { name: /probability radar/i })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Re-Scan Markets' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Agents' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Commit Eligible Signals' })).toBeVisible();
  await expect(page.getByText('Mode by Agent')).toBeVisible();
  await expect(page.getByText('Budget Utilization')).toBeVisible();
  await expect(page.getByText('Recent Autonomous Runs')).toBeVisible();
  await expect(page.getByText('Commit Availability')).toBeVisible();
  await expect(page.getByText('Wallet Readiness')).toBeVisible();
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

  const runAgentsButton = page.getByRole('button', { name: 'Run Agents' });
  await runAgentsButton.click();
  await expect(runAgentsButton).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Signal Board' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Commit Queue' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open Signal Detail' }).first()).toBeVisible();
  await expect(page.getByText('Agent Probability').first()).toBeVisible();
  await expect(page.getByText('Market Price').first()).toBeVisible();
  await expect(page.getByText('YES Price').first()).toBeVisible();
  await expect(page.getByText('Capped Kelly').first()).toBeVisible();
  await expect(page.getByText('Risk Flags').first()).toBeVisible();
  await expect(page.getByText('Status').first()).toBeVisible();
  await expect(page.getByText('Policy Decision').first()).toBeVisible();
  await expect(page.getByText('Approve State').first()).toBeVisible();
  await expect(page.getByText('Failure / Tx').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('arena-stage2.png'), fullPage: true });

  const receiptLink = page.getByRole('link').filter({ hasText: /\d{2}:\d{2}/ }).first();
  if (await receiptLink.count()) {
    await Promise.all([
      page.waitForURL(/\/autonomy\/runs\//),
      receiptLink.click()
    ]);
    await expect(page.getByRole('heading', { name: 'Run Receipt' })).toBeVisible();
    await expect(page.getByText('Receipt Metadata')).toBeVisible();
    await expect(page.getByText('Budget Snapshot')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Model Hash' })).toBeVisible();
    await page.goto('/arena');
  }

  await Promise.all([
    page.waitForURL(/\/signals\//),
    page.getByRole('link', { name: 'Open Signal Detail' }).first().click()
  ]);
  await expect(page.getByRole('heading', { name: 'Decision Trace' })).toBeVisible();
  await expect(page.getByText('Market Scout')).toBeVisible();
  await expect(page.getByText('Volatility Summary')).toBeVisible();
  await expect(page.getByText('Monte Carlo Probability')).toBeVisible();
  await expect(page.getByText('Momentum Drift')).toBeVisible();
  await expect(page.getByText('Risk Agent Timeline')).toBeVisible();
  await expect(page.getByText('Deterministic Payload')).toBeVisible();
  await expect(page.getByText('CLOB Diagnostics')).toBeVisible();
  await expect(page.getByText('Deterministic Thesis')).toBeVisible();
  await expect(page.getByText('Audit Trail')).toBeVisible();
  await expect(page.getByText('Model Params')).toBeVisible();
  await expect(page.getByText('Signal ID')).toBeVisible();
  await expect(page.getByText('Model Hash')).toBeVisible();
  await expect(page.getByText('Data Hash')).toBeVisible();
  const adminSettlementToggle = page.getByRole('button', { name: 'Admin / Demo Settlement' });
  await expect(adminSettlementToggle).toBeVisible();
  await adminSettlementToggle.click();
  await expect(page.getByLabel('Admin Token')).toBeVisible();
  await expect(page.getByLabel('Settlement Outcome')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit Demo Settlement' })).toBeVisible();
  await expect(page.locator('.page-hero')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('.detail-layout')).toBeVisible();

  await page.goto('/leaderboard');
  await expect(page.getByRole('heading', { name: 'Leaderboard' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Resolved' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Accuracy' })).toBeVisible();
  await expect(page.getByText('Open Signals')).toBeVisible();
  await expect(page.locator('.page-hero')).toHaveCSS('border-radius', '8px');
  await expect(page.locator('.leaderboard-table-shell')).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/agents\//),
    page.getByRole('link', { name: /Agent/ }).first().click()
  ]);
  await expect(page.getByText('Agent Reputation Profile')).toBeVisible();
  await expect(page.getByText('Reputation Metrics')).toBeVisible();
  await expect(page.getByText('Confidence Mix')).toBeVisible();

  await page.goto('/demo-resolution');
  await expect(page.getByRole('heading', { name: 'Resolution Demo Script', level: 1 })).toBeVisible();
  await expect(page.getByText('Demo/Admin Only').first()).toBeVisible();
  await expect(page.getByText('not an oracle').first()).toBeVisible();
  await expect(page.getByText('Generate Signals')).toBeVisible();
  await expect(page.getByText('Commit / Readiness')).toBeVisible();
  await expect(page.getByText('Leaderboard Sync')).toBeVisible();
  await expect(page.getByLabel('Admin Token')).toBeVisible();

  await page.goto('/proof', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Proof Pack', level: 1 })).toBeVisible();
  await expect(page.getByText('Latest Receipt').first()).toBeVisible();
  await expect(page.getByText('Arc Readiness').first()).toBeVisible();
  await expect(page.getByText('Latest Tx').first()).toBeVisible();
  await expect(page.getByText('Bonded USDC').first()).toBeVisible();
  await expect(page.getByText('Top Reputation').first()).toBeVisible();
  await expect(page.getByText('Resolution Summary').first()).toBeVisible();
  await expect(page.getByText('Next Demo Action').first()).toBeVisible();
  await expect(page.getByText('Operator Health')).toBeVisible();
  await expect(page.getByText('Proof Smoke')).toBeVisible();
  await expect(page.getByText('Read-only Proof').first()).toBeVisible();
  await expect(page.getByText('Read-only safe').first()).toBeVisible();
  await expect(page.getByText('No transaction sent')).toBeVisible();
  await expect(page.getByText(/bounded/i).first()).toBeVisible();
  await expect(page.getByLabel('Proof Secret')).toBeVisible();
  await expect(page.getByLabel('Signal ID')).toBeVisible();
  await expect(page.locator('.proof-grid').first()).toHaveCSS('display', 'grid');
  await expect(page.locator('.page-hero')).toHaveCSS('border-radius', '8px');
});
