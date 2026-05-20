import { describe, expect, it } from 'vitest';
import { normalizeSignalIdParam } from '@/lib/utils/signal';

describe('normalizeSignalIdParam', () => {
  it('decodes encoded signal ids used in route params', () => {
    expect(normalizeSignalIdParam('demo-btc-105k%3Avolatility')).toBe(
      'demo-btc-105k:volatility'
    );
  });
});
