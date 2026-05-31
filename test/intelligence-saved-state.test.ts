import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import type { ArenaState } from '@/lib/persistence/store';
import type { AgentSignal, ParsedCryptoMarket } from '@/lib/polymarket/types';

const HASH_A = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const HASH_B = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;

async function createTempStorePath() {
  const dir = path.join(tmpdir(), `predictarena-saved-state-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'predictarena-store.json');
}

function createMarket(overrides: Partial<ParsedCryptoMarket> = {}): ParsedCryptoMarket {
  return {
    id: overrides.id ?? 'saved-btc-main',
    eventId: overrides.eventId ?? 'event-saved-btc-main',
    slug: overrides.slug ?? 'btc-above-110k-june-3-2026',
    question: overrides.question ?? 'Will BTC be above $110,000 on June 3, 2026?',
    source: overrides.source ?? 'live',
    endDate: overrides.endDate ?? overrides.expiresAt ?? '2026-06-03T12:00:00.000Z',
    yesPriceBps: overrides.yesPriceBps ?? 6200,
    noPriceBps: overrides.noPriceBps ?? 3800,
    liquidity: overrides.liquidity ?? 220000,
    volume: overrides.volume ?? 120000,
    active: overrides.active ?? true,
    closed: overrides.closed ?? false,
    clobTokenIds: overrides.clobTokenIds ?? ['token-btc-main'],
    url: overrides.url ?? 'https://polymarket.com/event/btc-above-110k-june-3-2026',
    rawPayload:
      overrides.rawPayload ?? {
        clobSpreadDiagnostic: {
          status: 'available',
          bestBidBps: 6100,
          bestAskBps: 6220,
          midpointBps: 6160,
          spreadBps: 120,
          liquidityUsd: 42000,
          reason: null
        },
        internalUrl: 'https://internal.example/rpc',
        requestHeaders: { authorization: 'secret' }
      },
    asset: overrides.asset ?? 'BTC',
    conditionType: overrides.conditionType ?? 'EXPIRY_ABOVE',
    thresholdUsd: overrides.thresholdUsd ?? 110000,
    expiresAt: overrides.expiresAt ?? '2026-06-03T12:00:00.000Z',
    yesMeaning:
      overrides.yesMeaning ?? 'YES means BTC closes above $110,000 at expiry.',
    parseConfidence: overrides.parseConfidence ?? 0.91,
    scoutScoreBps: overrides.scoutScoreBps ?? 8200
  };
}

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  const agentName = overrides.agentName ?? 'volatility';
  const marketId = overrides.marketId ?? 'saved-btc-main';

  return {
    id: overrides.id ?? `${marketId}:${agentName}`,
    runId: overrides.runId ?? `run:${marketId}`,
    marketId,
    marketQuestion:
      overrides.marketQuestion ?? 'Will BTC be above $110,000 on June 3, 2026?',
    marketUrl:
      overrides.marketUrl ?? 'https://polymarket.com/event/btc-above-110k-june-3-2026',
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
    source: overrides.source ?? 'live',
    resolution: overrides.resolution ?? null
  };
}

function createArenaState(): ArenaState {
  const btc = createMarket({
    id: 'saved-btc-main',
    expiresAt: '2026-05-31T16:00:00.000Z',
    endDate: '2026-05-31T16:00:00.000Z',
    source: 'live'
  });
  const eth = createMarket({
    id: 'saved-eth-main',
    eventId: 'event-saved-eth-main',
    slug: 'eth-above-4500-june-10-2026',
    question: 'Will ETH be above $4,500 on June 10, 2026?',
    asset: 'ETH',
    thresholdUsd: 4500,
    expiresAt: '2026-06-10T12:00:00.000Z',
    endDate: '2026-06-10T12:00:00.000Z',
    yesPriceBps: 5400,
    noPriceBps: 4600,
    liquidity: 540000,
    volume: 320000,
    source: 'live'
  });

  return {
    latestScan: {
      source: 'live',
      scannedAt: '2026-05-31T11:30:00.000Z',
      marketCount: 2
    },
    markets: [btc, eth],
    signals: [
      createSignal({
        marketId: 'saved-btc-main',
        createdAt: '2026-05-31T10:00:00.000Z',
        edgeBps: 1800,
        agentProbabilityBps: 8000,
        pYesBps: 8000,
        riskFlags: ['volatility_regime_high']
      }),
      createSignal({
        id: 'saved-btc-main:momentum',
        marketId: 'saved-btc-main',
        agentName: 'momentum',
        confidence: 'MEDIUM',
        edgeBps: 1200,
        agentProbabilityBps: 7400,
        pYesBps: 7400,
        riskFlags: ['momentum_upside']
      }),
      createSignal({
        id: 'saved-eth-main:volatility',
        marketId: 'saved-eth-main',
        marketQuestion: eth.question,
        marketUrl: eth.url,
        asset: 'ETH',
        thresholdUsd: 4500,
        expiresAt: eth.expiresAt,
        createdAt: '2026-05-31T10:10:00.000Z',
        edgeBps: 2600,
        marketPriceBps: 5400,
        yesPriceBps: 5400,
        agentProbabilityBps: 8200,
        pYesBps: 8200,
        riskFlags: ['spread_diagnostics_missing']
      })
    ],
    autonomyRuns: []
  };
}

async function loadSavedStateModule() {
  try {
    return await import('@/lib/intelligence/savedState');
  } catch {
    return null;
  }
}

describe('saved intelligence state', () => {
  it('validates workspace ids and saved-filter thresholds with bounded schemas', async () => {
    const savedState = await loadSavedStateModule();

    expect(savedState).not.toBeNull();
    if (!savedState) {
      return;
    }

    expect(savedState.workspaceIdSchema.safeParse(randomUUID()).success).toBe(true);
    expect(savedState.workspaceIdSchema.safeParse('not-a-uuid').success).toBe(false);

    expect(
      savedState.savedFilterThresholdsSchema.safeParse({
        minOpportunityScoreBps: 0,
        minDataHealthScoreBps: 10000,
        edgeChangeThresholdBps: 500,
        disagreementChangeThresholdBps: 500,
        dataHealthDropThresholdBps: 1500,
        nearExpiryHours: 24
      }).success
    ).toBe(true);

    expect(
      savedState.savedFilterThresholdsSchema.safeParse({
        minOpportunityScoreBps: -1,
        nearExpiryHours: 200
      }).success
    ).toBe(false);
  });

  it('stores saved intelligence in an isolated namespace and keeps legacy arena JSON readable', async () => {
    const savedState = await loadSavedStateModule();

    expect(savedState).not.toBeNull();
    if (!savedState) {
      return;
    }

    const storagePath = await createTempStorePath();
    const legacyState = createArenaState();
    await fs.writeFile(storagePath, JSON.stringify(legacyState, null, 2), 'utf8');

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const store = createLocalStore({ storagePath });
    const workspaceId = randomUUID();

    const initialWorkspace = await store.getSavedIntelligenceWorkspace(workspaceId);
    expect(initialWorkspace.savedFilters).toEqual([]);
    expect(initialWorkspace.watchlist).toEqual([]);
    expect(initialWorkspace.alerts).toEqual([]);
    expect(initialWorkspace.freshness).toBe('never_evaluated');

    await store.putSavedIntelligenceWorkspace(workspaceId, {
      ...savedState.createEmptySavedIntelligenceWorkspaceState(),
      savedFilters: [
        {
          id: 'filter-1',
          workspaceId,
          name: 'ETH priority',
          enabled: true,
          query: {
            asset: 'ETH',
            conditionType: 'all',
            confidence: 'all',
            source: 'all',
            sort: 'opportunity_desc',
            minEdgeBps: 0,
            maxExpiryDays: 21,
            minLiquidity: 0,
            minOpportunityScoreBps: 6000,
            minDataHealthScoreBps: 4000
          },
          thresholds: savedState.defaultSavedFilterThresholds,
          latestEvaluation: null,
          createdAt: '2026-05-31T11:40:00.000Z',
          updatedAt: '2026-05-31T11:40:00.000Z'
        }
      ]
    });

    const reloadedStore = createLocalStore({ storagePath });
    const persistedWorkspace = await reloadedStore.getSavedIntelligenceWorkspace(workspaceId);
    const persistedArena = await reloadedStore.getArenaState();
    const rawPersistedState = JSON.parse(await fs.readFile(storagePath, 'utf8')) as Record<
      string,
      unknown
    >;

    expect(persistedWorkspace.savedFilters).toHaveLength(1);
    expect(persistedArena.markets).toHaveLength(2);
    expect(persistedArena.signals).toHaveLength(3);
    expect(rawPersistedState.savedIntelligence).toEqual(
      expect.objectContaining({
        [workspaceId]: expect.any(Object)
      })
    );
  });

  it('does not resurrect deleted saved filters or watched markets during workspace merges', async () => {
    const savedState = await loadSavedStateModule();

    expect(savedState).not.toBeNull();
    if (!savedState) {
      return;
    }

    const storagePath = await createTempStorePath();
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const store = createLocalStore({ storagePath });
    const workspaceId = randomUUID();

    await store.putSavedIntelligenceWorkspace(workspaceId, {
      ...savedState.createEmptySavedIntelligenceWorkspaceState(),
      savedFilters: [
        {
          id: 'filter-delete-me',
          workspaceId,
          name: 'Delete me',
          enabled: true,
          query: {
            asset: 'ETH',
            conditionType: 'all',
            confidence: 'all',
            source: 'all',
            sort: 'opportunity_desc',
            minEdgeBps: 0,
            maxExpiryDays: 21,
            minLiquidity: 0,
            minOpportunityScoreBps: 0,
            minDataHealthScoreBps: 0
          },
          thresholds: savedState.defaultSavedFilterThresholds,
          latestEvaluation: null,
          createdAt: '2026-05-31T11:40:00.000Z',
          updatedAt: '2026-05-31T11:40:00.000Z'
        }
      ],
      watchlist: [
        {
          id: 'watch-delete-me',
          workspaceId,
          marketId: 'saved-btc-main',
          asset: 'BTC',
          question: 'Will BTC be above $110,000 on June 3, 2026?',
          conditionType: 'EXPIRY_ABOVE',
          source: 'live',
          marketUrl: 'https://polymarket.com/event/btc-above-110k-june-3-2026',
          expiresAt: '2026-06-03T12:00:00.000Z',
          label: 'Delete this watch',
          note: null,
          supportStatus: 'supported',
          degradedReason: null,
          latestSnapshot: null,
          createdAt: '2026-05-31T11:45:00.000Z',
          updatedAt: '2026-05-31T11:45:00.000Z'
        }
      ]
    });

    const workspaceBeforeDelete = await store.getSavedIntelligenceWorkspace(workspaceId);
    const deletedWorkspace = await store.putSavedIntelligenceWorkspace(workspaceId, {
      ...workspaceBeforeDelete,
      savedFilters: [],
      watchlist: []
    });

    expect(deletedWorkspace.savedFilters).toEqual([]);
    expect(deletedWorkspace.watchlist).toEqual([]);

    const reloadedWorkspace = await store.getSavedIntelligenceWorkspace(workspaceId);
    expect(reloadedWorkspace.savedFilters).toEqual([]);
    expect(reloadedWorkspace.watchlist).toEqual([]);
  });

  it('evaluates saved intelligence, suppresses duplicate alerts, and builds a deterministic queue', async () => {
    const savedState = await loadSavedStateModule();

    expect(savedState).not.toBeNull();
    if (!savedState) {
      return;
    }

    const workspaceId = randomUUID();
    const state = createArenaState();
    const now = '2026-05-31T10:45:00.000Z';
    const baseWorkspace = {
      ...savedState.createEmptySavedIntelligenceWorkspaceState(),
      savedFilters: [
        {
          id: 'filter-eth',
          workspaceId,
          name: 'ETH Research',
          enabled: true,
          query: {
            asset: 'ETH',
            conditionType: 'all',
            confidence: 'all',
            source: 'all',
            sort: 'opportunity_desc',
            minEdgeBps: 0,
            maxExpiryDays: 21,
            minLiquidity: 0,
            minOpportunityScoreBps: 5000,
            minDataHealthScoreBps: 4000
          },
          thresholds: {
            ...savedState.defaultSavedFilterThresholds,
            edgeChangeThresholdBps: 500,
            disagreementChangeThresholdBps: 500,
            dataHealthDropThresholdBps: 1500,
            nearExpiryHours: 24
          },
          latestEvaluation: {
            matchedCount: 1,
            topMarketIds: ['saved-btc-main'],
            topOpportunityScoreBps: 5000,
            topEdgeBps: 400,
            topDataHealthScoreBps: 9000,
            topProbabilityGapBps: 200,
            evaluatedAt: '2026-05-30T12:00:00.000Z',
            freshness: 'fresh',
            failureReason: null
          },
          createdAt: '2026-05-30T12:00:00.000Z',
          updatedAt: '2026-05-30T12:00:00.000Z'
        }
      ],
      watchlist: [
        {
          id: 'watch-btc',
          workspaceId,
          marketId: 'saved-btc-main',
          asset: 'BTC',
          question: 'Will BTC be above $110,000 on June 3, 2026?',
          conditionType: 'EXPIRY_ABOVE',
          source: 'live',
          marketUrl: 'https://polymarket.com/event/btc-above-110k-june-3-2026',
          expiresAt: '2026-05-31T16:00:00.000Z',
          label: 'Near expiry BTC',
          note: null,
          supportStatus: 'supported',
          degradedReason: null,
          latestSnapshot: {
            marketId: 'saved-btc-main',
            opportunityScoreBps: 5000,
            edgeBps: 400,
            probabilityGapBps: 200,
            dataHealthScoreBps: 8200,
            timeToExpiryHours: 12,
            freshnessStatus: 'fresh',
            evaluatedAt: '2026-05-30T12:00:00.000Z'
          },
          createdAt: '2026-05-30T12:00:00.000Z',
          updatedAt: '2026-05-30T12:00:00.000Z'
        }
      ]
    };

    const firstRun = savedState.evaluateSavedIntelligenceWorkspace({
      workspaceId,
      arenaState: state,
      workspaceState: baseWorkspace,
      now
    });

    expect(firstRun.result.freshness).toBe('fresh');
    expect(firstRun.result.createdAlertCount).toBeGreaterThan(0);
    expect(firstRun.result.updatedSnapshotCount).toBe(2);
    expect(firstRun.workspaceState.alerts.map((alert: { reasonCode: string }) => alert.reasonCode)).toEqual(
      expect.arrayContaining([
        'new_high_priority_market',
        'edge_changed',
        'agent_disagreement_changed',
        'near_expiry'
      ])
    );

    const secondRun = savedState.evaluateSavedIntelligenceWorkspace({
      workspaceId,
      arenaState: state,
      workspaceState: firstRun.workspaceState,
      now
    });

    expect(secondRun.result.createdAlertCount).toBe(0);
    expect(secondRun.result.suppressedDuplicateCount).toBeGreaterThan(0);

    const firstQueue = savedState.buildDailyResearchQueue({
      workspaceId,
      arenaState: state,
      workspaceState: secondRun.workspaceState,
      now
    });
    const secondQueue = savedState.buildDailyResearchQueue({
      workspaceId,
      arenaState: state,
      workspaceState: secondRun.workspaceState,
      now
    });

    expect(firstQueue).toEqual(secondQueue);
    expect(firstQueue[0]).toEqual(
      expect.objectContaining({
        marketId: 'saved-btc-main',
        severity: 'urgent'
      })
    );
  });
});
