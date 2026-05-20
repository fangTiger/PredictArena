import type { ParsedMarket, PriceFeatureSet, SupportedAsset } from '@/types/predictarena';

type FeatureFixture = Omit<PriceFeatureSet, 'asset' | 'asOf'>;

const DEFAULT_FIXTURES: Record<SupportedAsset, FeatureFixture> = {
  BTC: {
    currentPriceCents: 10_350_000,
    trailingHighCents: 10_800_000,
    trailingLowCents: 9_900_000,
    realizedVolatilityBps: 2_100,
    momentumBps: 480
  },
  ETH: {
    currentPriceCents: 395_000,
    trailingHighCents: 408_000,
    trailingLowCents: 372_000,
    realizedVolatilityBps: 1_800,
    momentumBps: 720
  },
  SOL: {
    currentPriceCents: 15_200,
    trailingHighCents: 15_300,
    trailingLowCents: 14_600,
    realizedVolatilityBps: 350,
    momentumBps: 2_400
  }
};

function fixtureForMarket(market: ParsedMarket): FeatureFixture {
  if (market.id === 'demo-eth-5k') {
    return {
      currentPriceCents: 388_000,
      trailingHighCents: 402_000,
      trailingLowCents: 380_000,
      realizedVolatilityBps: 380,
      momentumBps: 120
    };
  }

  return DEFAULT_FIXTURES[market.asset];
}

export function buildPriceFeatureSet(
  market: ParsedMarket,
  asOf = new Date().toISOString()
): PriceFeatureSet {
  return {
    asset: market.asset,
    asOf,
    ...fixtureForMarket(market)
  };
}
