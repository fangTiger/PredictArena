import { afterEach, describe, expect, it, vi } from 'vitest';

describe('normalizeGammaMarket', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes YES/NO prices, liquidity, volume, and token ids', async () => {
    const { normalizeGammaMarket } = await import('@/lib/polymarket/normalizeMarket');

    const market = normalizeGammaMarket(
      {
        id: 'gamma-btc',
        eventId: 'event-btc',
        slug: 'btc-touch-100k',
        question: 'Will BTC touch $100k by May 27, 2026?',
        endDate: '2026-05-27T23:59:00.000Z',
        outcomes: '["Yes","No"]',
        outcomePrices: '["0.53","0.47"]',
        liquidityNum: 420000,
        volumeNum: 150000,
        clobTokenIds: '["123","456"]'
      },
      'live'
    );

    expect(market).not.toBeNull();
    expect(market?.yesPriceBps).toBe(5300);
    expect(market?.noPriceBps).toBe(4700);
    expect(market?.liquidity).toBe(420000);
    expect(market?.volume).toBe(150000);
    expect(market?.clobTokenIds).toEqual(['123', '456']);
  });
});

describe('fetchCandidateMarkets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('falls back to demo snapshots when live fetch fails', async () => {
    const { fetchCandidateMarkets } = await import('@/lib/polymarket/fetchMarkets');

    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchCandidateMarkets({
      now: '2026-05-20T00:00:00.000Z',
      env: {
        ALLOW_DEMO_SNAPSHOT: 'true'
      }
    });

    expect(result.source).toBe('demo_snapshot');
    expect(result.fallbackReason).toBe('network down');
    expect(result.markets.length).toBeGreaterThan(0);
    expect(result.markets.every((market) => market.source === 'demo_snapshot')).toBe(true);
  });

  it('finds live crypto price markets from Polymarket public search event markets', async () => {
    const { fetchCandidateMarkets } = await import('@/lib/polymarket/fetchMarkets');

    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = new URL(input.toString());

      if (url.pathname === '/markets') {
        return Response.json([]);
      }

      if (url.pathname === '/public-search' && url.searchParams.get('q') === 'solana') {
        return Response.json({
          events: [
            {
              id: 'event-solana-may',
              slug: 'what-price-will-solana-hit-in-may-2026',
              title: 'What price will Solana hit in May?',
              markets: [
                {
                  id: 'live-sol-dip-80',
                  question: 'Will Solana dip to $80 in May?',
                  slug: 'will-solana-dip-to-80-in-may-2026',
                  endDate: '2026-06-01T04:00:00Z',
                  outcomes: '["Yes","No"]',
                  outcomePrices: '["0.5","0.5"]',
                  liquidityNum: 12_378,
                  volumeNum: 83_779,
                  active: true,
                  closed: false,
                  clobTokenIds: '["1","2"]'
                }
              ]
            }
          ]
        });
      }

      return Response.json({ events: [] });
    });

    const result = await fetchCandidateMarkets({
      fetchImpl: fetchMock,
      now: '2026-05-20T00:00:00.000Z',
      env: {
        ALLOW_DEMO_SNAPSHOT: 'true'
      }
    });

    expect(result.source).toBe('live');
    expect(result.markets).toHaveLength(1);
    expect(result.markets[0]).toMatchObject({
      id: 'live-sol-dip-80',
      asset: 'SOL',
      conditionType: 'TOUCH_BELOW',
      thresholdUsd: 80
    });
  });
});
