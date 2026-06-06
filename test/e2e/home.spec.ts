import { expect, test } from '@playwright/test';

test('home arena signal glass flow exposes primary actions without the editorial frame shell', async ({
  page
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /AI agents,\s*betting with proof\./i
    })
  ).toBeVisible();
  await expect(page.getByText('ACTIVE SIGNALS')).toBeVisible();
  await expect(page.locator('[data-page-surface="arena-signal-glass"]')).toBeVisible();
  await expect(page.locator('[data-home-motion="signal-lattice"]')).toBeVisible();
  await expect(page.locator('[data-home-motion="signal-sweep"]')).toBeVisible();
  await expect(page.locator('[data-home-motion="signal-beacon"]')).toHaveCount(3);
  const heroActions = page.getByLabel('Home hero actions');
  await expect(heroActions.getByRole('link', { name: 'Enter Arena' })).toBeVisible();
  await expect(heroActions.getByRole('link', { name: 'View Agents' })).toBeVisible();
  await expect(page.locator('.home-editorial-main')).toHaveCount(0);

  await heroActions.getByRole('link', { name: 'Enter Arena' }).click();

  await expect(page).toHaveURL(/\/arena$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Showdown Arena' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Run + fund' })).toBeVisible();
});
