import { describe, expect, it } from 'vitest';

describe('stableHash', () => {
  it('returns the same hash for equivalent objects with different key order', async () => {
    const { stableHash } = await import('@/lib/utils/stableHash');

    const left = stableHash({
      asset: 'BTC',
      threshold: 105_000,
      nested: {
        side: 'YES',
        horizon: '2026-05-31T00:00:00.000Z'
      }
    });
    const right = stableHash({
      nested: {
        horizon: '2026-05-31T00:00:00.000Z',
        side: 'YES'
      },
      threshold: 105_000,
      asset: 'BTC'
    });

    expect(left).toBe(right);
    expect(left).toMatch(/^0x[0-9a-f]{64}$/);
  });
});

describe('format helpers', () => {
  it('formats basis points, micro USDC, and timestamps for UI usage', async () => {
    const { formatBps, formatIsoDateTime, formatMicroUsdc } = await import('@/lib/utils/format');

    expect(formatBps(7_345)).toBe('73.45%');
    expect(formatMicroUsdc(50_000)).toBe('$0.05');
    expect(formatIsoDateTime('2026-05-20T10:30:00.000Z')).toBe('2026-05-20 10:30 UTC');
  });
});
