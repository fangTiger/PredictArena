import { DEFAULT_MONTE_CARLO_PATHS } from '@/lib/config/constants';
import { simulateProbability } from '@/lib/math/monteCarlo';
import type { ParsedCryptoMarket } from '@/lib/polymarket/types';
import type { PriceSnapshot } from '@/lib/prices/types';

interface AgentContext {
  market: ParsedCryptoMarket;
  snapshot: PriceSnapshot;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function runMomentumAgent(
  { market, snapshot }: AgentContext,
  overrides?: {
    simulateProbability?: typeof simulateProbability;
  }
): number {
  const simulation = overrides?.simulateProbability ?? simulateProbability;
  const mu = clamp(snapshot.recentReturn7d / (7 / 365), -0.75, 0.75);
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
    mu,
    conditionType: market.conditionType,
    nPaths: DEFAULT_MONTE_CARLO_PATHS,
    nSteps: hoursToExpiry,
    seed: `${market.id}:momentum`
  });
}
