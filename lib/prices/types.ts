import type { MarketSource, SupportedAsset } from '@/lib/polymarket/types';

export interface Candle {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface CandleSeries {
  asset: SupportedAsset;
  source: MarketSource;
  quote: 'USD' | 'USDT';
  candles: Candle[];
}

export interface PriceSnapshot {
  asset: SupportedAsset;
  source: MarketSource;
  currentPrice: number;
  sigma7: number;
  sigma30: number;
  sigma: number;
  recentReturn7d: number;
  asOf: string;
}
