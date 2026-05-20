import type { ParsedCryptoMarket } from '@/lib/polymarket/types';
import type { PriceSnapshot } from '@/lib/prices/types';

export interface RiskDecision {
  flags: string[];
  forceAvoid: boolean;
}

export function evaluateRisk(
  market: ParsedCryptoMarket,
  snapshot: PriceSnapshot | undefined,
  edgeBps: number,
  now: string
): RiskDecision {
  const flags: string[] = [];
  let forceAvoid = false;

  if (!snapshot) {
    flags.push('missing_price_snapshot');
    forceAvoid = true;
  }

  if (market.parseConfidence < 0.7) {
    flags.push('low_parse_confidence');
    forceAvoid = true;
  }

  if (market.liquidity < 100) {
    flags.push('low_liquidity');
  }

  if (market.yesPriceBps <= 500 || market.yesPriceBps >= 9500) {
    flags.push('extreme_market_price');
    forceAvoid = true;
  }

  const hoursToExpiry =
    (new Date(market.expiresAt).getTime() - new Date(now).getTime()) / (60 * 60 * 1000);
  if (hoursToExpiry < 1 || hoursToExpiry > 21 * 24) {
    flags.push('expiry_out_of_range');
    forceAvoid = true;
  }

  if (edgeBps < 700) {
    flags.push('edge_below_threshold');
    forceAvoid = true;
  }

  return { flags, forceAvoid };
}
