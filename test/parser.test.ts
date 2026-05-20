import { describe, expect, it } from 'vitest';
import type { MarketCandidate } from '@/lib/polymarket/types';

function createCandidate(overrides: Partial<MarketCandidate> = {}): MarketCandidate {
  return {
    id: 'market-1',
    eventId: 'event-1',
    slug: 'market-1',
    question: 'Will BTC touch $100k by May 27, 2026?',
    source: 'live',
    endDate: '2026-05-27T23:59:00.000Z',
    yesPriceBps: 5300,
    noPriceBps: 4700,
    liquidity: 500_000,
    volume: 120_000,
    active: true,
    closed: false,
    clobTokenIds: ['1', '2'],
    url: 'https://polymarket.com/event/market-1',
    rawPayload: { id: 'market-1' },
    ...overrides
  };
}

describe('parseCryptoMarket', () => {
  it('parses BTC/ETH/SOL aliases, threshold formats, and condition phrases', async () => {
    const { parseCryptoMarket } = await import('@/lib/parser/parseCryptoMarket');

    const btc = parseCryptoMarket(createCandidate(), new Date('2026-05-20T00:00:00.000Z'));
    const eth = parseCryptoMarket(
      createCandidate({
        id: 'market-eth',
        question: 'Will Ether close above $4,000 on May 27, 2026?'
      }),
      new Date('2026-05-20T00:00:00.000Z')
    );
    const sol = parseCryptoMarket(
      createCandidate({
        id: 'market-sol',
        question: 'Will SOL fall below 130 by May 27, 2026?'
      }),
      new Date('2026-05-20T00:00:00.000Z')
    );

    expect(btc.ok).toBe(true);
    expect(eth.ok).toBe(true);
    expect(sol.ok).toBe(true);

    if (!btc.ok || !eth.ok || !sol.ok) {
      throw new Error('expected all crypto markets to parse');
    }

    expect(btc.market.asset).toBe('BTC');
    expect(btc.market.thresholdUsd).toBe(100_000);
    expect(btc.market.conditionType).toBe('TOUCH_ABOVE');
    expect(btc.market.parseConfidence).toBeGreaterThanOrEqual(0.7);

    expect(eth.market.asset).toBe('ETH');
    expect(eth.market.conditionType).toBe('EXPIRY_ABOVE');

    expect(sol.market.asset).toBe('SOL');
    expect(sol.market.thresholdUsd).toBe(130);
    expect(sol.market.conditionType).toBe('TOUCH_BELOW');
  });

  it('rejects expired, long-expiry, and unsupported questions', async () => {
    const { parseCryptoMarket } = await import('@/lib/parser/parseCryptoMarket');

    const expired = parseCryptoMarket(
      createCandidate({
        id: 'expired',
        endDate: '2026-05-19T23:59:00.000Z'
      }),
      new Date('2026-05-20T00:00:00.000Z')
    );
    const tooFar = parseCryptoMarket(
      createCandidate({
        id: 'too-far',
        endDate: '2026-06-30T23:59:00.000Z'
      }),
      new Date('2026-05-20T00:00:00.000Z')
    );
    const unsupported = parseCryptoMarket(
      createCandidate({
        id: 'macro',
        question: 'Will the Fed cut rates in June 2026?'
      }),
      new Date('2026-05-20T00:00:00.000Z')
    );

    expect(expired).toEqual({ ok: false, reason: 'expired_market' });
    expect(tooFar).toEqual({ ok: false, reason: 'expiry_too_far' });
    expect(unsupported).toEqual({ ok: false, reason: 'unsupported_question' });
  });
});
