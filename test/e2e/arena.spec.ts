import { expect, test } from '@playwright/test';
import { createLocalStore } from '../../lib/persistence/localStore';
import type { AgentSignal } from '../../lib/polymarket/types';

test.setTimeout(60_000);

const PLAYWRIGHT_STORE_PATH = '/tmp/predictarena-playwright-store.json';
const ARC_EXPLORER_URL = 'https://testnet.arcscan.app';

function txHashFor(projectName: string, suffix: string): `0x${string}` {
  const seed = Buffer.from(`${projectName}:${suffix}`).toString('hex').padEnd(64, '0').slice(0, 64);

  return `0x${seed}`;
}

async function seedCommittedLifecycle(projectName: string): Promise<{
  agentName: AgentSignal['agentName'];
  commitTxHash: `0x${string}`;
  resolveTxHash: `0x${string}`;
  runId: string;
  signalId: string;
}> {
  const store = createLocalStore({ storagePath: PLAYWRIGHT_STORE_PATH });
  const state = await store.getArenaState();
  const signal = state.signals.find((entry) => !entry.arcTxHash && entry.side !== 'AVOID');

  if (!signal) {
    throw new Error('No uncommitted non-AVOID signal available for lifecycle seeding.');
  }

  const now = new Date().toISOString();
  const commitTxHash = txHashFor(projectName, 'commit');
  const resolveTxHash = txHashFor(projectName, 'resolve');
  const runId = `e2e-lifecycle:${projectName}:${Date.now()}`;
  await store.markSignalCommitted(signal.id, commitTxHash, 9001);
  await store.resolveSignal(signal.id, true, now, {
    observedAt: now,
    onchainTxHash: resolveTxHash,
    source: 'demo_admin'
  });
  await store.saveAutonomousRun({
    runId,
    idempotencyKey: runId,
    scheduleWindowId: runId,
    status: 'completed',
    source: state.latestScan?.source ?? 'demo_snapshot',
    triggeredAt: now,
    completedAt: now,
    marketCount: state.markets.length,
    generatedSignalCount: state.signals.length,
    modeByAgent: {
      momentum: 'LIVE',
      volatility: 'LIVE'
    },
    queue: [
      {
        agentName: signal.agentName,
        edgeBps: signal.edgeBps,
        reason: null,
        signalId: signal.id,
        stakeMicroUsdc: signal.stakeMicroUsdc,
        status: 'committed',
        txHash: commitTxHash
      }
    ],
    committedCount: 1,
    dryRunCount: 0,
    skippedCount: Math.max(state.signals.length - 1, 0),
    budgetSnapshots: [
      {
        agentName: signal.agentName,
        dailyBondUsedUsdc6: signal.stakeMicroUsdc,
        mode: 'LIVE',
        openSignals: 1,
        policy: {
          maxDailyBondUsdc6: 150_000,
          maxOpenSignals: 3,
          maxSignalsPerDay: 4,
          maxStakePerSignalUsdc6: 50_000,
          minEdgeBps: 900,
          mode: 'LIVE'
        },
        signalsUsedToday: 1
      }
    ]
  });

  return {
    agentName: signal.agentName,
    commitTxHash,
    resolveTxHash,
    runId,
    signalId: signal.id
  };
}

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
  await expect(page.getByLabel('Signal ID')).toHaveValue(/.+/);
  await expect(page.getByText('Auto-selected eligible signal')).toBeVisible();
  await page.evaluate(() => {
    sessionStorage.setItem('predictarena:proof-secret', 'playwright-proof-secret');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Proof Secret')).toHaveValue('playwright-proof-secret');
  await expect(page.getByText('Session unlocked')).toBeVisible();
  await page.getByRole('button', { name: 'Forget' }).click();
  await expect(page.getByLabel('Proof Secret')).toHaveValue('');
  await expect(page.locator('.proof-grid').first()).toHaveCSS('display', 'grid');
  await expect(page.locator('.page-hero')).toHaveCSS('border-radius', '8px');
});

test('agent lifecycle exposes Arc transaction links from commit to resolution', async ({
  page
}, testInfo) => {
  await page.goto('/arena');
  const runAgentsButton = page.getByRole('button', { name: 'Run Agents' });
  await runAgentsButton.click();
  await expect(runAgentsButton).toBeEnabled({ timeout: 30_000 });

  const lifecycle = await seedCommittedLifecycle(testInfo.project.name);
  const commitTxUrl = `${ARC_EXPLORER_URL}/tx/${lifecycle.commitTxHash}`;
  const resolveTxUrl = `${ARC_EXPLORER_URL}/tx/${lifecycle.resolveTxHash}`;

  await page.goto('/arena', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Commit Queue' })).toBeVisible();
  await expect(page.getByText(lifecycle.signalId).first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: new RegExp(`View transaction ${lifecycle.commitTxHash}`, 'i') }).first()
  ).toHaveAttribute('href', commitTxUrl);

  await page.goto(`/autonomy/runs/${encodeURIComponent(lifecycle.runId)}`, {
    waitUntil: 'domcontentloaded'
  });
  await expect(page.getByRole('heading', { name: 'Run Receipt' })).toBeVisible();
  await expect(page.getByText('approved + committed').or(page.getByText('committed')).first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: new RegExp(`View transaction ${lifecycle.commitTxHash}`, 'i') }).first()
  ).toHaveAttribute('href', commitTxUrl);

  await page.goto(`/signals/${encodeURIComponent(lifecycle.signalId)}`, {
    waitUntil: 'domcontentloaded'
  });
  await expect(page.getByRole('heading', { name: 'Decision Trace' })).toBeVisible();
  await expect(page.getByText('Resolution', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: new RegExp(`View transaction ${lifecycle.commitTxHash}`, 'i') }).first()
  ).toHaveAttribute('href', commitTxUrl);
  await expect(
    page.getByRole('link', { name: new RegExp(`View transaction ${lifecycle.resolveTxHash}`, 'i') }).first()
  ).toHaveAttribute('href', resolveTxUrl);

  await page.goto(`/agents/${lifecycle.agentName}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Agent Reputation Profile')).toBeVisible();
  await expect(page.getByText('Resolved', { exact: true }).first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: new RegExp(`View transaction ${lifecycle.commitTxHash}`, 'i') }).first()
  ).toHaveAttribute('href', commitTxUrl);

  await page.goto('/proof', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Proof Pack', level: 1 })).toBeVisible();
  await expect(page.getByText('Latest Tx').first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: new RegExp(`View transaction ${lifecycle.commitTxHash}`, 'i') }).first()
  ).toHaveAttribute('href', commitTxUrl);
});
