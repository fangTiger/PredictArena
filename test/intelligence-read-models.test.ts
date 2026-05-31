import { describe, expect, it } from 'vitest';
import type { ArenaState } from '@/lib/persistence/store';
import type { AgentSignal, ParsedCryptoMarket } from '@/lib/polymarket/types';

const HASH_A = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const HASH_B = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;
const TX_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;
const UNSAFE_SPREAD_REASON =
  'rpc timeout at https://internal.example with header secret' as const;

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
      internalUrl: 'https://rpc.internal.example',
      requestHeaders: { authorization: 'hidden' },
      rawProviderError: 'rpc timeout'
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
    riskFlags: overrides.riskFlags ?? ['price_snapshot_stale'],
    arcTxHash: overrides.arcTxHash ?? null,
    arcSignalRecordId: overrides.arcSignalRecordId,
    createdAt: overrides.createdAt ?? '2026-05-30T10:00:00.000Z',
    updatedAt: overrides.updatedAt ?? overrides.createdAt ?? '2026-05-30T10:00:00.000Z',
    source: overrides.source ?? 'live',
    resolution: overrides.resolution ?? null
  };
}

function createState(overrides: Partial<ArenaState> = {}): ArenaState {
  return {
    latestScan: overrides.latestScan ?? {
      source: 'live',
      scannedAt: '2026-05-31T11:45:00.000Z',
      marketCount: 1
    },
    markets: overrides.markets ?? [],
    signals: overrides.signals ?? [],
    autonomyRuns: overrides.autonomyRuns ?? [],
    ops: overrides.ops,
    lastRun: overrides.lastRun
  };
}

describe('market intelligence read model builders', () => {
  it('builds bounded market scores, applies stale penalties, and emits non-trading summaries', async () => {
    const { buildMarketIntelligenceCatalog } = await import('@/lib/intelligence/readModels');

    const market = createMarket({
      source: 'demo_snapshot'
    });
    const volatilitySignal = createSignal({
      source: 'demo_snapshot',
      createdAt: '2026-05-30T10:00:00.000Z',
      edgeBps: 1800,
      confidence: 'HIGH',
      agentProbabilityBps: 8000,
      pYesBps: 8000,
      riskFlags: ['volatility_regime_high']
    });
    const momentumSignal = createSignal({
      id: 'market-btc-main:momentum',
      agentName: 'momentum',
      source: 'demo_snapshot',
      createdAt: '2026-05-30T10:00:00.000Z',
      edgeBps: 900,
      confidence: 'MEDIUM',
      agentProbabilityBps: 7100,
      pYesBps: 7100,
      riskFlags: ['momentum_upside']
    });
    const state = createState({
      latestScan: {
        source: 'demo_snapshot',
        scannedAt: '2026-05-31T10:00:00.000Z',
        marketCount: 1
      },
      markets: [market],
      signals: [volatilitySignal, momentumSignal]
    });

    const result = buildMarketIntelligenceCatalog(
      state,
      {
        asset: 'all',
        conditionType: 'all',
        confidence: 'all',
        source: 'all',
        sort: 'opportunity_desc',
        minEdgeBps: 0,
        maxExpiryDays: 21,
        minLiquidity: 0,
        limit: 20
      },
      '2026-05-31T12:00:00.000Z'
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      marketId: 'market-btc-main',
      freshnessStatus: 'stale',
      bestAgent: expect.objectContaining({
        agentName: 'volatility',
        edgeBps: 1800,
        confidence: 'HIGH'
      }),
      dataHealthScoreBps: 4500,
      opportunityScoreBps: 6815,
      riskScoreBps: 4390
    });
    expect(result.items[0].summary).toContain('research priority');
    expect(result.items[0].summary).not.toMatch(/\b(buy|sell|trade|follow)\b/i);
    expect(result.items[0].riskFlags).toEqual(
      expect.arrayContaining([
        'market_scan_stale',
        'price_snapshot_stale',
        'signal_stale',
        'demo_snapshot_source'
      ])
    );
    expect(result.items[0].summary).toContain('high_volatility');
  });

  it('sanitizes unsafe spread diagnostic reasons into safe public codes', async () => {
    const { buildMarketIntelligenceCatalog } = await import('@/lib/intelligence/readModels');

    const state = createState({
      markets: [
        createMarket({
          rawPayload: {
            clobSpreadDiagnostic: {
              status: 'degraded',
              spreadBps: null,
              reason: UNSAFE_SPREAD_REASON
            }
          }
        })
      ],
      signals: [createSignal()]
    });

    const result = buildMarketIntelligenceCatalog(
      state,
      {
        asset: 'all',
        conditionType: 'all',
        confidence: 'all',
        source: 'all',
        sort: 'opportunity_desc',
        minEdgeBps: 0,
        maxExpiryDays: 21,
        minLiquidity: 0,
        limit: 20
      },
      '2026-05-31T12:00:00.000Z'
    );

    expect(result.items[0]?.spreadDiagnostics.reason).toBe('provider_degraded');
    expect(JSON.stringify(result)).not.toContain(UNSAFE_SPREAD_REASON);
  });

  it('segments reputation by expiry, confidence, and edge buckets with default minResolved=3', async () => {
    const { buildSegmentedAgentReputation } = await import('@/lib/intelligence/readModels');

    const state = createState({
      markets: [createMarket()],
      signals: [
        createSignal({
          id: 'vol-intraday-1',
          createdAt: '2026-05-31T00:00:00.000Z',
          expiresAt: '2026-05-31T20:00:00.000Z',
          confidence: 'HIGH',
          edgeBps: 2200,
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-05-31T21:00:00.000Z',
            source: 'automatic'
          },
          arcTxHash: TX_A
        }),
        createSignal({
          id: 'vol-1-3d-1',
          createdAt: '2026-05-30T00:00:00.000Z',
          expiresAt: '2026-06-01T00:00:00.000Z',
          confidence: 'HIGH',
          edgeBps: 2100,
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-06-01T00:30:00.000Z',
            source: 'automatic'
          },
          arcTxHash: TX_A
        }),
        createSignal({
          id: 'vol-1-3d-2',
          createdAt: '2026-05-30T04:00:00.000Z',
          expiresAt: '2026-06-01T04:00:00.000Z',
          confidence: 'HIGH',
          edgeBps: 2300,
          status: 'resolved_incorrect',
          resolution: {
            outcomeCorrect: false,
            yesOutcome: false,
            resolvedAt: '2026-06-01T05:00:00.000Z',
            source: 'demo_admin'
          },
          arcTxHash: TX_A
        }),
        createSignal({
          id: 'vol-4-7d-1',
          createdAt: '2026-05-30T00:00:00.000Z',
          expiresAt: '2026-06-05T00:00:00.000Z',
          confidence: 'MEDIUM',
          edgeBps: 1500,
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-06-05T00:30:00.000Z',
            source: 'automatic'
          },
          arcTxHash: TX_A
        }),
        createSignal({
          id: 'vol-4-7d-2',
          createdAt: '2026-05-30T01:00:00.000Z',
          expiresAt: '2026-06-05T01:00:00.000Z',
          confidence: 'MEDIUM',
          edgeBps: 1400,
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-06-05T01:30:00.000Z',
            source: 'automatic'
          },
          arcTxHash: TX_A
        }),
        createSignal({
          id: 'vol-4-7d-3',
          createdAt: '2026-05-30T02:00:00.000Z',
          expiresAt: '2026-06-05T02:00:00.000Z',
          confidence: 'MEDIUM',
          edgeBps: 1600,
          status: 'resolved_incorrect',
          resolution: {
            outcomeCorrect: false,
            yesOutcome: false,
            resolvedAt: '2026-06-05T02:30:00.000Z',
            source: 'automatic'
          },
          arcTxHash: TX_A
        })
      ]
    });

    const expiryRows = buildSegmentedAgentReputation(state, {
      groupBy: 'expiryBucket',
      asset: 'all',
      conditionType: 'all',
      confidence: 'all',
      minResolved: 3
    });
    const confidenceRows = buildSegmentedAgentReputation(state, {
      groupBy: 'confidenceBucket',
      asset: 'all',
      conditionType: 'all',
      confidence: 'all',
      minResolved: 3
    });
    const edgeRows = buildSegmentedAgentReputation(state, {
      groupBy: 'edgeBucket',
      asset: 'all',
      conditionType: 'all',
      confidence: 'all',
      minResolved: 3
    });

    expect(
      expiryRows.find(
        (row) => row.agentName === 'volatility' && row.groupValue === '1_3d'
      )
    ).toMatchObject({
      generatedCount: 2,
      resolvedCount: 2,
      insufficientData: true
    });
    expect(
      expiryRows.find(
        (row) => row.agentName === 'volatility' && row.groupValue === '4_7d'
      )
    ).toMatchObject({
      generatedCount: 3,
      resolvedCount: 3,
      insufficientData: false
    });
    expect(
      confidenceRows.find(
        (row) => row.agentName === 'volatility' && row.groupValue === 'HIGH'
      )
    ).toMatchObject({
      generatedCount: 3,
      resolvedCount: 3
    });
    expect(
      edgeRows.find(
        (row) => row.agentName === 'volatility' && row.groupValue === '2000_plus'
      )
    ).toMatchObject({
      generatedCount: 3,
      resolvedCount: 3
    });
  });

  it('computes paper-follow metrics, source mix, skipped reasons, unresolved counts, and max drawdown', async () => {
    const { buildPaperFollowResult } = await import('@/lib/intelligence/readModels');

    const state = createState({
      markets: [createMarket()],
      signals: [
        createSignal({
          id: 'paper-win-auto',
          confidence: 'HIGH',
          edgeBps: 1800,
          marketPriceBps: 4000,
          pYesBps: 8000,
          agentProbabilityBps: 8000,
          createdAt: '2026-05-25T00:00:00.000Z',
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-05-25T02:00:00.000Z',
            source: 'automatic'
          }
        }),
        createSignal({
          id: 'paper-loss-demo',
          confidence: 'MEDIUM',
          edgeBps: 1600,
          marketPriceBps: 6000,
          pYesBps: 7500,
          agentProbabilityBps: 7500,
          createdAt: '2026-05-26T00:00:00.000Z',
          status: 'resolved_incorrect',
          resolution: {
            outcomeCorrect: false,
            yesOutcome: false,
            resolvedAt: '2026-05-26T02:00:00.000Z',
            source: 'demo_admin'
          }
        }),
        createSignal({
          id: 'paper-win-unknown',
          confidence: 'HIGH',
          edgeBps: 1300,
          marketPriceBps: 5500,
          pYesBps: 6500,
          agentProbabilityBps: 6500,
          createdAt: '2026-05-27T00:00:00.000Z',
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-05-27T02:00:00.000Z'
          }
        }),
        createSignal({
          id: 'paper-unresolved',
          confidence: 'LOW',
          edgeBps: 900,
          createdAt: '2026-05-28T00:00:00.000Z',
          resolution: null
        }),
        createSignal({
          id: 'paper-below-threshold',
          confidence: 'HIGH',
          edgeBps: 600,
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-05-28T02:00:00.000Z',
            source: 'automatic'
          }
        }),
        createSignal({
          id: 'paper-avoid',
          confidence: 'HIGH',
          edgeBps: 1700,
          side: 'AVOID',
          status: 'resolved_incorrect',
          resolution: {
            outcomeCorrect: false,
            yesOutcome: false,
            resolvedAt: '2026-05-29T02:00:00.000Z',
            source: 'automatic'
          }
        }),
        createSignal({
          id: 'paper-agent-filtered',
          agentName: 'momentum',
          confidence: 'HIGH',
          edgeBps: 1800,
          status: 'resolved_correct',
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-05-29T04:00:00.000Z',
            source: 'automatic'
          }
        })
      ]
    });

    const result = buildPaperFollowResult(
      state,
      {
        agentName: 'volatility',
        minEdgeBps: 700,
        confidence: 'all',
        asset: 'all',
        conditionType: 'all',
        from: null,
        to: null,
        stakeModel: 'confidence_weighted'
      },
      '2026-05-31T12:00:00.000Z'
    );

    expect(result).toMatchObject({
      includedCount: 4,
      resolvedCount: 3,
      unresolvedCount: 1,
      skippedCount: 3,
      wins: 2,
      losses: 1,
      averageEdgeBps: 1400,
      hitRateBps: 6667,
      paperRoiBps: 2654,
      brierScoreBps: 2417,
      maxDrawdownBps: 4500,
      sourceMix: {
        automatic: 1,
        demo_admin: 1,
        unresolved: 1,
        unknown: 1
      },
      skippedReasonCounts: {
        below_min_edge: 1,
        avoid_signal: 1,
        agent_filtered: 1
      },
      insufficientData: false
    });
    expect(result.curve.map((point) => point.cumulativeRoiBps)).toEqual([6000, 1500, 2654]);
  });
});
