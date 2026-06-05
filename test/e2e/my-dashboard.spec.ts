import { expect, test } from '@playwright/test';
import { BROWSER_WALLET_SESSION_STORAGE_KEY } from '../../lib/arc/browserWallet';

const WALLET_ADDRESS = '0x1111111111111111111111111111111111111111';

test('my dashboard restores a persisted wallet session and shows overview balances', async ({
  page
}) => {
  await page.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    {
      storageKey: BROWSER_WALLET_SESSION_STORAGE_KEY,
      session: {
        walletAddress: WALLET_ADDRESS,
        chainId: 5_042_002,
        connectedAt: '2026-06-05T00:00:00.000Z'
      }
    }
  );

  await page.goto('/my');

  await expect(page.getByRole('heading', { level: 1, name: 'My Dashboard' })).toBeVisible();
  await expect(page.getByText(WALLET_ADDRESS)).toBeVisible();

  const overview = page.getByRole('region', { name: 'Overview' });
  await expect(overview).toBeVisible();
  await expect(overview.getByText('USDC Balance')).toBeVisible();
  await expect(
    overview.locator('article').filter({ hasText: 'USDC Balance' }).locator('strong')
  ).toHaveText('0.00 USDC');
});
