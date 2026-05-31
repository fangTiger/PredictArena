import { expect, test, type Page } from '@playwright/test';
import { createLocalStore } from '../../lib/persistence/localStore';
import type { SavedIntelligenceWorkspaceState } from '../../lib/intelligence/savedState';
import type { ArenaState } from '../../lib/persistence/store';
import type { AgentSignal, ParsedCryptoMarket } from '../../lib/polymarket/types';

const PLAYWRIGHT_STORE_PATH = '/tmp/predictarena-playwright-store.json';
const WORKSPACE_STORAGE_KEY = 'predictarena:intelligence-workspace-id';
const SEEDED_STALE_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH_A = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const HASH_B = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;
const TX_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

function market(overrides: Partial<ParsedCryptoMarket> = {}): ParsedCryptoMarket {
  return {
    id: overrides.id ?? 'miw-btc',
    eventId: overrides.eventId ?? 'event-miw-btc',
    slug: overrides.slug ?? 'btc-above-110k-june-2026',
    question: overrides.question ?? 'Will BTC be above $110,000 on June 3, 2026?',
    source: overrides.source ?? 'demo_snapshot',
    endDate: overrides.endDate ?? overrides.expiresAt ?? '2026-06-03T12:00:00.000Z',
    yesPriceBps: overrides.yesPriceBps ?? 6200,
    noPriceBps: overrides.noPriceBps ?? 3800,
    liquidity: overrides.liquidity ?? 240000,
    volume: overrides.volume ?? 150000,
    active: overrides.active ?? true,
    closed: overrides.closed ?? false,
    clobTokenIds: overrides.clobTokenIds ?? ['token-miw-btc'],
    url: overrides.url ?? 'https://polymarket.com/event/btc-above-110k-june-2026',
    rawPayload:
      overrides.rawPayload ?? {
        clobSpreadDiagnostic: {
          status: 'available',
          bestBidBps: 6120,
          bestAskBps: 6240,
          midpointBps: 6180,
          spreadBps: 120,
          liquidityUsd: 42000,
          reason: null
        }
      },
    asset: overrides.asset ?? 'BTC',
    conditionType: overrides.conditionType ?? 'EXPIRY_ABOVE',
    thresholdUsd: overrides.thresholdUsd ?? 110000,
    expiresAt: overrides.expiresAt ?? '2026-06-03T12:00:00.000Z',
    yesMeaning: overrides.yesMeaning ?? 'YES means the asset settles above the threshold.',
    parseConfidence: overrides.parseConfidence ?? 0.91,
    scoutScoreBps: overrides.scoutScoreBps ?? 8200
  };
}

function signal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  const agentName = overrides.agentName ?? 'volatility';
  const marketId = overrides.marketId ?? 'miw-btc';

  return {
    id: overrides.id ?? `${marketId}:${agentName}`,
    runId: overrides.runId ?? `run:${marketId}`,
    marketId,
    marketQuestion:
      overrides.marketQuestion ?? 'Will BTC be above $110,000 on June 3, 2026?',
    marketUrl: overrides.marketUrl ?? 'https://polymarket.com/event/btc-above-110k-june-2026',
    asset: overrides.asset ?? 'BTC',
    conditionType: overrides.conditionType ?? 'EXPIRY_ABOVE',
    thresholdUsd: overrides.thresholdUsd ?? 110000,
    expiresAt: overrides.expiresAt ?? '2026-06-03T12:00:00.000Z',
    agentName,
    modelVersion:
      overrides.modelVersion ??
      (agentName === 'volatility' ? 'volatility-gbm-v1' : 'momentum-gbm-v1'),
    modelParams: overrides.modelParams ?? {
      sigma: 1.2,
      recentReturn7d: 0.12,
      thresholdUsd: overrides.thresholdUsd ?? 110000
    },
    modelHash: overrides.modelHash ?? HASH_A,
    dataHash: overrides.dataHash ?? HASH_B,
    side: overrides.side ?? 'YES',
    status: overrides.status ?? 'generated',
    confidence: overrides.confidence ?? 'HIGH',
    confidenceBps: overrides.confidenceBps ?? 7600,
    marketPriceBps: overrides.marketPriceBps ?? 6200,
    agentProbabilityBps: overrides.agentProbabilityBps ?? 8000,
    yesPriceBps: overrides.yesPriceBps ?? 6200,
    pYesBps: overrides.pYesBps ?? 8000,
    edgeBps: overrides.edgeBps ?? 1800,
    kellyBps: overrides.kellyBps ?? 300,
    stakeMicroUsdc: overrides.stakeMicroUsdc ?? 50000,
    riskFlags: overrides.riskFlags ?? ['volatility_regime_high'],
    arcTxHash: overrides.arcTxHash ?? null,
    arcSignalRecordId: overrides.arcSignalRecordId,
    createdAt: overrides.createdAt ?? '2026-05-31T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? '2026-05-31T10:00:00.000Z',
    source: overrides.source ?? 'demo_snapshot',
    resolution: overrides.resolution ?? null
  };
}

async function seedIntelligenceState() {
  const btc = market();
  const eth = market({
    id: 'miw-eth',
    eventId: 'event-miw-eth',
    slug: 'eth-above-4500-june-2026',
    question: 'Will ETH be above $4,500 on June 10, 2026?',
    asset: 'ETH',
    thresholdUsd: 4500,
    expiresAt: '2026-06-10T12:00:00.000Z',
    endDate: '2026-06-10T12:00:00.000Z',
    yesPriceBps: 5400,
    noPriceBps: 4600,
    liquidity: 520000,
    volume: 310000,
    source: 'live',
    rawPayload: {
      clobSpreadDiagnostic: {
        status: 'degraded',
        spreadBps: null,
        reason: 'spread_unavailable'
      }
    }
  });

  const state: ArenaState = {
    latestScan: {
      source: 'demo_snapshot',
      scannedAt: '2026-05-31T10:30:00.000Z',
      marketCount: 2
    },
    markets: [btc, eth],
    signals: [
      signal({
        marketId: 'miw-btc',
        status: 'resolved_correct',
        arcTxHash: TX_A,
        resolution: {
          outcomeCorrect: true,
          yesOutcome: true,
          resolvedAt: '2026-05-31T11:00:00.000Z',
          source: 'automatic'
        }
      }),
      signal({
        id: 'miw-btc:momentum',
        marketId: 'miw-btc',
        agentName: 'momentum',
        confidence: 'MEDIUM',
        edgeBps: 900,
        agentProbabilityBps: 7100,
        pYesBps: 7100,
        riskFlags: ['momentum_upside']
      }),
      signal({
        id: 'miw-eth:volatility',
        marketId: 'miw-eth',
        marketQuestion: eth.question,
        marketUrl: eth.url,
        asset: 'ETH',
        thresholdUsd: 4500,
        expiresAt: eth.expiresAt,
        source: 'live',
        confidence: 'HIGH',
        edgeBps: 2100,
        marketPriceBps: 5400,
        yesPriceBps: 5400,
        agentProbabilityBps: 7500,
        pYesBps: 7500,
        riskFlags: ['spread_diagnostics_missing']
      })
    ],
    autonomyRuns: [
      {
        runId: 'miw-dry-run',
        status: 'completed',
        source: 'demo_snapshot',
        triggeredAt: '2026-05-31T10:35:00.000Z',
        completedAt: '2026-05-31T10:36:00.000Z',
        marketCount: 2,
        generatedSignalCount: 3,
        modeByAgent: {
          momentum: 'DRY_RUN',
          volatility: 'DRY_RUN'
        },
        queue: [
          {
            agentName: 'volatility',
            edgeBps: 2100,
            reason: null,
            signalId: 'miw-eth:volatility',
            stakeMicroUsdc: 50000,
            status: 'dry_run_eligible',
            txHash: null
          }
        ],
        committedCount: 0,
        dryRunCount: 1,
        skippedCount: 2
      }
    ]
  };

  const store = createLocalStore({ storagePath: PLAYWRIGHT_STORE_PATH });
  await store.replaceArenaState(state);
  await store.replaceSavedIntelligenceState({});
}

async function seedWorkspaceState(
  workspaceId: string,
  overrides: Partial<SavedIntelligenceWorkspaceState>
) {
  const store = createLocalStore({ storagePath: PLAYWRIGHT_STORE_PATH });
  const workspaceState: SavedIntelligenceWorkspaceState = {
    savedFilters: [],
    watchlist: [],
    alerts: [],
    freshness: 'never_evaluated',
    lastEvaluatedAt: null,
    lastSuccessfulEvaluatedAt: null,
    failureReason: null,
    ...overrides
  };

  await store.putSavedIntelligenceWorkspace(workspaceId, workspaceState);
}

async function expectNoForbiddenControls(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await expect(page.locator('textarea')).toHaveCount(0);
  await expect(page.getByPlaceholder(/manual evidence|evidence|news/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /create market|manual market/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /manual evidence/i })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /\b(trade|order|commit|send transaction)\b/i })
  ).toHaveCount(0);
}

test.beforeEach(async () => {
  await seedIntelligenceState();
});

test('intelligence workspace supports saved intelligence without transaction controls', async ({
  page
}) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.removeItem(storageKey);
  }, WORKSPACE_STORAGE_KEY);
  await page.goto('/');
  await expect(page).toHaveURL(/\/intelligence$/);

  await expect
    .poll(() => page.evaluate((storageKey) => window.localStorage.getItem(storageKey), WORKSPACE_STORAGE_KEY))
    .toMatch(UUID_PATTERN);

  await expect(page.getByRole('heading', { name: /PredictArena Intelligence/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Saved Intelligence/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Market Radar' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Signal Research' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Agent Segments' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Paper-Follow/i })).toBeVisible();
  await expect(page.getByText('Research-only')).toBeVisible();
  await expect(page.getByText('No financial advice')).toBeVisible();
  await expect(page.getByText('No transaction sent')).toBeVisible();
  await expect(page.getByLabel('Min resolved', { exact: true })).toHaveValue('3');
  await expect(
    page.getByLabel('Selected market summary').getByText('Data health', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByLabel('Selected market summary').getByText('Risk', { exact: true })
  ).toBeVisible();
  await expect(page.getByText(/Saved on this device/i)).toBeVisible();
  await expect(page.getByText(/Local workspace/i)).toBeVisible();
  await expect(page.getByText(/clearing local storage can remove saved filters/i)).toBeVisible();

  await page.getByLabel('Asset', { exact: true }).selectOption('ETH');
  await page.getByLabel('Condition type', { exact: true }).selectOption('EXPIRY_ABOVE');
  await page.getByLabel('Min liquidity', { exact: true }).fill('100000');
  await page.getByLabel('Sort', { exact: true }).selectOption('edge_desc');
  await expect(page.getByRole('button', { name: /Research ETH/i })).toBeVisible();
  await page.getByRole('button', { name: /Research ETH/i }).click();
  await page.getByLabel('Saved filter name', { exact: true }).fill('ETH Focus');
  await page.getByRole('button', { name: /Save current filter/i }).click();
  await expect(page.getByRole('button', { name: /Apply saved filter ETH Focus/i })).toBeVisible();
  await page.getByRole('button', { name: /Disable saved filter ETH Focus/i }).click();
  await expect(page.getByRole('button', { name: /Enable saved filter ETH Focus/i })).toBeVisible();
  await page.getByRole('button', { name: /Enable saved filter ETH Focus/i }).click();
  await expect(page.getByRole('button', { name: /Disable saved filter ETH Focus/i })).toBeVisible();
  await page.getByRole('button', { name: /Watch market ETH/i }).click();
  await expect(page.getByText(/Watched markets/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Unwatch selected market/i })).toBeVisible();
  await expect(page.getByText(/ETH Focus/i)).toBeVisible();
  const evaluationResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes('/api/intelligence/alerts/evaluate') &&
      response.request().method() === 'POST'
  );
  await page.getByRole('button', { name: /Refresh saved intelligence/i }).click();
  const evaluationResponse = await evaluationResponsePromise;
  expect(evaluationResponse.ok()).toBeTruthy();
  const evaluationBody = (await evaluationResponse.json()) as { createdAlertCount: number };
  expect(evaluationBody.createdAlertCount).toBeGreaterThan(0);
  await expect(page.getByText(/Last evaluated/i)).toBeVisible();
  const alertCenter = page.locator('.intelligence-alert-card');
  const alertRows = alertCenter.locator('.intelligence-saved-list > div');
  await expect(alertCenter.getByText(/new high priority market/i).first()).toBeVisible({
    timeout: 10000
  });
  await expect(page.getByText(/Local workspace.*1 unread/i)).toBeVisible();
  await expect(alertCenter.getByText(/Reason/i).first()).toBeVisible();
  await expect(alertCenter.getByText(/Severity/i).first()).toBeVisible();
  await expect(alertCenter.getByText(/Created|Evaluated/i).first()).toBeVisible();
  await expect(alertCenter.getByText(/Opportunity/i).first()).toBeVisible();
  await expect(alertCenter.getByText(/Probability gap/i).first()).toBeVisible();
  await expect(alertCenter.getByText(/Data health/i).first()).toBeVisible();
  await expect(alertCenter.getByText(/Time to expiry|Expiry/i).first()).toBeVisible();
  await expect(alertCenter.getByRole('button', { name: /Open research for/i }).first()).toBeVisible();
  const alertCountBeforeDismiss = await alertRows.count();
  await page.getByRole('button', { name: /Mark alert read/i }).first().click();
  await expect(page.getByRole('button', { name: /Mark alert unread/i }).first()).toBeVisible();
  await page.getByRole('button', { name: /Dismiss alert/i }).first().click();
  await expect.poll(() => alertRows.count()).toBe(Math.max(alertCountBeforeDismiss - 1, 0));
  await expect(page.getByRole('heading', { name: /Daily Research Queue/i })).toBeVisible();
  const queueCard = page
    .locator('.intelligence-saved-card')
    .filter({ has: page.getByRole('heading', { name: /Daily Research Queue/i }) });
  await expect(queueCard.getByText(/Opportunity/i).first()).toBeVisible();
  await expect(queueCard.getByText(/Probability gap/i).first()).toBeVisible();
  await expect(queueCard.getByText(/Data health/i).first()).toBeVisible();
  await expect(queueCard.getByText(/Expiry|Time to expiry/i).first()).toBeVisible();
  await expect(queueCard.getByText(/Unread alerts/i).first()).toBeVisible();
  await expect(queueCard.getByText(/Reason/i).first()).toBeVisible();
  await expect(queueCard.getByText(/Freshness/i).first()).toBeVisible();
  await expect(queueCard.getByRole('button', { name: /Open research for ETH/i })).toBeVisible();
  await page.getByRole('button', { name: /Open research for ETH/i }).click();
  await expect(
    page.getByLabel('Selected market summary').getByText('Selected Market', { exact: true })
  ).toBeVisible();
  await expect(
    page.getByLabel('Selected market summary').getByText(/Will ETH be above/)
  ).toBeVisible();
  const researchPanel = page.locator('.intelligence-research-panel');
  await expect(page.getByText('Spread status')).toBeVisible();
  await expect(researchPanel.getByText('Probability gap')).toBeVisible();
  await expect(page.getByText('Comparable edge')).toBeVisible();
  await expect(page.getByText('Volatility drivers')).toBeVisible();
  await expect(page.getByText('Momentum drivers')).toBeVisible();
  await expect(page.getByText(/model 0x/i).first()).toBeVisible();
  await expect(page.getByText(/data 0x/i).first()).toBeVisible();

  await page.getByLabel('Agent segment', { exact: true }).selectOption('asset');
  await page.getByLabel('Segment confidence', { exact: true }).selectOption('HIGH');
  await expect(page.getByLabel('Agent segment', { exact: true })).toHaveValue('asset');
  await expect(page.getByText('Brier').first()).toBeVisible();
  await expect(page.getByText('Average edge').first()).toBeVisible();
  await expect(page.getByText('Bond / Refund / Slash').first()).toBeVisible();
  await expect(page.getByText(/\d+ committed/).first()).toBeVisible();

  await page.getByLabel('Paper agent', { exact: true }).selectOption('volatility');
  await page.getByLabel('Paper confidence', { exact: true }).selectOption('HIGH');
  await page.getByLabel('Paper asset', { exact: true }).selectOption('ETH');
  await page.getByLabel('Paper condition', { exact: true }).selectOption('EXPIRY_ABOVE');
  await page.getByLabel('Stake model', { exact: true }).selectOption('flat_1_usdc');
  await page.getByLabel('Paper min edge', { exact: true }).fill('1000');
  await page.getByLabel('Paper from', { exact: true }).fill('2026-05-30T00:00');
  await page.getByLabel('Paper to', { exact: true }).fill('2026-06-01T00:00');
  await expect(page.getByLabel('Paper from', { exact: true })).toHaveValue('2026-05-30T00:00');
  await expect(page.getByLabel('Paper to', { exact: true })).toHaveValue('2026-06-01T00:00');
  await expect(page.getByText('Assumptions', { exact: true })).toBeVisible();
  await expect(page.getByText('Brier score')).toBeVisible();
  await expect(page.getByText('Breakdown by asset')).toBeVisible();
  await expect(page.getByText('Breakdown by condition')).toBeVisible();

  await expectNoForbiddenControls(page);
});

test('intelligence workspace surfaces stale local workspace state', async ({ page }) => {
  await seedWorkspaceState(SEEDED_STALE_WORKSPACE_ID, {
    freshness: 'stale',
    lastEvaluatedAt: '2026-05-29T10:00:00.000Z',
    lastSuccessfulEvaluatedAt: '2026-05-29T10:00:00.000Z'
  });
  await page.addInitScript(
    ({ storageKey, workspaceId }) => {
      window.localStorage.setItem(storageKey, workspaceId);
    },
    {
      storageKey: WORKSPACE_STORAGE_KEY,
      workspaceId: SEEDED_STALE_WORKSPACE_ID
    }
  );

  await page.goto('/intelligence');
  await expect(page.getByText(/Saved on this device/i)).toBeVisible();
  await expect(page.getByText(/Local workspace/i)).toBeVisible();
  await expect(page.getByText('stale', { exact: true })).toBeVisible();
  await expect(page.getByText(/clearing local storage can remove saved filters/i)).toBeVisible();
  await expectNoForbiddenControls(page);
});
