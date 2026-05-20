import type { Candle, CandleSeries, PriceSnapshot } from '@/lib/prices/types';

function standardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function annualizeLogReturns(candles: Candle[]): number {
  if (candles.length <= 1) {
    return 0;
  }

  const returns: number[] = [];
  for (let index = 1; index < candles.length; index += 1) {
    returns.push(Math.log(candles[index].close / candles[index - 1].close));
  }

  return standardDeviation(returns) * Math.sqrt(365);
}

export function buildPriceSnapshot(series: CandleSeries): PriceSnapshot {
  const candles = series.candles;
  const currentPrice = candles.at(-1)?.close ?? 0;
  const sigma7 = annualizeLogReturns(candles.slice(-8));
  const sigma30 = annualizeLogReturns(candles.slice(-31));
  const sigma = Math.max(0.1, Math.min(2.5, sigma7 * 0.65 + sigma30 * 0.35));
  const recentReturn7d =
    candles.length >= 8 ? candles.at(-1)!.close / candles.at(-8)!.close - 1 : 0;

  return {
    asset: series.asset,
    source: series.source,
    currentPrice,
    sigma7,
    sigma30,
    sigma,
    recentReturn7d,
    asOf: candles.at(-1)?.timestamp ?? new Date().toISOString()
  };
}
