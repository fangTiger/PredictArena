import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { PrismaPredictArenaStore } from '@/lib/server/store/prisma-store';
import type { ArenaRunResult, ParsedMarket, ScanRecord, SkippedMarket } from '@/types/predictarena';

function createMarket(id: string, asset: 'ETH' | 'BTC'): ParsedMarket {
  return {
    id,
    eventId: `event-${id}`,
    slug: `${asset.toLowerCase()}-${id}`,
    question: `Will ${asset} be above target?`,
    asset,
    direction: 'ABOVE',
    thresholdCents: asset === 'ETH' ? 400_000 : 110_000_00,
    expiryAt: '2026-07-01T23:59:00.000Z',
    yesPriceBps: 5600,
    noPriceBps: 4400,
    liquidityScoreBps: 8300,
    parseConfidenceBps: 9400,
    source: 'live',
    rawPayload: { origin: 'test' }
  };
}

function createScan(): ScanRecord {
  return {
    id: 'scan-1',
    source: 'live',
    liveMarketCount: 3,
    parsedMarketCount: 2,
    skippedMarketCount: 1,
    createdAt: '2026-05-20T00:00:00.000Z'
  };
}

function createScanWithOverrides(overrides: Partial<ScanRecord>): ScanRecord {
  return {
    ...createScan(),
    ...overrides
  };
}

function createRuns(markets: ParsedMarket[]): ArenaRunResult[] {
  return markets.map((market, index) => ({
    market,
    volatility: {
      agent: 'volatility',
      probabilityBps: 7600 - index * 200,
      reasons: [`volatility-${market.id}`]
    },
    momentum: {
      agent: 'momentum',
      probabilityBps: 7800 - index * 200,
      reasons: [`momentum-${market.id}`]
    },
    signal: {
      id: `signal-${market.id}`,
      marketId: market.id,
      decision: 'BUY_YES',
      yesProbabilityBps: 7900 - index * 100,
      noProbabilityBps: 2100 + index * 100,
      confidenceBps: 7900 - index * 100,
      edgeBps: 1500 - index * 100,
      eligibleForCommit: true,
      bondAmountMicroUsdc: 25_000_000,
      agentScoreBps: 7900 - index * 100,
      reasons: [`signal-${market.id}`],
      createdAt: `2026-05-20T0${index + 1}:00:00.000Z`,
      commitmentStatus: 'not_started'
    }
  }));
}

describe('PrismaPredictArenaStore', () => {
  const stores: PrismaPredictArenaStore[] = [];
  const files: string[] = [];

  afterEach(async () => {
    await Promise.all(stores.splice(0).map((store) => store.disconnect()));
    await Promise.all(
      files.splice(0).map(async (filePath) => {
        await fs.rm(filePath, { force: true });
      })
    );
  });

  it('persists scans, arena runs, commitments, stats, and leaderboard without double-counting duplicates', async () => {
    const databasePath = path.join(tmpdir(), `predictarena-${randomUUID()}.db`);
    const store = new PrismaPredictArenaStore({
      databaseUrl: `file:${databasePath}`
    });
    stores.push(store);
    files.push(databasePath);

    const scan = createScan();
    const markets = [createMarket('market-eth', 'ETH'), createMarket('market-btc', 'BTC')];
    const skips: SkippedMarket[] = [
      {
        marketId: 'market-sol',
        reason: 'unsupported_asset',
        question: 'Will SOL be above target?'
      }
    ];
    const runs = createRuns(markets);

    await store.saveScan({ scan, markets, skips });
    await store.saveArenaRuns(runs);
    await store.saveCommitment({
      signalId: runs[0].signal.id,
      txHash: '0xcommit-1',
      bondAmountMicroUsdc: 25_000_000,
      chainId: 5_042_002,
      committedAt: '2026-05-20T03:00:00.000Z'
    });
    await store.saveCommitment({
      signalId: runs[0].signal.id,
      txHash: '0xcommit-duplicate',
      bondAmountMicroUsdc: 25_000_000,
      chainId: 5_042_002,
      committedAt: '2026-05-20T03:05:00.000Z'
    });
    await store.saveArenaRuns(runs);

    expect(await store.getLatestScan()).toMatchObject(scan);
    expect(await store.getMarkets()).toHaveLength(2);
    expect(await store.getSkips()).toEqual(skips);
    expect(await store.getSignal(runs[0].signal.id)).toMatchObject({
      id: runs[0].signal.id,
      committedTxHash: '0xcommit-1',
      commitmentStatus: 'committed'
    });

    const stats = await store.getDashboardStats();
    expect(stats).toMatchObject({
      totalScannedMarkets: 3,
      parsedMarkets: 2,
      skippedMarkets: 1,
      generatedSignals: 2,
      committedSignals: 1,
      usdcBondedMicro: 25_000_000
    });

    const leaderboard = await store.getLeaderboard();
    expect(leaderboard).toEqual([
      {
        asset: 'ETH',
        scoreBps: 7900,
        signalCount: 1,
        committedCount: 1
      },
      {
        asset: 'BTC',
        scoreBps: 7800,
        signalCount: 1,
        committedCount: 0
      }
    ]);
  });

  it('preserves committed state and bonded stats when the same market is rescanned and rerun', async () => {
    const databasePath = path.join(tmpdir(), `predictarena-${randomUUID()}.db`);
    const store = new PrismaPredictArenaStore({
      databaseUrl: `file:${databasePath}`
    });
    stores.push(store);
    files.push(databasePath);

    const initialScan = createScanWithOverrides({
      id: 'scan-rescan-1',
      liveMarketCount: 1,
      parsedMarketCount: 1,
      skippedMarketCount: 0,
      createdAt: '2026-05-20T00:00:00.000Z'
    });
    const rescannedScan = createScanWithOverrides({
      id: 'scan-rescan-2',
      liveMarketCount: 1,
      parsedMarketCount: 1,
      skippedMarketCount: 0,
      createdAt: '2026-05-20T04:00:00.000Z'
    });
    const market = createMarket('market-eth', 'ETH');
    const initialRuns = createRuns([market]);
    const rerun = createRuns([{ ...market, yesPriceBps: 5900, noPriceBps: 4100 }]).map((run) => ({
      ...run,
      signal: {
        ...run.signal,
        confidenceBps: 8100,
        edgeBps: 1700,
        agentScoreBps: 8100,
        createdAt: '2026-05-20T05:00:00.000Z'
      }
    }));

    await store.saveScan({ scan: initialScan, markets: [market], skips: [] });
    await store.saveArenaRuns(initialRuns);
    await store.saveCommitment({
      signalId: initialRuns[0].signal.id,
      txHash: '0xrescan-commit',
      bondAmountMicroUsdc: 25_000_000,
      chainId: 5_042_002,
      committedAt: '2026-05-20T03:00:00.000Z'
    });

    await store.saveScan({
      scan: rescannedScan,
      markets: [{ ...market, yesPriceBps: 5900, noPriceBps: 4100 }],
      skips: []
    });
    await store.saveArenaRuns(rerun);

    expect(await store.getSignal(initialRuns[0].signal.id)).toMatchObject({
      id: initialRuns[0].signal.id,
      committedTxHash: '0xrescan-commit',
      commitmentStatus: 'committed',
      confidenceBps: 8100,
      agentScoreBps: 8100
    });

    expect(await store.getDashboardStats()).toMatchObject({
      totalScannedMarkets: 1,
      parsedMarkets: 1,
      skippedMarkets: 0,
      generatedSignals: 1,
      committedSignals: 1,
      usdcBondedMicro: 25_000_000
    });

    expect(await store.getLeaderboard()).toEqual([
      {
        asset: 'ETH',
        scoreBps: 8100,
        signalCount: 1,
        committedCount: 1
      }
    ]);
  });

  it('preserves committed commitments and stats when a later arena run excludes that signal', async () => {
    const databasePath = path.join(tmpdir(), `predictarena-${randomUUID()}.db`);
    const store = new PrismaPredictArenaStore({
      databaseUrl: `file:${databasePath}`
    });
    stores.push(store);
    files.push(databasePath);

    const scan = createScanWithOverrides({
      id: 'scan-shrink-1',
      liveMarketCount: 2,
      parsedMarketCount: 2,
      skippedMarketCount: 0,
      createdAt: '2026-05-20T00:00:00.000Z'
    });
    const markets = [createMarket('market-eth', 'ETH'), createMarket('market-btc', 'BTC')];
    const runs = createRuns(markets);

    await store.saveScan({ scan, markets, skips: [] });
    await store.saveArenaRuns(runs);
    await store.saveCommitment({
      signalId: runs[0].signal.id,
      txHash: '0xshrink-commit',
      bondAmountMicroUsdc: 25_000_000,
      chainId: 5_042_002,
      committedAt: '2026-05-20T03:00:00.000Z'
    });

    await store.saveArenaRuns([runs[1]]);

    expect(await store.getDashboardStats()).toMatchObject({
      totalScannedMarkets: 2,
      parsedMarkets: 2,
      skippedMarkets: 0,
      committedSignals: 1,
      usdcBondedMicro: 25_000_000
    });

    expect(await store.getLeaderboard()).toEqual([
      {
        asset: 'ETH',
        scoreBps: 7900,
        signalCount: 1,
        committedCount: 1
      },
      {
        asset: 'BTC',
        scoreBps: 7800,
        signalCount: 1,
        committedCount: 0
      }
    ]);

    await store.saveArenaRuns(runs);

    expect(await store.getSignal(runs[0].signal.id)).toMatchObject({
      id: runs[0].signal.id,
      committedTxHash: '0xshrink-commit',
      commitmentStatus: 'committed'
    });
  });
});
