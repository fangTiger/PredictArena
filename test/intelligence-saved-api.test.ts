import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArenaState } from '@/lib/persistence/store';
import type { AgentSignal, ParsedCryptoMarket } from '@/lib/polymarket/types';

const HASH_A = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const HASH_B = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;

async function createTempStorePath() {
  const dir = path.join(tmpdir(), `predictarena-saved-api-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'predictarena-store.json');
}

function createMarket(overrides: Partial<ParsedCryptoMarket> = {}): ParsedCryptoMarket {
  return {
    id: overrides.id ?? 'api-btc-main',
    eventId: overrides.eventId ?? 'event-api-btc-main',
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
  const marketId = overrides.marketId ?? 'api-btc-main';

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
    id: 'api-btc-main',
    expiresAt: '2026-05-31T16:00:00.000Z',
    endDate: '2026-05-31T16:00:00.000Z',
    source: 'live'
  });
  const eth = createMarket({
    id: 'api-eth-main',
    eventId: 'event-api-eth-main',
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
        marketId: 'api-btc-main',
        createdAt: '2026-05-31T10:00:00.000Z',
        edgeBps: 1800,
        agentProbabilityBps: 8000,
        pYesBps: 8000,
        riskFlags: ['volatility_regime_high']
      }),
      createSignal({
        id: 'api-btc-main:momentum',
        marketId: 'api-btc-main',
        agentName: 'momentum',
        confidence: 'MEDIUM',
        edgeBps: 1200,
        agentProbabilityBps: 7400,
        pYesBps: 7400,
        riskFlags: ['momentum_upside']
      }),
      createSignal({
        id: 'api-eth-main:volatility',
        marketId: 'api-eth-main',
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

async function loadRouteModule(modulePath: string) {
  try {
    return await import(modulePath);
  } catch {
    return null;
  }
}

async function responseJson(response: Response) {
  return response.json() as Promise<Record<string, unknown>>;
}

async function seedStore() {
  const { createLocalStore } = await import('@/lib/persistence/localStore');
  const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
  const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });
  await store.replaceArenaState(createArenaState());
  setRuntimeStoreForTests(store);
  return store;
}

describe('saved intelligence API', () => {
  beforeEach(async () => {
    vi.stubEnv('PREDICTARENA_LOCAL_STORE_PATH', await createTempStorePath());
  });

  afterEach(async () => {
    const { resetRuntimeStoreForTests } = await import('@/lib/persistence/store');
    resetRuntimeStoreForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('rejects invalid workspace ids and invalid filter thresholds with invalid_request', async () => {
    const workspaceRoute = await loadRouteModule('@/app/api/intelligence/workspace/route');
    const savedFiltersRoute = await loadRouteModule('@/app/api/intelligence/saved-filters/route');

    expect(workspaceRoute).not.toBeNull();
    expect(savedFiltersRoute).not.toBeNull();
    if (!workspaceRoute || !savedFiltersRoute) {
      return;
    }

    await seedStore();

    const invalidWorkspaceResponse = await workspaceRoute.GET(
      new Request('http://localhost/api/intelligence/workspace?workspaceId=bad-id')
    );
    expect(invalidWorkspaceResponse.status).toBe(400);
    expect(await responseJson(invalidWorkspaceResponse)).toEqual(
      expect.objectContaining({
        reason: 'invalid_request'
      })
    );

    const invalidFilterResponse = await savedFiltersRoute.POST(
      new Request('http://localhost/api/intelligence/saved-filters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId: randomUUID(),
          name: 'Bad thresholds',
          query: {
            asset: 'ETH',
            conditionType: 'all',
            confidence: 'all',
            source: 'all',
            sort: 'opportunity_desc',
            minEdgeBps: 0,
            maxExpiryDays: 21,
            minLiquidity: 0
          },
          thresholds: {
            edgeChangeThresholdBps: 50
          }
        })
      })
    );

    expect(invalidFilterResponse.status).toBe(400);
    expect(await responseJson(invalidFilterResponse)).toEqual(
      expect.objectContaining({
        reason: 'invalid_request'
      })
    );
  });

  it('creates filters, handles duplicate watches, evaluates alerts, and hides cross-workspace resources', async () => {
    const savedFiltersRoute = await loadRouteModule('@/app/api/intelligence/saved-filters/route');
    const savedFilterItemRoute = await loadRouteModule(
      '@/app/api/intelligence/saved-filters/[filterId]/route'
    );
    const watchlistRoute = await loadRouteModule('@/app/api/intelligence/watchlist/route');
    const alertsRoute = await loadRouteModule('@/app/api/intelligence/alerts/route');
    const evaluateRoute = await loadRouteModule('@/app/api/intelligence/alerts/evaluate/route');
    const alertItemRoute = await loadRouteModule('@/app/api/intelligence/alerts/[alertId]/route');
    const queueRoute = await loadRouteModule('@/app/api/intelligence/daily-queue/route');

    expect(savedFiltersRoute).not.toBeNull();
    expect(savedFilterItemRoute).not.toBeNull();
    expect(watchlistRoute).not.toBeNull();
    expect(alertsRoute).not.toBeNull();
    expect(evaluateRoute).not.toBeNull();
    expect(alertItemRoute).not.toBeNull();
    expect(queueRoute).not.toBeNull();
    if (
      !savedFiltersRoute ||
      !savedFilterItemRoute ||
      !watchlistRoute ||
      !alertsRoute ||
      !evaluateRoute ||
      !alertItemRoute ||
      !queueRoute
    ) {
      return;
    }

    const workspaceId = randomUUID();
    const otherWorkspaceId = randomUUID();
    const store = await seedStore();
    const operationsBefore = await store.getOperationsState();

    const createFilterResponse = await savedFiltersRoute.POST(
      new Request('http://localhost/api/intelligence/saved-filters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          name: 'ETH Focus',
          query: {
            asset: 'ETH',
            conditionType: 'all',
            confidence: 'all',
            source: 'all',
            sort: 'opportunity_desc',
            minEdgeBps: 0,
            maxExpiryDays: 21,
            minLiquidity: 0
          }
        })
      })
    );
    expect(createFilterResponse.status).toBe(201);
    const createdFilterPayload = await responseJson(createFilterResponse);
    expect(createdFilterPayload.savedFilter).toEqual(
      expect.objectContaining({
        workspaceId,
        enabled: true,
        thresholds: expect.objectContaining({
          edgeChangeThresholdBps: 500,
          nearExpiryHours: 24
        })
      })
    );

    const createWatchResponse = await watchlistRoute.POST(
      new Request('http://localhost/api/intelligence/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          marketId: 'api-btc-main',
          label: 'Near expiry BTC'
        })
      })
    );
    expect(createWatchResponse.status).toBe(201);
    const createdWatch = await responseJson(createWatchResponse);
    expect(createdWatch.watch).toEqual(
      expect.objectContaining({
        marketId: 'api-btc-main'
      })
    );

    const duplicateWatchResponse = await watchlistRoute.POST(
      new Request('http://localhost/api/intelligence/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          marketId: 'api-btc-main',
          label: 'Near expiry BTC'
        })
      })
    );
    expect(duplicateWatchResponse.status).toBe(200);
    expect(await responseJson(duplicateWatchResponse)).toEqual(
      expect.objectContaining({
        duplicate: true,
        watch: expect.objectContaining({
          id: createdWatch.watch?.id
        })
      })
    );

    const evaluationResponse = await evaluateRoute.POST(
      new Request('http://localhost/api/intelligence/alerts/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      })
    );
    expect(evaluationResponse.status).toBe(200);
    const evaluationPayload = await responseJson(evaluationResponse);
    expect(evaluationPayload).toEqual(
      expect.objectContaining({
        workspaceId,
        freshness: 'stale',
        evaluatedAt: expect.any(String),
        createdAlertCount: expect.any(Number),
        updatedSnapshotCount: 2
      })
    );

    const alertsListResponse = await alertsRoute.GET(
      new Request(`http://localhost/api/intelligence/alerts?workspaceId=${workspaceId}`)
    );
    expect(alertsListResponse.status).toBe(200);
    const alertsPayload = await responseJson(alertsListResponse);
    const alerts = alertsPayload.alerts as Array<Record<string, unknown>>;
    expect(alerts.length).toBeGreaterThan(0);
    expect(JSON.stringify(alertsPayload)).not.toContain('internal.example');
    expect(JSON.stringify(alertsPayload)).not.toContain('authorization');

    const firstAlertId = String(alerts[0]?.id);
    const patchAlertResponse = await alertItemRoute.PATCH(
      new Request(`http://localhost/api/intelligence/alerts/${firstAlertId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          state: 'dismissed'
        })
      }),
      { params: Promise.resolve({ alertId: firstAlertId }) }
    );
    expect(patchAlertResponse.status).toBe(200);
    expect(await responseJson(patchAlertResponse)).toEqual(
      expect.objectContaining({
        alert: expect.objectContaining({
          id: firstAlertId,
          dismissedAt: expect.any(String)
        })
      })
    );

    const queueResponse = await queueRoute.GET(
      new Request(`http://localhost/api/intelligence/daily-queue?workspaceId=${workspaceId}`)
    );
    const queuePayload = await responseJson(queueResponse);
    expect(queueResponse.status).toBe(200);
    expect(queuePayload.items).toEqual(expect.any(Array));
    expect(queuePayload.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          marketId: 'api-btc-main'
        })
      ])
    );

    const filterId = String((createdFilterPayload.savedFilter as Record<string, unknown>).id);
    const wrongWorkspaceDeleteResponse = await savedFilterItemRoute.DELETE(
      new Request(`http://localhost/api/intelligence/saved-filters/${filterId}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId: otherWorkspaceId
        })
      }),
      { params: Promise.resolve({ filterId }) }
    );
    expect(wrongWorkspaceDeleteResponse.status).toBe(404);
    expect(await responseJson(wrongWorkspaceDeleteResponse)).toEqual({
      reason: 'not_found'
    });

    const operationsAfter = await store.getOperationsState();
    expect(operationsAfter).toEqual(operationsBefore);
  });

  it('keeps deleted saved filters and watched markets removed after API writes', async () => {
    const savedFiltersRoute = await loadRouteModule('@/app/api/intelligence/saved-filters/route');
    const savedFilterItemRoute = await loadRouteModule(
      '@/app/api/intelligence/saved-filters/[filterId]/route'
    );
    const watchlistRoute = await loadRouteModule('@/app/api/intelligence/watchlist/route');
    const watchItemRoute = await loadRouteModule('@/app/api/intelligence/watchlist/[watchId]/route');
    const workspaceRoute = await loadRouteModule('@/app/api/intelligence/workspace/route');

    expect(savedFiltersRoute).not.toBeNull();
    expect(savedFilterItemRoute).not.toBeNull();
    expect(watchlistRoute).not.toBeNull();
    expect(watchItemRoute).not.toBeNull();
    expect(workspaceRoute).not.toBeNull();
    if (
      !savedFiltersRoute ||
      !savedFilterItemRoute ||
      !watchlistRoute ||
      !watchItemRoute ||
      !workspaceRoute
    ) {
      return;
    }

    const workspaceId = randomUUID();
    await seedStore();

    const createFilterResponse = await savedFiltersRoute.POST(
      new Request('http://localhost/api/intelligence/saved-filters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          name: 'Delete me',
          query: {
            asset: 'ETH',
            conditionType: 'all',
            confidence: 'all',
            source: 'all',
            sort: 'opportunity_desc',
            minEdgeBps: 0,
            maxExpiryDays: 21,
            minLiquidity: 0
          }
        })
      })
    );
    expect(createFilterResponse.status).toBe(201);
    const createFilterPayload = await responseJson(createFilterResponse);
    const filterId = String((createFilterPayload.savedFilter as Record<string, unknown>).id);

    const createWatchResponse = await watchlistRoute.POST(
      new Request('http://localhost/api/intelligence/watchlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          marketId: 'api-btc-main',
          label: 'Delete this watch'
        })
      })
    );
    expect(createWatchResponse.status).toBe(201);
    const createWatchPayload = await responseJson(createWatchResponse);
    const watchId = String((createWatchPayload.watch as Record<string, unknown>).id);

    const deleteFilterResponse = await savedFilterItemRoute.DELETE(
      new Request(`http://localhost/api/intelligence/saved-filters/${filterId}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      }),
      { params: Promise.resolve({ filterId }) }
    );
    expect(deleteFilterResponse.status).toBe(200);
    expect(await responseJson(deleteFilterResponse)).toEqual({
      deleted: true,
      filterId
    });

    const deleteWatchResponse = await watchItemRoute.DELETE(
      new Request(`http://localhost/api/intelligence/watchlist/${watchId}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      }),
      { params: Promise.resolve({ watchId }) }
    );
    expect(deleteWatchResponse.status).toBe(200);
    expect(await responseJson(deleteWatchResponse)).toEqual({
      deleted: true,
      watchId
    });

    const workspaceResponse = await workspaceRoute.GET(
      new Request(`http://localhost/api/intelligence/workspace?workspaceId=${workspaceId}`)
    );
    expect(workspaceResponse.status).toBe(200);
    expect(await responseJson(workspaceResponse)).toEqual(
      expect.objectContaining({
        workspaceId,
        savedFilters: [],
        watchlist: [],
        dailyQueuePreview: []
      })
    );
  });

  it('enforces saved-filter limits and returns sanitized failed freshness when evaluation breaks', async () => {
    const savedFiltersRoute = await loadRouteModule('@/app/api/intelligence/saved-filters/route');
    const evaluateRoute = await loadRouteModule('@/app/api/intelligence/alerts/evaluate/route');
    const workspaceRoute = await loadRouteModule('@/app/api/intelligence/workspace/route');

    expect(savedFiltersRoute).not.toBeNull();
    expect(evaluateRoute).not.toBeNull();
    expect(workspaceRoute).not.toBeNull();
    if (!savedFiltersRoute || !evaluateRoute || !workspaceRoute) {
      return;
    }

    const workspaceId = randomUUID();
    const realStore = await seedStore();

    for (let index = 0; index < 20; index += 1) {
      const response = await savedFiltersRoute.POST(
        new Request('http://localhost/api/intelligence/saved-filters', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            name: `Saved Filter ${index}`,
            query: {
              asset: index % 2 === 0 ? 'ETH' : 'BTC',
              conditionType: 'all',
              confidence: 'all',
              source: 'all',
              sort: 'opportunity_desc',
              minEdgeBps: 0,
              maxExpiryDays: 21,
              minLiquidity: 0
            }
          })
        })
      );

      expect(response.status).toBe(201);
    }

    const limitResponse = await savedFiltersRoute.POST(
      new Request('http://localhost/api/intelligence/saved-filters', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          name: 'Overflow Filter',
          query: {
            asset: 'ETH',
            conditionType: 'all',
            confidence: 'all',
            source: 'all',
            sort: 'opportunity_desc',
            minEdgeBps: 0,
            maxExpiryDays: 21,
            minLiquidity: 0
          }
        })
      })
    );
    expect(limitResponse.status).toBe(409);
    expect(await responseJson(limitResponse)).toEqual({
      reason: 'saved_intelligence_limit_reached',
      limit: 20
    });

    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    setRuntimeStoreForTests({
      ...realStore,
      async getArenaState() {
        throw new Error('rpc timeout https://internal.example with authorization secret');
      }
    });

    const failedEvaluationResponse = await evaluateRoute.POST(
      new Request('http://localhost/api/intelligence/alerts/evaluate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workspaceId })
      })
    );
    expect(failedEvaluationResponse.status).toBe(200);
    expect(await responseJson(failedEvaluationResponse)).toEqual(
      expect.objectContaining({
        freshness: 'failed',
        failureReason: 'evaluation_failed'
      })
    );

    setRuntimeStoreForTests(realStore);

    const workspaceResponse = await workspaceRoute.GET(
      new Request(`http://localhost/api/intelligence/workspace?workspaceId=${workspaceId}`)
    );
    expect(workspaceResponse.status).toBe(200);
    expect(await responseJson(workspaceResponse)).toEqual(
      expect.objectContaining({
        workspaceId,
        unreadAlertCount: expect.any(Number),
        freshness: expect.any(String),
        savedFilters: expect.any(Array),
        dailyQueuePreview: expect.any(Array)
      })
    );
  });
});
