import candlesSnapshot from '@/lib/demo/candles.snapshot.json';
import { getServerEnv, parseServerEnv } from '@/lib/config/env';
import type { Candle, CandleSeries, PriceSnapshot } from '@/lib/prices/types';
import type { SupportedAsset } from '@/lib/polymarket/types';
import { buildPriceSnapshot } from '@/lib/prices/volatility';

interface FetchCandlesOptions {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
}

const PRODUCT_BY_ASSET: Record<SupportedAsset, string> = {
  BTC: 'BTC-USD',
  ETH: 'ETH-USD',
  SOL: 'SOL-USD'
};

function mapSnapshotCandles(asset: SupportedAsset): CandleSeries {
  const candles = candlesSnapshot[asset] as Candle[];
  return {
    asset,
    source: 'demo_snapshot',
    quote: 'USD',
    candles
  };
}

async function fetchCoinbaseCandles(asset: SupportedAsset, fetchImpl: typeof fetch): Promise<CandleSeries> {
  const product = PRODUCT_BY_ASSET[asset];
  const response = await fetchImpl(
    `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400`,
    {
      headers: {
        accept: 'application/json'
      },
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    throw new Error(`coinbase_${response.status}`);
  }

  const payload = (await response.json()) as Array<[number, number, number, number, number, number]>;
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('coinbase_empty_payload');
  }

  const candles = payload
    .map(([time, low, high, open, close, volume]) => ({
      timestamp: new Date(time * 1000).toISOString(),
      open,
      high,
      low,
      close,
      volume
    }))
    .sort((left, right) => left.timestamp.localeCompare(right.timestamp));

  return {
    asset,
    source: 'live',
    quote: 'USD',
    candles
  };
}

export async function fetchCandles(asset: SupportedAsset, options: FetchCandlesOptions = {}): Promise<CandleSeries> {
  const env = options.env ? parseServerEnv(options.env) : getServerEnv();
  const fetchImpl = options.fetchImpl ?? fetch;

  try {
    return await fetchCoinbaseCandles(asset, fetchImpl);
  } catch {
    if (env.allowDemoSnapshot) {
      return mapSnapshotCandles(asset);
    }

    throw new Error(`candle_fetch_failed_${asset}`);
  }
}

export async function fetchPriceSnapshots(
  assets: SupportedAsset[],
  options: FetchCandlesOptions = {}
): Promise<Map<SupportedAsset, PriceSnapshot>> {
  const results = await Promise.all(
    assets.map(async (asset) => [asset, buildPriceSnapshot(await fetchCandles(asset, options))] as const)
  );

  return new Map(results);
}
