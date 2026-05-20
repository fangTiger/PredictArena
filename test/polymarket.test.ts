import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchPolymarketMarkets } from '@/lib/markets/polymarket';
import type { RawPolymarketMarket } from '@/types/predictarena';

function createMarket(id: string): RawPolymarketMarket {
  return {
    id,
    eventId: `event-${id}`,
    slug: `slug-${id}`,
    question: `Will ETH be above $${id}?`,
    endDate: '2026-07-01T23:59:00.000Z',
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.51","0.49"]',
    volumeNum: 1_000,
    liquidityNum: 2_000
  };
}

describe('fetchPolymarketMarkets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('paginates through Polymarket results and combines all pages', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [createMarket('1'), createMarket('2')]
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [createMarket('3')]
      } as Response);

    vi.stubGlobal('fetch', fetchMock);

    const markets = await fetchPolymarketMarkets({
      limit: 2,
      maxPages: 5,
      timeoutMs: 1_000
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('offset=0');
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('offset=2');
    expect(markets.map((market) => market.id)).toEqual(['1', '2', '3']);
  });
});
