import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __setShowdownStoreForTests, type ShowdownStore } from '@/lib/persistence/showdowns';
import { createLocalStore } from '@/lib/persistence/localStore';
import { resetRuntimeStoreForTests, setRuntimeStoreForTests } from '@/lib/persistence/store';
import type { ShowdownRecord } from '@/lib/persistence/store';

const routeState = vi.hoisted(() => ({
  discoverResult: {
    discovered: 1,
    opened: 1,
    skips: []
  },
  discoveryDeps: { kind: 'discovery-deps' },
  settlementDeps: {
    resolveMarket: vi.fn(async () => ({
      outcomeYes: true,
      priceLabel: 'BTC settled at $102,431'
    })),
    settleOnChain: vi.fn(async () => `0x${'c'.repeat(64)}` as `0x${string}`),
    nowMs: vi.fn(() => Date.parse('2026-06-05T12:00:00.000Z'))
  },
  discoverShowdowns: vi.fn(async () => routeState.discoverResult),
  buildDefaultDiscoveryDeps: vi.fn(async () => routeState.discoveryDeps),
  buildDefaultSettlementDeps: vi.fn(async () => routeState.settlementDeps)
}));

vi.mock('@/lib/services/showdownDiscovery', () => ({
  discoverShowdowns: routeState.discoverShowdowns
}));

vi.mock('@/lib/services/showdownDiscoveryDefaults', () => ({
  buildDefaultDiscoveryDeps: routeState.buildDefaultDiscoveryDeps
}));

vi.mock('@/lib/services/showdownSettlementDefaults', () => ({
  buildDefaultSettlementDeps: routeState.buildDefaultSettlementDeps
}));

function createRecord(overrides: Partial<ShowdownRecord> = {}): ShowdownRecord {
  return {
    externalId: `0x${'a'.repeat(64)}`,
    onchainId: 7,
    marketId: 'market-btc-100k',
    marketQuestion: 'Will BTC close above $100,000?',
    agentA: {
      address: `0x${'1'.repeat(40)}`,
      name: 'volatility',
      side: 'YES',
      probabilityBps: 7200,
      confidence: 'HIGH',
      thesis: 'Volatility expects YES with a 72.00% model line.'
    },
    agentB: {
      address: `0x${'2'.repeat(40)}`,
      name: 'momentum',
      side: 'NO',
      probabilityBps: 3100,
      confidence: 'MEDIUM',
      thesis: 'Momentum expects NO with a 31.00% model line.'
    },
    bondPerSideMicroUsdc: 250_000_000,
    deadline: '2026-06-05T12:00:00.000Z',
    status: 'Open',
    openedAt: '2026-06-04T10:00:00.000Z',
    settledAt: null,
    openTxHash: `0x${'b'.repeat(64)}`,
    settleTxHash: null,
    resolvedOutcome: null,
    resolvedPriceLabel: null,
    ...overrides
  };
}

function createShowdownStore(overrides: Partial<ShowdownStore> = {}): ShowdownStore {
  return {
    insert: vi.fn(async () => undefined),
    updateOnSettle: vi.fn(async () => undefined),
    listAll: vi.fn(async () => []),
    findByOnchainId: vi.fn(async () => undefined),
    hasOpenBetween: vi.fn(async () => false),
    ...overrides
  };
}

describe('showdowns API routes', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-05T12:00:00.000Z'));
    delete process.env.ADMIN_ACCESS_TOKEN;
    delete process.env.ADMIN_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS;
    delete process.env.SHOWDOWN_BOND_MICRO_USDC;
    delete process.env.SHOWDOWN_DEADLINE_WINDOW_SEC;
    routeState.discoverResult = {
      discovered: 1,
      opened: 1,
      skips: []
    };
    routeState.discoveryDeps = { kind: 'discovery-deps' };
    routeState.settlementDeps.resolveMarket.mockReset();
    routeState.settlementDeps.resolveMarket.mockResolvedValue({
      outcomeYes: true,
      priceLabel: 'BTC settled at $102,431'
    });
    routeState.settlementDeps.settleOnChain.mockReset();
    routeState.settlementDeps.settleOnChain.mockResolvedValue(`0x${'c'.repeat(64)}`);
    routeState.settlementDeps.nowMs.mockReset();
    routeState.settlementDeps.nowMs.mockReturnValue(Date.parse('2026-06-05T12:00:00.000Z'));
    routeState.discoverShowdowns.mockClear();
    routeState.buildDefaultDiscoveryDeps.mockClear();
    routeState.buildDefaultSettlementDeps.mockClear();
    __setShowdownStoreForTests(null);
    resetRuntimeStoreForTests();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.ADMIN_ACCESS_TOKEN;
    delete process.env.ADMIN_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS;
    delete process.env.SHOWDOWN_BOND_MICRO_USDC;
    delete process.env.SHOWDOWN_DEADLINE_WINDOW_SEC;
    __setShowdownStoreForTests(null);
    resetRuntimeStoreForTests();
  });

  it('GET /api/showdowns filters active, resolving, settled, and serializes bond values as strings', async () => {
    __setShowdownStoreForTests(
      createShowdownStore({
        listAll: vi.fn(async () => [
          createRecord({
            onchainId: 1,
            openedAt: '2026-06-04T11:00:00.000Z',
            deadline: '2026-06-06T12:00:00.000Z',
            status: 'Open'
          }),
          createRecord({
            onchainId: 2,
            openedAt: '2026-06-04T12:00:00.000Z',
            deadline: '2026-06-05T11:59:59.000Z',
            status: 'Open'
          }),
          createRecord({
            onchainId: 3,
            openedAt: '2026-06-04T09:00:00.000Z',
            status: 'SettledB',
            settledAt: '2026-06-05T09:00:00.000Z',
            settleTxHash: `0x${'d'.repeat(64)}`,
            resolvedOutcome: 'NO',
            resolvedPriceLabel: 'BTC settled at $97,000'
          })
        ])
      })
    );
    const { GET } = await import('@/app/api/showdowns/route');

    const activeResponse = await GET(
      new Request('http://localhost/api/showdowns?status=active&limit=10')
    );
    const resolvingResponse = await GET(
      new Request('http://localhost/api/showdowns?status=resolving&limit=10')
    );
    const settledResponse = await GET(
      new Request('http://localhost/api/showdowns?status=settled&limit=10')
    );
    const allResponse = await GET(
      new Request('http://localhost/api/showdowns?status=all&limit=10')
    );

    const activePayload = await activeResponse.json();
    const resolvingPayload = await resolvingResponse.json();
    const settledPayload = await settledResponse.json();
    const allPayload = await allResponse.json();

    expect(activeResponse.status).toBe(200);
    expect(activePayload.showdowns).toHaveLength(1);
    expect(activePayload.showdowns[0]).toMatchObject({
      onchainId: 1,
      bondMicroUsdc: '250000000',
      agentA: {
        confidence: 'HIGH',
        thesis: 'Volatility expects YES with a 72.00% model line.'
      },
      agentB: {
        confidence: 'MEDIUM',
        thesis: 'Momentum expects NO with a 31.00% model line.'
      }
    });
    expect(resolvingPayload.showdowns).toHaveLength(1);
    expect(resolvingPayload.showdowns[0].onchainId).toBe(2);
    expect(settledPayload.showdowns).toHaveLength(1);
    expect(settledPayload.showdowns[0].onchainId).toBe(3);
    expect(allPayload.showdowns.map((showdown: { onchainId: number }) => showdown.onchainId)).toEqual([
      2,
      1,
      3
    ]);
  });

  it('GET /api/showdowns clamps limit between 1 and 50', async () => {
    __setShowdownStoreForTests(
      createShowdownStore({
        listAll: vi.fn(async () =>
          Array.from({ length: 60 }, (_, index) =>
            createRecord({
              onchainId: index + 1,
              openedAt: new Date(Date.parse('2026-06-04T12:00:00.000Z') + index * 1000).toISOString()
            })
          )
        )
      })
    );
    const { GET } = await import('@/app/api/showdowns/route');

    const response = await GET(
      new Request('http://localhost/api/showdowns?status=all&limit=999')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.showdowns).toHaveLength(50);
  });

  it('POST /api/showdowns/discover requires admin authorization', async () => {
    const { POST } = await import('@/app/api/showdowns/discover/route');

    const response = await POST(
      new Request('http://localhost/api/showdowns/discover', {
        method: 'POST'
      })
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      reason: 'admin_access_not_configured'
    });
  });

  it('POST /api/showdowns/discover authorizes via bearer token and returns the discovery result', async () => {
    process.env.ADMIN_ACCESS_TOKEN = 'showcase-token';
    const { POST } = await import('@/app/api/showdowns/discover/route');

    const response = await POST(
      new Request('http://localhost/api/showdowns/discover', {
        method: 'POST',
        headers: {
          authorization: 'Bearer showcase-token'
        }
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(routeState.discoverResult);
    expect(routeState.buildDefaultDiscoveryDeps).toHaveBeenCalledTimes(1);
    expect(routeState.discoverShowdowns).toHaveBeenCalledWith(routeState.discoveryDeps);
  });

  it('POST /api/showdowns/[id]/settle returns resolution-pending when the resolver cannot decide yet', async () => {
    process.env.ADMIN_ACCESS_TOKEN = 'showcase-token';
    __setShowdownStoreForTests(
      createShowdownStore({
        findByOnchainId: vi.fn(async () => createRecord())
      })
    );
    routeState.settlementDeps.resolveMarket.mockResolvedValueOnce(null);
    const { POST } = await import('@/app/api/showdowns/[id]/settle/route');

    const response = await POST(
      new Request('http://localhost/api/showdowns/7/settle', {
        method: 'POST',
        headers: {
          cookie: 'pa_admin=showcase-token'
        }
      }),
      {
        params: Promise.resolve({ id: '7' })
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settled: false,
      reason: 'resolution-pending'
    });
    expect(routeState.settlementDeps.settleOnChain).not.toHaveBeenCalled();
  });

  it('POST /api/showdowns/[id]/settle rejects open showdowns before deadline without initializing settlement deps', async () => {
    process.env.ADMIN_ACCESS_TOKEN = 'showcase-token';
    const showdownStore = createShowdownStore({
      findByOnchainId: vi.fn(async () =>
        createRecord({
          onchainId: 8,
          deadline: '2026-06-05T12:00:01.000Z'
        })
      )
    });
    __setShowdownStoreForTests(showdownStore);
    const { POST } = await import('@/app/api/showdowns/[id]/settle/route');

    const response = await POST(
      new Request('http://localhost/api/showdowns/8/settle', {
        method: 'POST',
        headers: {
          authorization: 'Bearer showcase-token'
        }
      }),
      {
        params: Promise.resolve({ id: '8' })
      }
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      reason: 'showdown_deadline_pending'
    });
    expect(routeState.buildDefaultSettlementDeps).not.toHaveBeenCalled();
    expect(routeState.settlementDeps.resolveMarket).not.toHaveBeenCalled();
    expect(routeState.settlementDeps.settleOnChain).not.toHaveBeenCalled();
    expect(showdownStore.updateOnSettle).not.toHaveBeenCalled();
  });

  it('POST /api/showdowns/[id]/settle updates the store and returns the winning side for an open showdown', async () => {
    process.env.ADMIN_ACCESS_TOKEN = 'showcase-token';
    const showdownStore = createShowdownStore({
      findByOnchainId: vi.fn(async () =>
        createRecord({
          onchainId: 9
        })
      )
    });
    __setShowdownStoreForTests(showdownStore);
    const { POST } = await import('@/app/api/showdowns/[id]/settle/route');

    const response = await POST(
      new Request('http://localhost/api/showdowns/9/settle', {
        method: 'POST',
        headers: {
          authorization: 'Bearer showcase-token'
        }
      }),
      {
        params: Promise.resolve({ id: '9' })
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      settled: true,
      winner: 'A',
      txHash: `0x${'c'.repeat(64)}`
    });
    expect(routeState.buildDefaultSettlementDeps).toHaveBeenCalledTimes(1);
    expect(routeState.settlementDeps.resolveMarket).toHaveBeenCalledWith(
      expect.objectContaining({
        onchainId: 9
      })
    );
    expect(showdownStore.updateOnSettle).toHaveBeenCalledWith(
      9,
      expect.objectContaining({
        status: 'SettledA',
        resolvedOutcome: 'YES',
        settleTxHash: `0x${'c'.repeat(64)}`
      })
    );
  });

  it('POST /api/showdowns/[id]/settle rejects missing and non-open showdowns', async () => {
    process.env.ADMIN_ACCESS_TOKEN = 'showcase-token';
    const showdownStore = createShowdownStore({
      findByOnchainId: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockResolvedValueOnce(
          createRecord({
            onchainId: 10,
            status: 'SettledB',
            settledAt: '2026-06-05T12:00:00.000Z',
            settleTxHash: `0x${'d'.repeat(64)}`,
            resolvedOutcome: 'NO',
            resolvedPriceLabel: 'BTC settled at $97,000'
          })
        )
    });
    __setShowdownStoreForTests(showdownStore);
    const { POST } = await import('@/app/api/showdowns/[id]/settle/route');

    const missingResponse = await POST(
      new Request('http://localhost/api/showdowns/404/settle', {
        method: 'POST',
        headers: {
          authorization: 'Bearer showcase-token'
        }
      }),
      {
        params: Promise.resolve({ id: '404' })
      }
    );
    const settledResponse = await POST(
      new Request('http://localhost/api/showdowns/10/settle', {
        method: 'POST',
        headers: {
          authorization: 'Bearer showcase-token'
        }
      }),
      {
        params: Promise.resolve({ id: '10' })
      }
    );

    expect(missingResponse.status).toBe(404);
    expect(await missingResponse.json()).toMatchObject({ reason: 'showdown_not_found' });
    expect(settledResponse.status).toBe(409);
    expect(await settledResponse.json()).toMatchObject({ reason: 'showdown_not_open' });
  });

  it('default showdown builders fail with machine-readable config errors when required env is absent', async () => {
    delete process.env.ADMIN_PRIVATE_KEY;
    delete process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS;
    vi.resetModules();
    vi.doUnmock('@/lib/services/showdownDiscoveryDefaults');
    vi.doUnmock('@/lib/services/showdownSettlementDefaults');

    const actualDiscoveryDefaults = await import('@/lib/services/showdownDiscoveryDefaults');
    const actualSettlementDefaults = await import('@/lib/services/showdownSettlementDefaults');

    await expect(actualDiscoveryDefaults.buildDefaultDiscoveryDeps()).rejects.toThrow(
      /showdown_discovery_config_missing/
    );
    await expect(actualSettlementDefaults.buildDefaultSettlementDeps()).rejects.toThrow(
      /showdown_settlement_config_missing/
    );
  });

  it('default discovery deps read runtime signals and env-configured bond/deadline values', async () => {
    process.env.ADMIN_PRIVATE_KEY = `0x${'9'.repeat(64)}`;
    process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS = `0x${'8'.repeat(40)}`;
    process.env.SHOWDOWN_BOND_MICRO_USDC = '333000000';
    process.env.SHOWDOWN_DEADLINE_WINDOW_SEC = '43210';
    vi.resetModules();
    vi.doUnmock('@/lib/services/showdownDiscoveryDefaults');
    const store = createLocalStore({ storagePath: '/tmp/predictarena-showdowns-runtime.json' });
    await store.saveAgentRun({
      runId: 'run-discovery-defaults',
      source: 'demo_snapshot',
      generatedAt: '2026-06-04T10:00:00.000Z',
      signals: []
    });
    const actualPersistenceStore = await import('@/lib/persistence/store');
    actualPersistenceStore.setRuntimeStoreForTests(store);

    const actual = await import('@/lib/services/showdownDiscoveryDefaults');
    const deps = await actual.buildDefaultDiscoveryDeps();

    expect(deps.bondPerSideMicroUsdc).toBe(333_000_000n);
    expect(deps.deadlineWindowSec).toBe(43_210);
    await expect(deps.listActiveSignals()).resolves.toEqual([]);
  });

  it('default settlement deps resolve generated signals by promoting them in-memory for the resolver', async () => {
    process.env.ADMIN_PRIVATE_KEY = `0x${'9'.repeat(64)}`;
    process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS = `0x${'8'.repeat(40)}`;
    vi.resetModules();
    vi.doUnmock('@/lib/services/showdownSettlementDefaults');
    vi.doMock('@/lib/prices/fetchCandles', () => ({
      fetchCandles: vi.fn(async () => ({
        asset: 'BTC',
        source: 'demo_snapshot',
        quote: 'USD',
        candles: [
          {
            timestamp: '2026-06-04T00:00:00.000Z',
            open: 100_500,
            high: 101_500,
            low: 99_900,
            close: 101_200,
            volume: 12_345
          }
        ]
      }))
    }));
    const store = createLocalStore({
      storagePath: '/tmp/predictarena-showdowns-generated-settlement.json'
    });
    await store.saveAgentRun({
      runId: 'run-generated-settlement',
      source: 'demo_snapshot',
      generatedAt: '2026-06-03T00:00:00.000Z',
      signals: [
        {
          id: 'generated-btc-signal',
          runId: 'run-generated-settlement',
          marketId: 'market-btc-generated',
          marketQuestion: 'Will BTC close above $100,000?',
          marketUrl: null,
          asset: 'BTC',
          conditionType: 'EXPIRY_ABOVE',
          thresholdUsd: 100000,
          expiresAt: '2026-06-04T00:00:00.000Z',
          agentName: 'volatility',
          modelVersion: 'v1',
          modelParams: {},
          modelHash: `0x${'1'.repeat(64)}`,
          dataHash: `0x${'2'.repeat(64)}`,
          side: 'YES',
          status: 'generated',
          confidence: 'HIGH',
          confidenceBps: 7600,
          marketPriceBps: 5200,
          agentProbabilityBps: 7100,
          yesPriceBps: 5200,
          pYesBps: 7100,
          edgeBps: 1900,
          kellyBps: 300,
          stakeMicroUsdc: 50_000_000,
          riskFlags: [],
          arcTxHash: null,
          createdAt: '2026-06-03T00:00:00.000Z',
          updatedAt: '2026-06-03T00:00:00.000Z',
          source: 'demo_snapshot',
          resolution: null
        }
      ]
    });
    const actualPersistenceStore = await import('@/lib/persistence/store');
    actualPersistenceStore.setRuntimeStoreForTests(store);

    const actual = await import('@/lib/services/showdownSettlementDefaults');
    const deps = await actual.buildDefaultSettlementDeps();
    const resolution = await deps.resolveMarket(
      createRecord({
        marketId: 'market-btc-generated',
        deadline: '2026-06-04T00:00:00.000Z'
      })
    );

    expect(resolution).toEqual({
      outcomeYes: true,
      priceLabel: 'BTC settled at $101,200'
    });
  });
});
