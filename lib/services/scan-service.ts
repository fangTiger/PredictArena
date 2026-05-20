import { liveFetchDisabled } from '@/lib/config/predictarena';
import { getDemoSnapshotMarkets } from '@/lib/markets/demo-snapshot';
import { parsePolymarketMarket } from '@/lib/markets/parser';
import { fetchPolymarketMarkets } from '@/lib/markets/polymarket';
import type { PredictArenaStore } from '@/lib/server/store/types';
import type {
  ParsedMarket,
  RawPolymarketMarket,
  ScanRecord,
  ScanResult,
  ScanSource,
  SkippedMarket
} from '@/types/predictarena';

export interface ScanMarketsOptions {
  store: PredictArenaStore;
  fetchLiveMarkets?: () => Promise<RawPolymarketMarket[]>;
}

function nowIso(): string {
  return new Date().toISOString();
}

function createScanRecord(
  source: ScanSource,
  fallbackReason: string | undefined,
  liveMarketCount: number,
  markets: ParsedMarket[],
  skips: SkippedMarket[]
): ScanRecord {
  return {
    id: `scan-${Date.now()}`,
    source,
    fallbackReason,
    liveMarketCount,
    parsedMarketCount: markets.length,
    skippedMarketCount: skips.length,
    createdAt: nowIso()
  };
}

function parseMarkets(
  rawMarkets: RawPolymarketMarket[],
  source: ScanSource
): Pick<ScanResult, 'markets' | 'skips'> {
  const markets: ParsedMarket[] = [];
  const skips: SkippedMarket[] = [];

  for (const rawMarket of rawMarkets) {
    const parsed = parsePolymarketMarket(rawMarket, source);
    if (parsed.kind === 'parsed') {
      markets.push(parsed.market);
      continue;
    }

    skips.push({
      marketId: parsed.marketId,
      reason: parsed.reason,
      question: parsed.question
    });
  }

  return { markets, skips };
}

async function persistResult(
  store: PredictArenaStore,
  source: ScanSource,
  fallbackReason: string | undefined,
  liveMarketCount: number,
  markets: ParsedMarket[],
  skips: SkippedMarket[]
): Promise<ScanResult> {
  const scan = createScanRecord(source, fallbackReason, liveMarketCount, markets, skips);
  await store.saveScan({ scan, markets, skips });
  return { scan, markets, skips };
}

export async function scanMarkets(options: ScanMarketsOptions): Promise<ScanResult> {
  const liveFetcher = options.fetchLiveMarkets ?? (() => fetchPolymarketMarkets());

  if (liveFetchDisabled()) {
    const snapshotMarkets = getDemoSnapshotMarkets();
    const snapshotParse = parseMarkets(snapshotMarkets, 'demo_snapshot');
    return persistResult(
      options.store,
      'demo_snapshot',
      'live_fetch_disabled',
      snapshotMarkets.length,
      snapshotParse.markets,
      snapshotParse.skips
    );
  }

  try {
    const liveMarkets = await liveFetcher();
    const liveParse = parseMarkets(liveMarkets, 'live');

    if (liveParse.markets.length > 0) {
      return persistResult(
        options.store,
        'live',
        undefined,
        liveMarkets.length,
        liveParse.markets,
        liveParse.skips
      );
    }

    const snapshotMarkets = getDemoSnapshotMarkets();
    const snapshotParse = parseMarkets(snapshotMarkets, 'demo_snapshot');
    return persistResult(
      options.store,
      'demo_snapshot',
      'no_parseable_live_markets',
      snapshotMarkets.length,
      snapshotParse.markets,
      [...liveParse.skips, ...snapshotParse.skips]
    );
  } catch (error) {
    const snapshotMarkets = getDemoSnapshotMarkets();
    const snapshotParse = parseMarkets(snapshotMarkets, 'demo_snapshot');
    return persistResult(
      options.store,
      'demo_snapshot',
      error instanceof Error ? error.message : 'unknown_live_fetch_error',
      snapshotMarkets.length,
      snapshotParse.markets,
      snapshotParse.skips
    );
  }
}
