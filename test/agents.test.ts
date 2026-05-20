import { describe, expect, it } from 'vitest';
import type { ParsedCryptoMarket } from '@/lib/polymarket/types';
import type { PriceSnapshot } from '@/lib/prices/types';

function createMarket(overrides: Partial<ParsedCryptoMarket> = {}): ParsedCryptoMarket {
  return {
    id: 'market-btc-105k',
    eventId: 'event-btc-105k',
    slug: 'btc-touch-105k',
    question: 'Will BTC touch $105k by May 27, 2026?',
    source: 'live',
    endDate: '2026-05-27T23:59:00.000Z',
    yesPriceBps: 5400,
    noPriceBps: 4600,
    liquidity: 350_000,
    volume: 80_000,
    active: true,
    closed: false,
    clobTokenIds: ['1', '2'],
    url: 'https://polymarket.com/event/btc-touch-105k',
    rawPayload: { id: 'market-btc-105k' },
    asset: 'BTC',
    conditionType: 'TOUCH_ABOVE',
    thresholdUsd: 105_000,
    expiresAt: '2026-05-27T23:59:00.000Z',
    yesMeaning: 'YES means BTC touches $105k before expiry.',
    parseConfidence: 0.92,
    scoutScoreBps: 7800,
    ...overrides
  };
}

function createSnapshot(overrides: Partial<PriceSnapshot> = {}): PriceSnapshot {
  return {
    asset: 'BTC',
    source: 'live',
    currentPrice: 99_500,
    sigma7: 0.78,
    sigma30: 0.55,
    sigma: 0.7,
    recentReturn7d: 0.08,
    asOf: '2026-05-20T00:00:00.000Z',
    ...overrides
  };
}

describe('runAgents', () => {
  it('generates YES and NO signals with edge, Kelly, stake, and confidence', async () => {
    const { runAgents } = await import('@/lib/agents/runAgents');

    const signals = runAgents(
      [createMarket(), createMarket({ id: 'market-btc-no', yesPriceBps: 7600, noPriceBps: 2400 })],
      new Map([
        ['BTC', createSnapshot()],
        ['ETH', createSnapshot({ asset: 'ETH', currentPrice: 4_050 })],
        ['SOL', createSnapshot({ asset: 'SOL', currentPrice: 135 })]
      ]),
      {
        now: '2026-05-20T00:00:00.000Z',
        simulateProbability: ({ market, agentName }) => {
          if (market.id === 'market-btc-no') {
            return agentName === 'volatility' ? 0.24 : 0.29;
          }

          return agentName === 'volatility' ? 0.71 : 0.76;
        }
      }
    );

    const yesSignal = signals.find((signal) => signal.marketId === 'market-btc-105k' && signal.agentName === 'volatility');
    const noSignal = signals.find((signal) => signal.marketId === 'market-btc-no' && signal.agentName === 'momentum');

    expect(yesSignal?.side).toBe('YES');
    expect(yesSignal?.edgeBps).toBeGreaterThanOrEqual(700);
    expect(yesSignal?.kellyBps).toBeGreaterThan(0);
    expect(yesSignal?.stakeMicroUsdc).toBe(30_000);
    expect(yesSignal?.confidence).toBe('HIGH');

    expect(noSignal?.side).toBe('NO');
    expect(noSignal?.edgeBps).toBeGreaterThanOrEqual(700);
    expect(noSignal?.stakeMicroUsdc).toBe(50_000);
    expect(noSignal?.confidence).toBe('HIGH');
  });

  it('marks weak or missing-data signals as AVOID and preserves risk flags', async () => {
    const { runAgents } = await import('@/lib/agents/runAgents');

    const weakSignals = runAgents(
      [
        createMarket({ id: 'weak-edge', yesPriceBps: 5100, noPriceBps: 4900 }),
        createMarket({ id: 'missing-price', asset: 'SOL' })
      ],
      new Map([['BTC', createSnapshot({ currentPrice: 100_200 })]]),
      {
        now: '2026-05-20T00:00:00.000Z',
        simulateProbability: ({ market }) => (market.id === 'weak-edge' ? 0.54 : 0.72)
      }
    );

    const weak = weakSignals.find((signal) => signal.marketId === 'weak-edge' && signal.agentName === 'volatility');
    const missing = weakSignals.find((signal) => signal.marketId === 'missing-price' && signal.agentName === 'momentum');

    expect(weak?.side).toBe('AVOID');
    expect(weak?.kellyBps).toBe(0);
    expect(weak?.stakeMicroUsdc).toBe(0);

    expect(missing?.side).toBe('AVOID');
    expect(missing?.riskFlags).toContain('missing_price_snapshot');
  });
});
