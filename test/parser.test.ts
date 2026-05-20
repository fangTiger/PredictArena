import { describe, expect, it } from 'vitest';
import { parsePolymarketMarket } from '@/lib/markets/parser';

const rawMarket = {
  id: 'market-btc-105k',
  eventId: 'event-btc-105k',
  slug: 'btc-above-105k-may-30',
  question: 'Will BTC be above $105,000 on May 30, 2026?',
  endDate: '2026-05-30T23:59:00Z',
  outcomes: '["Yes","No"]',
  outcomePrices: '["0.62","0.38"]',
  volumeNum: 152340,
  liquidityNum: 780000
};

describe('parsePolymarketMarket', () => {
  it('parses a confident BTC price market into normalized basis-point fields', () => {
    const result = parsePolymarketMarket(rawMarket);

    expect(result.kind).toBe('parsed');
    if (result.kind !== 'parsed') {
      throw new Error('expected parsed market');
    }

    expect(result.market.asset).toBe('BTC');
    expect(result.market.direction).toBe('ABOVE');
    expect(result.market.thresholdCents).toBe(10_500_000);
    expect(result.market.yesPriceBps).toBe(6200);
    expect(result.market.noPriceBps).toBe(3800);
    expect(result.market.parseConfidenceBps).toBeGreaterThanOrEqual(9000);
  });

  it('skips ambiguous multi-asset markets with a machine-readable reason', () => {
    const result = parsePolymarketMarket({
      ...rawMarket,
      id: 'market-multi-asset',
      question: 'Will BTC or ETH be above $100,000 by May 30, 2026?'
    });

    expect(result).toEqual({
      kind: 'skipped',
      marketId: 'market-multi-asset',
      reason: 'ambiguous_asset'
    });
  });
});
