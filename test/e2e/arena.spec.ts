import { expect, test } from '@playwright/test';

test('dashboard auto-scans, runs agents, and omits manual market inputs', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'PredictArena' })).toBeVisible();
  await expect(page.getByText('Autonomous Agent Arena')).toBeVisible();
  await expect(page.getByPlaceholder(/question/i)).toHaveCount(0);
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Create Market' })).toHaveCount(0);

  await expect(page.getByText(/^Source:\s+(demo snapshot|live)$/i)).toBeVisible();
  await page.getByRole('button', { name: 'Run Agents' }).click();

  await expect(page.getByRole('heading', { name: 'Signal Board' })).toBeVisible();
  const decisions = page.locator('.decision').filter({ hasText: /BUY_YES|BUY_NO|AVOID/ });
  await expect(decisions).not.toHaveCount(0);
  await expect(decisions.first()).toBeVisible();
});
