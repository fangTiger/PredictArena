import { describe, expect, it } from 'vitest';
import { runArenaForMarket } from '@/lib/agents/run-arena';
import type { ParsedMarket, PriceFeatureSet } from '@/types/predictarena';

const baseMarket: ParsedMarket = {
  id: 'market-eth-4k',
  eventId: 'event-eth-4k',
  slug: 'eth-above-4k',
  question: 'Will ETH be above $4,000 on July 1, 2026?',
  asset: 'ETH',
  direction: 'ABOVE',
  thresholdCents: 400_000,
  expiryAt: '2026-07-01T23:59:00Z',
  yesPriceBps: 5600,
  noPriceBps: 4400,
  liquidityScoreBps: 8300,
  parseConfidenceBps: 9400,
  source: 'live',
  rawPayload: { origin: 'test' }
};

describe('runArenaForMarket', () => {
  it('emits a deterministic BUY_YES signal for aligned high-conviction forecasts', () => {
    const features: PriceFeatureSet = {
      asset: 'ETH',
      asOf: '2026-05-20T10:00:00Z',
      currentPriceCents: 395_000,
      trailingHighCents: 408_000,
      trailingLowCents: 372_000,
      realizedVolatilityBps: 1800,
      momentumBps: 720
    };

    const result = runArenaForMarket(baseMarket, features);

    expect(result.volatility.probabilityBps).toBe(8612);
    expect(result.momentum.probabilityBps).toBe(7725);
    expect(result.signal.decision).toBe('BUY_YES');
    expect(result.signal.eligibleForCommit).toBe(true);
    expect(result.signal.bondAmountMicroUsdc).toBe(25_000_000);
  });

  it('gates weak or stale setups into AVOID even when one agent leans YES', () => {
    const features: PriceFeatureSet = {
      asset: 'ETH',
      asOf: '2026-06-30T22:30:00Z',
      currentPriceCents: 351_000,
      trailingHighCents: 355_000,
      trailingLowCents: 344_000,
      realizedVolatilityBps: 310,
      momentumBps: 180
    };

    const result = runArenaForMarket(
      {
        ...baseMarket,
        id: 'market-eth-4k-expiring',
        expiryAt: '2026-07-01T00:30:00Z',
        liquidityScoreBps: 4100,
        yesPriceBps: 4800,
        noPriceBps: 5200
      },
      features
    );

    expect(result.signal.decision).toBe('AVOID');
    expect(result.signal.eligibleForCommit).toBe(false);
    expect(result.signal.disabledReason).toContain('liquidity');
  });
});
