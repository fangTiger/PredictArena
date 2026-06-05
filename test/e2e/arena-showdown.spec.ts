import { expect, test } from '@playwright/test';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createLocalShowdownStore } from '../../lib/persistence/showdownsLocal';
import type { ShowdownRecord } from '../../lib/persistence/store';

const PLAYWRIGHT_SHOWDOWN_PATH = '/tmp/predictarena-playwright-showdowns.json';

function hex(char: string, length: number): `0x${string}` {
  return `0x${char.repeat(length)}` as `0x${string}`;
}

async function resetShowdownStore() {
  await fs.mkdir(path.dirname(PLAYWRIGHT_SHOWDOWN_PATH), { recursive: true });
  await fs.writeFile(PLAYWRIGHT_SHOWDOWN_PATH, '[]', 'utf8');
}

function createShowdownRecord(): ShowdownRecord {
  const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  return {
    externalId: hex('9', 64),
    onchainId: 17,
    marketId: 'btc-july-close-above-110k',
    marketQuestion: 'Will BTC close above $110,000 by July 2026?',
    agentA: {
      address: hex('1', 40),
      name: 'volatility',
      side: 'YES',
      probabilityBps: 6_400,
      confidence: 'HIGH',
      thesis: 'Volatility expects a breakout continuation into the close.'
    },
    agentB: {
      address: hex('2', 40),
      name: 'momentum',
      side: 'NO',
      probabilityBps: 3_600,
      confidence: 'MEDIUM',
      thesis: 'Momentum expects the breakout to fade before expiry.'
    },
    bondPerSideMicroUsdc: 7_500_000,
    deadline,
    status: 'Open',
    openedAt: '2026-06-05T10:00:00.000Z',
    settledAt: null,
    openTxHash: hex('a', 64),
    settleTxHash: null,
    resolvedOutcome: null,
    resolvedPriceLabel: null
  };
}

test.beforeEach(async () => {
  process.env.SHOWDOWN_LOCAL_FILE = PLAYWRIGHT_SHOWDOWN_PATH;
  await resetShowdownStore();
  await createLocalShowdownStore().insert(createShowdownRecord());
});

test('arena renders seeded local showdowns through the isolated showdown store', async ({ page }) => {
  await page.goto('/arena');

  await expect(page.getByRole('heading', { level: 1, name: 'Showdown Arena' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Active Showdowns' })).toBeVisible();

  const showdownCard = page.getByTestId('showdown-card').filter({
    has: page.getByRole('heading', {
      level: 2,
      name: 'Will BTC close above $110,000 by July 2026?'
    })
  });

  await expect(showdownCard).toBeVisible();
  await expect(showdownCard.getByTestId('showdown-agent-a')).toContainText('Volatility');
  await expect(showdownCard.getByTestId('showdown-agent-b')).toContainText('Momentum');
  await expect(showdownCard.getByText('Bond per side')).toBeVisible();
  await expect(showdownCard.getByText('$7.50')).toBeVisible();
  await expect(showdownCard.getByText('Combined pot')).toBeVisible();
  await expect(showdownCard.getByText('$15.00')).toBeVisible();
  await expect(showdownCard.getByText('Deadline UTC')).toBeVisible();
  await expect(showdownCard.getByText('Open Tx')).toBeVisible();
  await expect(showdownCard.getByText('0xaaaaaa...aaaa')).toBeVisible();
});
