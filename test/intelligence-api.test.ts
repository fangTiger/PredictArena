import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArenaState } from '@/lib/persistence/store';
import type { AgentSignal, ParsedCryptoMarket } from '@/lib/polymarket/types';

const HASH_A = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const HASH_B = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;
const TX_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const UNSAFE_SPREAD_REASON =
  'rpc timeout at https://internal.example with header secret' as const;

async function createTempStorePath() {
  const dir = path.join(tmpdir(), `predictarena-intelligence-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'predictarena-store.json');
}

function createMarket(overrides: Partial<ParsedCryptoMarket> = {}): ParsedCryptoMarket {
  return {
    id: overrides.id ?? 'market-btc-main',
    eventId: overrides.eventId ?? 'event-btc-main',
    slug: overrides.slug ?? 'btc-above-110k-june-3-2026',
    question: overrides.question ?? 'Will BTC be above $110,000 on June 3, 2026?',
    source: overrides.source ?? 'live',
    endDate: overrides.endDate ?? overrides.expiresAt ?? '2026-06-03T12:00:00.000Z',
    yesPriceBps: overrides.yesPriceBps ?? 6200,
    noPriceBps: overrides.noPriceBps ?? 3800,
    liquidity: overrides.liquidity ?? 200000,
    volume: overrides.volume ?? 100000,
    active: overrides.active ?? true,
    closed: overrides.closed ?? false,
    clobTokenIds: overrides.clobTokenIds ?? ['token-btc-main'],
    url: overrides.url ?? 'https://polymarket.com/event/btc-above-110k-june-3-2026',
    rawPayload: overrides.rawPayload ?? {
      clobSpreadDiagnostic: {
        status: 'available',
        tokenId: 'token-btc-main',
        bestBidBps: 6100,
        bestAskBps: 6220,
        midpointBps: 6160,
        spreadBps: 120,
        liquidityUsd: 42000,
        reason: null
      },
      internalUrl: 'https://internal.example/rpc',
      requestHeaders: { 'x-internal-auth': 'secret' },
      rawPayload: { nested: true }
    },
    asset: overrides.asset ?? 'BTC',
    conditionType: overrides.conditionType ?? 'EXPIRY_ABOVE',
    thresholdUsd: overrides.thresholdUsd ?? 110000,
    expiresAt: overrides.expiresAt ?? '2026-06-03T12:00:00.000Z',
    yesMeaning:
      overrides.yesMeaning ?? 'YES means BTC closes above $110,000 at expiry.',
    parseConfidence: overrides.parseConfidence ?? 0.89,
    scoutScoreBps: overrides.scoutScoreBps ?? 8000
  };
}

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  const agentName = overrides.agentName ?? 'volatility';
  const marketId = overrides.marketId ?? 'market-btc-main';

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
      sigma: 1.4,
      sigma7: 1.6,
      sigma30: 1.1,
      recentReturn7d: 0.18,
      thresholdUsd: 110000
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
    createdAt: overrides.createdAt ?? '2026-05-30T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? '2026-05-30T10:00:00.000Z',
    source: overrides.source ?? 'live',
    resolution: overrides.resolution ?? null
  };
}

async function seedStore(state: ArenaState) {
  const { createLocalStore } = await import('@/lib/persistence/localStore');
  const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
  const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });
  await store.replaceArenaState(state);
  setRuntimeStoreForTests(store);
  return store;
}

function expectPublicPayloadSafe(payload: unknown) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain('rawPayload');
  expect(serialized).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  expect(serialized).not.toContain('PRIVATE_KEY');
  expect(serialized).not.toContain('internal.example');
  expect(serialized).not.toContain('x-internal-auth');
  expect(serialized).not.toContain('lock-owner-secret');
  expect(serialized).not.toContain('idempotency-secret');
  expect(serialized).not.toContain('rpc timeout');
}

function createState(): ArenaState {
  const btcMarket = createMarket({
    id: 'market-btc-main',
    source: 'demo_snapshot',
    rawPayload: {
      clobSpreadDiagnostic: {
        status: 'degraded',
        tokenId: 'token-btc-main',
        bestBidBps: null,
        bestAskBps: null,
        midpointBps: null,
        spreadBps: null,
        liquidityUsd: null,
        reason: UNSAFE_SPREAD_REASON
      },
      internalUrl: 'https://internal.example/rpc',
      requestHeaders: { 'x-internal-auth': 'secret' },
      rawPayload: { nested: true }
    }
  });
  const ethMarket = createMarket({
    id: 'market-eth-alt',
    eventId: 'event-eth-alt',
    slug: 'eth-above-4500-june-10-2026',
    question: 'Will ETH be above $4,500 on June 10, 2026?',
    asset: 'ETH',
    source: 'live',
    yesPriceBps: 5400,
    noPriceBps: 4600,
    liquidity: 500000,
    volume: 300000,
    thresholdUsd: 4500,
    expiresAt: '2026-06-10T12:00:00.000Z',
    endDate: '2026-06-10T12:00:00.000Z',
    rawPayload: {
      internalUrl: 'https://internal.example/eth',
      serviceRoleKey: 'never-show'
    }
  });

  return {
    latestScan: {
      source: 'demo_snapshot',
      scannedAt: '2026-05-31T10:00:00.000Z',
      marketCount: 2
    },
    markets: [btcMarket, ethMarket],
    signals: [
      createSignal({
        marketId: 'market-btc-main',
        source: 'demo_snapshot',
        createdAt: '2026-05-30T10:00:00.000Z',
        status: 'resolved_correct',
        arcTxHash: TX_A,
        resolution: {
          outcomeCorrect: true,
          yesOutcome: true,
          resolvedAt: '2026-05-30T16:00:00.000Z',
          source: 'automatic'
        }
      }),
      createSignal({
        id: 'market-btc-main:momentum',
        marketId: 'market-btc-main',
        agentName: 'momentum',
        source: 'demo_snapshot',
        confidence: 'MEDIUM',
        edgeBps: 900,
        createdAt: '2026-05-30T10:00:00.000Z',
        agentProbabilityBps: 7100,
        pYesBps: 7100,
        riskFlags: ['momentum_upside']
      }),
      createSignal({
        id: 'eth-signal-1',
        marketId: 'market-eth-alt',
        marketQuestion: 'Will ETH be above $4,500 on June 10, 2026?',
        marketUrl: 'https://polymarket.com/event/eth-above-4500-june-10-2026',
        asset: 'ETH',
        thresholdUsd: 4500,
        expiresAt: '2026-06-10T12:00:00.000Z',
        createdAt: '2026-05-31T11:30:00.000Z',
        source: 'live',
        confidence: 'HIGH',
        edgeBps: 2100,
        marketPriceBps: 5400,
        yesPriceBps: 5400,
        pYesBps: 7500,
        agentProbabilityBps: 7500,
        status: 'resolved_correct',
        arcTxHash: TX_A,
        resolution: {
          outcomeCorrect: true,
          yesOutcome: true,
          resolvedAt: '2026-05-31T12:00:00.000Z'
        }
      }),
      createSignal({
        id: 'eth-signal-2',
        marketId: 'market-eth-alt',
        marketQuestion: 'Will ETH be above $4,500 on June 10, 2026?',
        marketUrl: 'https://polymarket.com/event/eth-above-4500-june-10-2026',
        asset: 'ETH',
        thresholdUsd: 4500,
        expiresAt: '2026-06-10T12:00:00.000Z',
        agentName: 'momentum',
        createdAt: '2026-05-31T11:30:00.000Z',
        source: 'live',
        confidence: 'LOW',
        edgeBps: 600,
        marketPriceBps: 5400,
        yesPriceBps: 5400,
        pYesBps: 5800,
        agentProbabilityBps: 5800
      })
    ],
    autonomyRuns: [
      {
        runId: 'autonomy:btc',
        idempotencyKey: 'idempotency-secret',
        scheduleWindowId: 'window-1',
        source: 'demo_snapshot',
        triggeredAt: '2026-05-30T10:00:00.000Z',
        completedAt: '2026-05-30T10:05:00.000Z',
        marketCount: 1,
        generatedSignalCount: 2,
        modeByAgent: {
          volatility: 'DRY_RUN',
          momentum: 'OFF'
        },
        queue: [
          {
            signalId: 'market-btc-main:volatility',
            agentName: 'volatility',
            status: 'committed',
            reason: null,
            txHash: TX_A,
            edgeBps: 1800,
            stakeMicroUsdc: 50000
          }
        ]
      }
    ],
    ops: {
      autonomous: {
        lock: {
          scope: 'autonomy',
          token: 'lock-token-secret',
          key: 'autonomy',
          owner: 'lock-owner-secret',
          acquiredAt: '2026-05-31T11:00:00.000Z',
          expiresAt: '2026-05-31T11:15:00.000Z'
        },
        claims: [],
        lastFailure: null
      },
      proof: {
        lock: null,
        claims: []
      }
    },
    lastRun: {
      runId: 'run:latest',
      source: 'demo_snapshot',
      generatedAt: '2026-05-31T11:30:00.000Z'
    }
  };
}

describe('intelligence public APIs', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('ALLOW_DEMO_SNAPSHOT', 'true');
    vi.stubEnv('CRON_SECRET', 'cron-secret-never-render');
    vi.stubEnv('PREDICTARENA_LOCAL_STORE_PATH', await createTempStorePath());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('GET /api/intelligence/markets applies default filters, sorts safely, and hides internal fields', async () => {
    const store = await seedStore(createState());
    const { GET } = await import('@/app/api/intelligence/markets/route');

    const response = await GET(
      new Request('http://localhost/api/intelligence/markets?sort=edge_desc&limit=1')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters).toMatchObject({
      asset: 'all',
      conditionType: 'all',
      confidence: 'all',
      source: 'all',
      sort: 'edge_desc',
      minEdgeBps: 0,
      maxExpiryDays: 21,
      minLiquidity: 0,
      limit: 1
    });
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      marketId: 'market-eth-alt',
      asset: 'ETH'
    });
    expect(payload.freshness).toMatchObject({
      latestScanAt: '2026-05-31T10:00:00.000Z',
      marketCount: 2
    });
    expectPublicPayloadSafe(payload);
    expect(await store.getArenaState()).toEqual(createState());
  });

  it('GET /api/intelligence/markets rejects invalid query parameters with invalid_request', async () => {
    await seedStore(createState());
    const { GET } = await import('@/app/api/intelligence/markets/route');

    const response = await GET(
      new Request('http://localhost/api/intelligence/markets?limit=0&sort=bad')
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe('invalid_request');
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: ['limit'] }),
        expect.objectContaining({ path: ['sort'] })
      ])
    );
  });

  it('GET /api/intelligence/research validates exclusive target selection and returns controlled not_found', async () => {
    await seedStore(createState());
    const { GET } = await import('@/app/api/intelligence/research/route');

    const invalid = await GET(
      new Request(
        'http://localhost/api/intelligence/research?signalId=market-btc-main:volatility&marketId=market-btc-main'
      )
    );
    const invalidPayload = await invalid.json();

    expect(invalid.status).toBe(400);
    expect(invalidPayload.reason).toBe('invalid_request');

    const missing = await GET(
      new Request('http://localhost/api/intelligence/research?marketId=missing-market')
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ reason: 'not_found' });
  });

  it('GET /api/intelligence/research returns deterministic market research and stays read-only', async () => {
    const store = await seedStore(createState());
    const before = JSON.parse(JSON.stringify(await store.getArenaState()));
    const { GET } = await import('@/app/api/intelligence/research/route');

    const response = await GET(
      new Request('http://localhost/api/intelligence/research?marketId=market-btc-main')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.research).toMatchObject({
      market: expect.objectContaining({
        marketId: 'market-btc-main',
        impliedProbabilityBps: 6200
      }),
      spreadDiagnostics: {
        status: 'degraded',
        bestBidBps: null,
        bestAskBps: null,
        midpointBps: null,
        spreadBps: null,
        liquidityUsd: null,
        reason: 'provider_degraded'
      },
      drivers: {
        primary: 'high_volatility',
        marketRiskFlags: expect.arrayContaining(['volatility_regime_high']),
        volatilityRiskFlags: expect.arrayContaining(['volatility_regime_high']),
        momentumRiskFlags: expect.arrayContaining(['momentum_upside'])
      },
      accountability: expect.objectContaining({
        status: 'resolved',
        proofStatus: 'not_observed',
        dryRunCount: 0,
        dryRunPresent: false,
        committedCount: 1,
        resolvedCount: 1,
        txHashes: [TX_A],
        resolutionSourceMix: {
          automatic: 1,
          demo_admin: 0,
          unresolved: 1,
          unknown: 0
        }
      })
    });
    expect(payload.research.agentViews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'market-btc-main:volatility',
          modelHash: HASH_A,
          dataHash: HASH_B
        }),
        expect.objectContaining({
          signalId: 'market-btc-main:momentum',
          agentName: 'momentum'
        })
      ])
    );
    expect(payload.research.summary).not.toMatch(/\b(buy|sell|trade|follow)\b/i);
    expect(JSON.stringify(payload)).not.toContain(UNSAFE_SPREAD_REASON);
    expect(JSON.stringify(payload)).toContain('provider_degraded');
    expectPublicPayloadSafe(payload);
    expect(JSON.parse(JSON.stringify(await store.getArenaState()))).toEqual(before);
  });

  it('GET /api/intelligence/agents validates filters and marks insufficient data with default minResolved', async () => {
    await seedStore(createState());
    const { GET } = await import('@/app/api/intelligence/agents/route');

    const response = await GET(
      new Request('http://localhost/api/intelligence/agents?groupBy=agent')
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.filters).toMatchObject({
      groupBy: 'agent',
      asset: 'all',
      conditionType: 'all',
      confidence: 'all',
      minResolved: 3
    });
    expect(payload.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          agentName: 'volatility',
          groupValue: 'volatility',
          resolvedCount: 2,
          insufficientData: true
        })
      ])
    );

    const invalid = await GET(
      new Request('http://localhost/api/intelligence/agents?groupBy=bad')
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).reason).toBe('invalid_request');
  });

  it('GET /api/intelligence/paper-follow validates ranges and returns paper-follow analytics', async () => {
    await seedStore(createState());
    const { GET } = await import('@/app/api/intelligence/paper-follow/route');

    const invalid = await GET(
      new Request(
        'http://localhost/api/intelligence/paper-follow?from=2026-05-31T00:00:00.000Z&to=2026-05-01T00:00:00.000Z'
      )
    );
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).reason).toBe('invalid_request');

    const response = await GET(
      new Request(
        'http://localhost/api/intelligence/paper-follow?agentName=volatility&stakeModel=confidence_weighted'
      )
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.result).toMatchObject({
      assumptions: {
        agentName: 'volatility',
        minEdgeBps: 700,
        confidence: 'all',
        asset: 'all',
        conditionType: 'all',
        stakeModel: 'confidence_weighted'
      },
      includedCount: 2,
      resolvedCount: 2,
      unresolvedCount: 0,
      sourceMix: {
        automatic: 1,
        demo_admin: 0,
        unresolved: 0,
        unknown: 1
      }
    });
    expectPublicPayloadSafe(payload);
  });
});
