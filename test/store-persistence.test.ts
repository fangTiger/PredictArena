import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFileStore } from '@/lib/server/store/file-store';
import { createInMemoryStore } from '@/lib/server/store/memory-store';
import type { PredictArenaStore } from '@/lib/server/store/types';
import type { ArenaRunResult, ParsedMarket, ScanRecord } from '@/types/predictarena';

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

function createScan(overrides: Partial<ScanRecord> = {}): ScanRecord {
  return {
    id: 'scan-1',
    source: 'live',
    liveMarketCount: 1,
    parsedMarketCount: 1,
    skippedMarketCount: 0,
    createdAt: '2026-05-20T00:00:00.000Z',
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

interface StoreHarness {
  store: PredictArenaStore;
  cleanup: () => Promise<void>;
}

async function createMemoryHarness(): Promise<StoreHarness> {
  return {
    store: createInMemoryStore(),
    cleanup: async () => undefined
  };
}

async function createFileHarness(): Promise<StoreHarness> {
  const workdir = path.join(tmpdir(), `predictarena-store-${randomUUID()}`);
  await fs.mkdir(workdir, { recursive: true });
  const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(workdir);

  return {
    store: createFileStore(),
    cleanup: async () => {
      cwdSpy.mockRestore();
      await fs.rm(workdir, { recursive: true, force: true });
    }
  };
}

describe.each([
  ['memory', createMemoryHarness],
  ['file', createFileHarness]
] satisfies [string, () => Promise<StoreHarness>][])('%s store commitment persistence', (label, createHarness) => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      if (cleanup) {
        await cleanup();
      }
    }
  });

  async function withStore(): Promise<PredictArenaStore> {
    const harness = await createHarness();
    cleanups.push(harness.cleanup);
    return harness.store;
  }

  it('preserves committed state across rescan and rerun', async () => {
    const store = await withStore();
    const market = createMarket(`market-eth-${label}`, 'ETH');
    const initialRuns = createRuns([market]);
    const rerun = createRuns([{ ...market, yesPriceBps: 5900, noPriceBps: 4100 }]);

    await store.saveScan({
      scan: createScan({ id: `scan-${label}-1` }),
      markets: [market],
      skips: []
    });
    await store.saveArenaRuns(initialRuns);
    await store.saveCommitment({
      signalId: initialRuns[0].signal.id,
      txHash: `0x${label}-rescan`,
      bondAmountMicroUsdc: 25_000_000,
      chainId: 5_042_002,
      committedAt: '2026-05-20T03:00:00.000Z'
    });

    await store.saveScan({
      scan: createScan({
        id: `scan-${label}-2`,
        createdAt: '2026-05-20T04:00:00.000Z'
      }),
      markets: [{ ...market, yesPriceBps: 5900, noPriceBps: 4100 }],
      skips: []
    });
    await store.saveArenaRuns(rerun);

    expect(await store.getSignal(initialRuns[0].signal.id)).toMatchObject({
      id: initialRuns[0].signal.id,
      committedTxHash: `0x${label}-rescan`,
      commitmentStatus: 'committed'
    });
    expect(await store.getDashboardStats()).toMatchObject({
      committedSignals: 1,
      usdcBondedMicro: 25_000_000
    });
  });

  it('preserves commitments when a later run excludes the committed signal', async () => {
    const store = await withStore();
    const markets = [
      createMarket(`market-eth-${label}`, 'ETH'),
      createMarket(`market-btc-${label}`, 'BTC')
    ];
    const runs = createRuns(markets);

    await store.saveScan({
      scan: createScan({
        id: `scan-${label}-shrink`,
        liveMarketCount: 2,
        parsedMarketCount: 2
      }),
      markets,
      skips: []
    });
    await store.saveArenaRuns(runs);
    await store.saveCommitment({
      signalId: runs[0].signal.id,
      txHash: `0x${label}-shrink`,
      bondAmountMicroUsdc: 25_000_000,
      chainId: 5_042_002,
      committedAt: '2026-05-20T03:00:00.000Z'
    });

    await store.saveArenaRuns([runs[1]]);

    expect(await store.getDashboardStats()).toMatchObject({
      committedSignals: 1,
      usdcBondedMicro: 25_000_000
    });

    await store.saveArenaRuns(runs);

    expect(await store.getSignal(runs[0].signal.id)).toMatchObject({
      id: runs[0].signal.id,
      committedTxHash: `0x${label}-shrink`,
      commitmentStatus: 'committed'
    });
  });
});
