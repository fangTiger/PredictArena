import { describe, expect, it } from 'vitest';
import { createInMemoryStore } from '@/lib/server/store/memory-store';
import { scanMarkets } from '@/lib/services/scan-service';

describe('scanMarkets', () => {
  it('falls back to demo snapshot when live fetch fails', async () => {
    const store = createInMemoryStore();

    const result = await scanMarkets({
      store,
      fetchLiveMarkets: async () => {
        throw new Error('network down');
      }
    });

    expect(result.scan.source).toBe('demo_snapshot');
    expect(result.scan.fallbackReason).toContain('network down');
    expect(result.markets.length).toBeGreaterThan(0);
    expect(result.markets.every((market) => market.source === 'demo_snapshot')).toBe(true);
  });

  it('falls back to demo snapshot when live markets are unparseable', async () => {
    const store = createInMemoryStore();

    const result = await scanMarkets({
      store,
      fetchLiveMarkets: async () => [
        {
          id: 'macro-1',
          eventId: 'macro-1',
          slug: 'fed-cut-july',
          question: 'Will the Fed cut rates in July?',
          endDate: '2026-07-31T23:59:00Z',
          outcomes: '["Yes","No"]',
          outcomePrices: '["0.51","0.49"]',
          volumeNum: 1000,
          liquidityNum: 2000
        }
      ]
    });

    expect(result.scan.source).toBe('demo_snapshot');
    expect(result.scan.fallbackReason).toBe('no_parseable_live_markets');
    expect(result.skips.some((skip) => skip.reason === 'unsupported_asset')).toBe(true);
  });
});
