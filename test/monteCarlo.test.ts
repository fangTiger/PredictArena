import { describe, expect, it } from 'vitest';

describe('simulateProbability', () => {
  it('is deterministic for the same seed and inputs', async () => {
    const { simulateProbability } = await import('@/lib/math/monteCarlo');

    const input = {
      S0: 100_000,
      K: 105_000,
      TYears: 7 / 365,
      sigma: 0.72,
      mu: 0.08,
      conditionType: 'EXPIRY_ABOVE' as const,
      nPaths: 2_000,
      nSteps: 48,
      seed: 'btc-volatility'
    };

    expect(simulateProbability(input)).toBe(simulateProbability(input));
  });

  it('preserves threshold monotonicity and touch probability dominance', async () => {
    const { simulateProbability } = await import('@/lib/math/monteCarlo');

    const lowStrike = simulateProbability({
      S0: 100_000,
      K: 102_000,
      TYears: 7 / 365,
      sigma: 0.7,
      mu: 0.05,
      conditionType: 'EXPIRY_ABOVE',
      nPaths: 2_500,
      nSteps: 72,
      seed: 'low-strike'
    });
    const highStrike = simulateProbability({
      S0: 100_000,
      K: 108_000,
      TYears: 7 / 365,
      sigma: 0.7,
      mu: 0.05,
      conditionType: 'EXPIRY_ABOVE',
      nPaths: 2_500,
      nSteps: 72,
      seed: 'high-strike'
    });
    const expiry = simulateProbability({
      S0: 100_000,
      K: 105_000,
      TYears: 7 / 365,
      sigma: 0.7,
      mu: 0.05,
      conditionType: 'EXPIRY_ABOVE',
      nPaths: 2_500,
      nSteps: 72,
      seed: 'same-paths'
    });
    const touch = simulateProbability({
      S0: 100_000,
      K: 105_000,
      TYears: 7 / 365,
      sigma: 0.7,
      mu: 0.05,
      conditionType: 'TOUCH_ABOVE',
      nPaths: 2_500,
      nSteps: 72,
      seed: 'same-paths'
    });

    expect(lowStrike).toBeGreaterThanOrEqual(highStrike);
    expect(touch).toBeGreaterThanOrEqual(expiry);
  });
});
