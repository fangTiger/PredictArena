import demoMarkets from '@/lib/demo/markets.snapshot.json';
import { DEFAULT_MARKET_LIMIT } from '@/lib/config/constants';
import { getServerEnv, parseServerEnv } from '@/lib/config/env';
import { parseCryptoMarket } from '@/lib/parser/parseCryptoMarket';
import { normalizeGammaMarket } from '@/lib/polymarket/normalizeMarket';
import type { ParsedCryptoMarket, RawPolymarketMarket } from '@/lib/polymarket/types';

interface FetchCandidateMarketsOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  now?: string;
  limit?: number;
}

export interface FetchCandidateMarketsResult {
  source: 'live' | 'demo_snapshot';
  fallbackReason?: string;
  markets: ParsedCryptoMarket[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function computeScoutScore(market: ParsedCryptoMarket, now: Date): number {
  const liquidityScore = clamp01(market.liquidity / 500_000);
  const uncertaintyScore = 1 - Math.abs(market.yesPriceBps - 5_000) / 5_000;
  const hoursToExpiry = (new Date(market.expiresAt).getTime() - now.getTime()) / (60 * 60 * 1000);
  const timeToExpiryScore = clamp01(1 - Math.abs(hoursToExpiry - 72) / (21 * 24));
  const volumeScore = clamp01(market.volume / 200_000);

  return Math.round(
    (0.3 * liquidityScore +
      0.25 * uncertaintyScore +
      0.2 * timeToExpiryScore +
      0.15 * volumeScore +
      0.1 * market.parseConfidence) *
      10_000
  );
}

async function fetchLiveMarkets(
  fetchImpl: typeof fetch,
  gammaUrl: string
): Promise<RawPolymarketMarket[]> {
  const url = new URL(gammaUrl);
  url.searchParams.set('active', 'true');
  url.searchParams.set('closed', 'false');

  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/json'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`gamma_${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) {
    throw new Error('gamma_invalid_payload');
  }

  return payload as RawPolymarketMarket[];
}

function parseMarkets(
  rawMarkets: RawPolymarketMarket[],
  source: 'live' | 'demo_snapshot',
  now: Date,
  limit: number
): ParsedCryptoMarket[] {
  return rawMarkets
    .map((raw) => normalizeGammaMarket(raw, source))
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate))
    .filter((candidate) => candidate.active && !candidate.closed)
    .filter((candidate) => candidate.yesPriceBps >= 500 && candidate.yesPriceBps <= 9500)
    .map((candidate) => parseCryptoMarket(candidate, now))
    .filter((parsed): parsed is Extract<typeof parsed, { ok: true }> => parsed.ok)
    .map(({ market }) => ({
      ...market,
      scoutScoreBps: computeScoutScore(market, now)
    }))
    .sort((left, right) => right.scoutScoreBps - left.scoutScoreBps)
    .slice(0, limit);
}

export async function fetchCandidateMarkets(
  options: FetchCandidateMarketsOptions = {}
): Promise<FetchCandidateMarketsResult> {
  const env = options.env ? parseServerEnv(options.env) : getServerEnv();
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = new Date(options.now ?? new Date().toISOString());
  const limit = options.limit ?? DEFAULT_MARKET_LIMIT;

  try {
    const liveMarkets = await fetchLiveMarkets(fetchImpl, env.polymarketGammaUrl);
    const parsedLive = parseMarkets(liveMarkets, 'live', now, limit);
    if (parsedLive.length > 0) {
      return {
        source: 'live',
        markets: parsedLive
      };
    }

    if (!env.allowDemoSnapshot) {
      return {
        source: 'live',
        markets: []
      };
    }
  } catch (error) {
    if (!env.allowDemoSnapshot) {
      throw error;
    }

    return {
      source: 'demo_snapshot',
      fallbackReason: error instanceof Error ? error.message : 'live_fetch_failed',
      markets: parseMarkets(demoMarkets as RawPolymarketMarket[], 'demo_snapshot', now, limit)
    };
  }

  return {
    source: 'demo_snapshot',
    fallbackReason: 'no_parseable_live_markets',
    markets: parseMarkets(demoMarkets as RawPolymarketMarket[], 'demo_snapshot', now, limit)
  };
}
