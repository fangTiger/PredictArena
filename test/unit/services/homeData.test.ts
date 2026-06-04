import { describe, expect, it } from 'vitest';
import { getHomeStripData, type HomeDataReaders } from '@/lib/services/homeData';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { ShowdownRecord } from '@/lib/persistence/store';

const NOW_MS = 1_700_000_000_000;
const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;

function makeReaders(overrides: Partial<HomeDataReaders> = {}): HomeDataReaders {
  return {
    listSignals: async () => [],
    getMetrics: async () => ({
      generatedSignals: 0,
      committedSignals: 0,
      resolvedSignals: 0,
      openSignals: 0,
      averageEdgeBps: 0,
      totalBondedMicroUsdc: 0
    }),
    listShowdowns: async () => [],
    readBlockNumber: async () => 0,
    nowMs: () => NOW_MS,
    ...overrides
  };
}

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    id: 'home-signal',
    runId: 'home-run',
    marketId: 'market-1',
    marketQuestion: 'Will BTC be above $100,000?',
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 100000,
    expiresAt: '2026-06-10T00:00:00.000Z',
    agentName: 'volatility',
    modelVersion: 'v1',
    modelParams: {},
    modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    side: 'YES',
    status: 'generated',
    confidence: 'HIGH',
    confidenceBps: 7500,
    marketPriceBps: 5400,
    agentProbabilityBps: 7100,
    yesPriceBps: 5400,
    pYesBps: 7100,
    edgeBps: 1700,
    kellyBps: 250,
    stakeMicroUsdc: 50_000_000,
    riskFlags: [],
    arcTxHash: null,
    createdAt: new Date(NOW_MS - 2 * ONE_DAY_MS).toISOString(),
    updatedAt: new Date(NOW_MS - 2 * ONE_DAY_MS).toISOString(),
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

describe('getHomeStripData', () => {
  it('exposes metrics-derived totals and signals-derived counts', async () => {
    const data = await getHomeStripData(
      makeReaders({
        getMetrics: async () => ({
          generatedSignals: 50,
          committedSignals: 30,
          resolvedSignals: 38,
          openSignals: 12,
          averageEdgeBps: 800,
          totalBondedMicroUsdc: 24_580_000_000
        }),
        readBlockNumber: async () => 8_412_390
      })
    );

    expect(data.activeSignals).toBe(12);
    expect(data.usdcBondedMicro).toBe(24_580_000_000n);
    expect(data.blockNumber).toBe(8_412_390);
  });

  it('counts signals from the last hour for activeSignalsDelta', async () => {
    const data = await getHomeStripData(
      makeReaders({
        nowMs: () => NOW_MS,
        listSignals: async () => [
          createSignal({ id: 's-1', createdAt: new Date(NOW_MS - 30 * 60 * 1000).toISOString() }),
          createSignal({ id: 's-2', createdAt: new Date(NOW_MS - 45 * 60 * 1000).toISOString() }),
          createSignal({ id: 's-3', createdAt: new Date(NOW_MS - 70 * 60 * 1000).toISOString() }),
          createSignal({ id: 's-4', createdAt: new Date(NOW_MS - 2 * ONE_HOUR_MS).toISOString() })
        ]
      })
    );

    expect(data.activeSignalsDelta).toBe(2);
  });

  it('counts only committed signals from the last 24 hours for the bonded delta', async () => {
    const data = await getHomeStripData(
      makeReaders({
        nowMs: () => NOW_MS,
        listSignals: async () => [
          createSignal({
            id: 'u-1',
            createdAt: new Date(NOW_MS - 2 * ONE_HOUR_MS).toISOString(),
            stakeMicroUsdc: 600_000_000,
            arcTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
          }),
          createSignal({
            id: 'u-2',
            createdAt: new Date(NOW_MS - 12 * ONE_HOUR_MS).toISOString(),
            stakeMicroUsdc: 400_000_000
          }),
          createSignal({
            id: 'u-3',
            createdAt: new Date(NOW_MS - 2 * ONE_DAY_MS).toISOString(),
            stakeMicroUsdc: 900_000_000
          })
        ]
      })
    );

    expect(data.usdcBondedDelta24hMicro).toBe(600_000_000n);
  });

  it('computes accuracy from resolved signals', async () => {
    const data = await getHomeStripData(
      makeReaders({
        listSignals: async () => [
          createResolvedSignal('r-1', true),
          createResolvedSignal('r-2', true),
          createResolvedSignal('r-3', true),
          createResolvedSignal('r-4', false),
          createSignal({ id: 'pending-1' })
        ]
      })
    );

    expect(data.accuracyBps).toBe(7500);
  });

  it('computes accuracyDeltaPp from week-over-week resolved signals', async () => {
    const data = await getHomeStripData(
      makeReaders({
        nowMs: () => NOW_MS,
        listSignals: async () => [
          createResolvedAt('w-this-1', NOW_MS - ONE_DAY_MS, true),
          createResolvedAt('w-this-2', NOW_MS - 2 * ONE_DAY_MS, true),
          createResolvedAt('w-prior-1', NOW_MS - 8 * ONE_DAY_MS, true),
          createResolvedAt('w-prior-2', NOW_MS - 9 * ONE_DAY_MS, false)
        ]
      })
    );

    expect(data.accuracyDeltaPp).toBeCloseTo(50, 1);
  });

  it('falls back to empty metrics and null block when readers reject', async () => {
    const data = await getHomeStripData(
      makeReaders({
        listSignals: async () => {
          throw new Error('store down');
        },
        getMetrics: async () => {
          throw new Error('metrics down');
        },
        readBlockNumber: async () => {
          throw new Error('rpc down');
        }
      })
    );

    expect(data.activeSignals).toBe(0);
    expect(data.activeSignalsDelta).toBe(0);
    expect(data.usdcBondedMicro).toBe(0n);
    expect(data.accuracyBps).toBe(0);
    expect(data.accuracyDeltaPp).toBe(0);
    expect(data.blockNumber).toBeNull();
  });

  it('counts settled showdowns and identifies the current leader by wins', async () => {
    const data = await getHomeStripData(
      makeReaders({
        listShowdowns: async () => [
          createShowdown({ onchainId: 1, status: 'SettledA' }),
          createShowdown({ onchainId: 2, status: 'SettledA' }),
          createShowdown({
            onchainId: 3,
            status: 'SettledB',
            agentB: { ...createShowdown().agentB, name: 'momentum' },
            settledAt: '2026-06-04T06:00:00.000Z',
            settleTxHash: `0x${'c'.repeat(64)}`,
            resolvedOutcome: 'NO'
          }),
          createShowdown({ onchainId: 4, status: 'Open' })
        ]
      })
    );

    expect(data.showdownsWon).toBe(3);
    expect(data.showdownsLeaderName).toBe('Volatility');
  });

  it('falls back to 0 and em dash when showdown reads reject', async () => {
    const data = await getHomeStripData(
      makeReaders({
        listShowdowns: async () => {
          throw new Error('showdowns down');
        }
      })
    );

    expect(data.showdownsWon).toBe(0);
    expect(data.showdownsLeaderName).toBe('—');
  });
});

function createResolvedSignal(id: string, outcomeCorrect: boolean): AgentSignal {
  return createSignal({
    id,
    status: outcomeCorrect ? 'resolved_correct' : 'resolved_incorrect',
    resolution: {
      outcomeCorrect,
      resolvedAt: new Date(NOW_MS - ONE_DAY_MS).toISOString()
    }
  });
}

function createResolvedAt(id: string, resolvedAtMs: number, outcomeCorrect: boolean): AgentSignal {
  return createSignal({
    id,
    createdAt: new Date(resolvedAtMs - ONE_DAY_MS).toISOString(),
    status: outcomeCorrect ? 'resolved_correct' : 'resolved_incorrect',
    resolution: {
      outcomeCorrect,
      resolvedAt: new Date(resolvedAtMs).toISOString()
    }
  });
}

function createShowdown(overrides: Partial<ShowdownRecord> = {}): ShowdownRecord {
  return {
    externalId: `0x${'a'.repeat(64)}`,
    onchainId: 99,
    marketId: 'market-btc-100k',
    marketQuestion: 'Will BTC close above $100,000?',
    agentA: {
      address: `0x${'1'.repeat(40)}`,
      name: 'volatility',
      side: 'YES',
      probabilityBps: 7200
    },
    agentB: {
      address: `0x${'2'.repeat(40)}`,
      name: 'momentum',
      side: 'NO',
      probabilityBps: 3100
    },
    bondPerSideMicroUsdc: 250_000_000,
    deadline: '2026-06-05T00:00:00.000Z',
    status: 'SettledA',
    openedAt: '2026-06-04T00:00:00.000Z',
    settledAt: '2026-06-05T01:00:00.000Z',
    openTxHash: `0x${'b'.repeat(64)}`,
    settleTxHash: `0x${'c'.repeat(64)}`,
    resolvedOutcome: 'YES',
    resolvedPriceLabel: 'BTC settled at $102,431',
    ...overrides
  };
}
