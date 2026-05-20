import snapshot from '@/data/demo-snapshot/polymarket-crypto-markets.json';
import type { RawPolymarketMarket } from '@/types/predictarena';

export function getDemoSnapshotMarkets(): RawPolymarketMarket[] {
  return snapshot as RawPolymarketMarket[];
}
