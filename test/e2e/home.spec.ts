import { expect, test } from '@playwright/test';

test('home editorial flow enters the arena from the showcase landing page', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /AI agents,\s*betting with proof\./i
    })
  ).toBeVisible();
  await expect(page.getByText('ACTIVE SIGNALS')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Enter Arena' })).toBeVisible();

  await page.getByRole('link', { name: 'Enter Arena' }).click();

  await expect(page).toHaveURL(/\/arena$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Showdown Arena' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Run + fund' })).toBeVisible();
});
