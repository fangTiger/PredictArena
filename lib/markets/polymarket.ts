import {
  POLYMARKET_FETCH_MAX_PAGES,
  POLYMARKET_FETCH_PAGE_SIZE,
  POLYMARKET_GAMMA_URL
} from '@/lib/config/predictarena';
import type { RawPolymarketMarket } from '@/types/predictarena';

interface FetchPolymarketOptions {
  limit?: number;
  maxPages?: number;
  timeoutMs?: number;
}

function buildUrl(offset: number, limit: number): URL {
  const url = new URL(POLYMARKET_GAMMA_URL);
  url.searchParams.set('active', 'true');
  url.searchParams.set('closed', 'false');
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  return url;
}

export async function fetchPolymarketMarkets(
  options: FetchPolymarketOptions = {}
): Promise<RawPolymarketMarket[]> {
  const limit = options.limit ?? POLYMARKET_FETCH_PAGE_SIZE;
  const maxPages = options.maxPages ?? POLYMARKET_FETCH_MAX_PAGES;
  const timeoutMs = options.timeoutMs ?? 6_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const markets: RawPolymarketMarket[] = [];

    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * limit;
      const response = await fetch(buildUrl(offset, limit), {
        signal: controller.signal,
        headers: {
          accept: 'application/json'
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Polymarket fetch failed with ${response.status}`);
      }

      const payload = (await response.json()) as unknown;
      if (!Array.isArray(payload)) {
        throw new Error('Polymarket payload is not an array');
      }

      const pageMarkets = payload as RawPolymarketMarket[];
      markets.push(...pageMarkets);

      if (pageMarkets.length < limit) {
        break;
      }
    }

    return markets;
  } finally {
    clearTimeout(timeout);
  }
}
