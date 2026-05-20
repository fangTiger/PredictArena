import { DEFAULT_SIGNAL_BOND_MICRO_USDC } from '@/lib/config/predictarena';
import type {
  AgentForecast,
  ArenaRunResult,
  ArenaSignal,
  ParsedMarket,
  PriceFeatureSet
} from '@/types/predictarena';

function clampBps(value: number): number {
  return Math.max(1, Math.min(9_999, Math.round(value)));
}

function daysUntil(expiryAt: string, asOf: string): number {
  const diff = new Date(expiryAt).getTime() - new Date(asOf).getTime();
  return Math.max(0, diff / (24 * 60 * 60 * 1000));
}

function hoursUntil(expiryAt: string, asOf: string): number {
  const diff = new Date(expiryAt).getTime() - new Date(asOf).getTime();
  return Math.max(0, diff / (60 * 60 * 1000));
}

function computeRangeRatioBps(market: ParsedMarket, features: PriceFeatureSet): number {
  const range = Math.max(1, features.trailingHighCents - features.trailingLowCents);
  return Math.round((range * 10_000) / Math.max(1, market.thresholdCents));
}

function computeDistanceRatioBps(market: ParsedMarket, features: PriceFeatureSet): number {
  return Math.round(
    (Math.abs(market.thresholdCents - features.currentPriceCents) * 10_000) /
      Math.max(1, market.thresholdCents)
  );
}

function computeVolatilityForecast(
  market: ParsedMarket,
  features: PriceFeatureSet
): AgentForecast {
  const rangeRatioBps = computeRangeRatioBps(market, features);
  const distanceRatioBps = computeDistanceRatioBps(market, features);
  const probabilityBps = clampBps(
    5_000 +
      Math.round(rangeRatioBps * 1.5) +
      Math.round(features.realizedVolatilityBps * 0.7) +
      Math.max(0, 1_000 - distanceRatioBps) +
      Math.floor(daysUntil(market.expiryAt, features.asOf) * 0.65) +
      Math.max(0, Math.floor((market.parseConfidenceBps - 9_000) / 4))
  );

  return {
    agent: 'volatility',
    probabilityBps,
    reasons: [
      `realized volatility ${features.realizedVolatilityBps}bps`,
      `range ratio ${rangeRatioBps}bps`,
      `distance to strike ${distanceRatioBps}bps`
    ]
  };
}

function computeMomentumForecast(
  market: ParsedMarket,
  features: PriceFeatureSet
): AgentForecast {
  const range = Math.max(1, features.trailingHighCents - features.trailingLowCents);
  const rawPositionBps = Math.round(
    ((features.currentPriceCents - features.trailingLowCents) * 10_000) / range
  );
  const positionBps = Math.max(0, Math.min(10_000, rawPositionBps));
  const outcomePositionBps = market.direction === 'ABOVE' ? positionBps : 10_000 - positionBps;
  const alignedMomentumBps = market.direction === 'ABOVE' ? features.momentumBps : -features.momentumBps;
  const marketBiasBps =
    market.direction === 'ABOVE' ? market.yesPriceBps - 5_000 : market.noPriceBps - 5_000;

  const probabilityBps = clampBps(
    5_000 +
      Math.round(outcomePositionBps * 0.28) +
      alignedMomentumBps +
      Math.round(marketBiasBps * 0.36)
  );

  return {
    agent: 'momentum',
    probabilityBps,
    reasons: [
      `position in recent range ${outcomePositionBps}bps`,
      `momentum ${alignedMomentumBps}bps`,
      `market bias ${marketBiasBps}bps`
    ]
  };
}

function createSignal(
  market: ParsedMarket,
  features: PriceFeatureSet,
  volatility: AgentForecast,
  momentum: AgentForecast
): ArenaSignal {
  const yesProbabilityBps = clampBps(
    Math.round(momentum.probabilityBps * 0.65 + volatility.probabilityBps * 0.35)
  );
  const noProbabilityBps = 10_000 - yesProbabilityBps;
  const confidenceBps = Math.max(yesProbabilityBps, noProbabilityBps);
  const edgeBps =
    yesProbabilityBps >= noProbabilityBps
      ? yesProbabilityBps - market.yesPriceBps
      : noProbabilityBps - market.noPriceBps;
  const hoursRemaining = hoursUntil(market.expiryAt, features.asOf);
  const disabledReasons: string[] = [];

  if (market.liquidityScoreBps < 5_000) {
    disabledReasons.push(`liquidity below threshold (${market.liquidityScoreBps}bps)`);
  }

  if (hoursRemaining < 6) {
    disabledReasons.push(`expiry too close (${hoursRemaining.toFixed(1)}h)`);
  }

  if (confidenceBps < 5_800) {
    disabledReasons.push(`confidence too low (${confidenceBps}bps)`);
  }

  if (edgeBps < 500) {
    disabledReasons.push(`edge too small (${edgeBps}bps)`);
  }

  if (market.parseConfidenceBps < 9_000) {
    disabledReasons.push(`parse confidence too low (${market.parseConfidenceBps}bps)`);
  }

  const decision =
    disabledReasons.length > 0
      ? 'AVOID'
      : yesProbabilityBps >= noProbabilityBps
        ? 'BUY_YES'
        : 'BUY_NO';
  const eligibleForCommit =
    disabledReasons.length === 0 &&
    confidenceBps >= 7_800 &&
    edgeBps >= 1_200 &&
    market.liquidityScoreBps >= 7_000;

  return {
    id: `signal-${market.id}`,
    marketId: market.id,
    decision,
    yesProbabilityBps,
    noProbabilityBps,
    confidenceBps,
    edgeBps,
    eligibleForCommit,
    disabledReason: disabledReasons.length > 0 ? disabledReasons.join('; ') : undefined,
    bondAmountMicroUsdc: eligibleForCommit ? DEFAULT_SIGNAL_BOND_MICRO_USDC : 0,
    agentScoreBps: confidenceBps,
    reasons: [...volatility.reasons, ...momentum.reasons],
    createdAt: new Date().toISOString(),
    commitmentStatus: eligibleForCommit ? 'not_started' : 'disabled'
  };
}

export function runArenaForMarket(
  market: ParsedMarket,
  features: PriceFeatureSet
): ArenaRunResult {
  const volatility = computeVolatilityForecast(market, features);
  const momentum = computeMomentumForecast(market, features);
  const signal = createSignal(market, features, volatility, momentum);

  return {
    market,
    volatility,
    momentum,
    signal
  };
}
