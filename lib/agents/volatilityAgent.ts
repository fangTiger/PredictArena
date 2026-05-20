import { DEFAULT_MONTE_CARLO_PATHS } from '@/lib/config/constants';
import { simulateProbability } from '@/lib/math/monteCarlo';
import type { ParsedCryptoMarket } from '@/lib/polymarket/types';
import type { PriceSnapshot } from '@/lib/prices/types';

interface AgentContext {
  market: ParsedCryptoMarket;
  snapshot: PriceSnapshot;
}

export function runVolatilityAgent(
  { market, snapshot }: AgentContext,
  overrides?: {
    simulateProbability?: typeof simulateProbability;
  }
): number {
  const simulation = overrides?.simulateProbability ?? simulateProbability;
  const hoursToExpiry = Math.max(
    12,
    Math.min(
      336,
      Math.round(
        (new Date(market.expiresAt).getTime() - new Date(snapshot.asOf).getTime()) / (60 * 60 * 1000)
      )
    )
  );

  return simulation({
    S0: snapshot.currentPrice,
    K: market.thresholdUsd,
    TYears: Math.max(1 / 365, (new Date(market.expiresAt).getTime() - new Date(snapshot.asOf).getTime()) / (365 * 24 * 60 * 60 * 1000)),
    sigma: snapshot.sigma,
    mu: 0,
    conditionType: market.conditionType,
    nPaths: DEFAULT_MONTE_CARLO_PATHS,
    nSteps: hoursToExpiry,
    seed: `${market.id}:volatility`
  });
}
