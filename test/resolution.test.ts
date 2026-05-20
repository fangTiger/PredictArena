import { describe, expect, it } from 'vitest';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { Candle } from '@/lib/prices/types';

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    id: 'signal-1',
    runId: 'run-1',
    marketId: 'market-1',
    marketQuestion: 'Will BTC be above $100,000 on May 20, 2026?',
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 100000,
    expiresAt: '2026-05-20T00:00:00.000Z',
    agentName: 'volatility',
    modelVersion: 'volatility-gbm-v1',
    modelParams: { sigma: 0.7 },
    modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    side: 'YES',
    status: 'committed',
    confidence: 'HIGH',
    confidenceBps: 7600,
    marketPriceBps: 5400,
    agentProbabilityBps: 7600,
    yesPriceBps: 5400,
    pYesBps: 7600,
    edgeBps: 2200,
    kellyBps: 300,
    stakeMicroUsdc: 50000,
    riskFlags: [],
    arcTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    createdAt: '2026-05-18T00:00:00.000Z',
    updatedAt: '2026-05-18T00:00:00.000Z',
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

const candles: Candle[] = [
  {
    timestamp: '2026-05-18T00:00:00.000Z',
    open: 98_000,
    high: 99_500,
    low: 97_500,
    close: 99_000,
    volume: 100
  },
  {
    timestamp: '2026-05-19T00:00:00.000Z',
    open: 99_000,
    high: 101_000,
    low: 98_500,
    close: 100_500,
    volume: 100
  },
  {
    timestamp: '2026-05-20T00:00:00.000Z',
    open: 100_500,
    high: 102_000,
    low: 100_000,
    close: 101_200,
    volume: 100
  }
];

describe('resolveCryptoMarket', () => {
  it('resolves expiry above and below from settlement close', async () => {
    const { resolveCryptoMarket } = await import('@/lib/resolution/resolveCryptoMarket');

    expect(
      resolveCryptoMarket({
        signal: createSignal({ conditionType: 'EXPIRY_ABOVE', thresholdUsd: 100_000 }),
        candles,
        now: '2026-05-21T00:00:00.000Z'
      })
    ).toMatchObject({ ok: true, yesOutcome: true, settlementPrice: 101_200 });

    expect(
      resolveCryptoMarket({
        signal: createSignal({ conditionType: 'EXPIRY_BELOW', thresholdUsd: 100_000 }),
        candles,
        now: '2026-05-21T00:00:00.000Z'
      })
    ).toMatchObject({ ok: true, yesOutcome: false, settlementPrice: 101_200 });
  });

  it('resolves touch above and touch below from high/low window', async () => {
    const { resolveCryptoMarket } = await import('@/lib/resolution/resolveCryptoMarket');

    expect(
      resolveCryptoMarket({
        signal: createSignal({ conditionType: 'TOUCH_ABOVE', thresholdUsd: 101_000 }),
        candles,
        now: '2026-05-21T00:00:00.000Z'
      })
    ).toMatchObject({ ok: true, yesOutcome: true, settlementPrice: 102_000 });

    expect(
      resolveCryptoMarket({
        signal: createSignal({ conditionType: 'TOUCH_BELOW', thresholdUsd: 97_000 }),
        candles,
        now: '2026-05-21T00:00:00.000Z'
      })
    ).toMatchObject({ ok: true, yesOutcome: false, settlementPrice: 97_500 });
  });

  it('skips unresolved signals before expiry when touch condition has not happened', async () => {
    const { resolveCryptoMarket } = await import('@/lib/resolution/resolveCryptoMarket');

    expect(
      resolveCryptoMarket({
        signal: createSignal({ conditionType: 'TOUCH_ABOVE', thresholdUsd: 110_000 }),
        candles,
        now: '2026-05-19T12:00:00.000Z'
      })
    ).toMatchObject({ ok: false, reason: 'expiry_not_passed' });
  });
});

describe('resolution scoring', () => {
  it('computes correctness, brier, accuracy, paper ROI, and bond accounting', async () => {
    const {
      computeBrierScoreBps,
      computePaperRoiBps,
      computeResolutionAccounting,
      computeSignalCorrectness
    } = await import('@/lib/resolution/scoring');

    const yesSignal = createSignal({ side: 'YES', pYesBps: 7600, marketPriceBps: 5400 });
    const noSignal = createSignal({ side: 'NO', pYesBps: 2400, marketPriceBps: 4600 });

    expect(computeSignalCorrectness(yesSignal, true)).toBe(true);
    expect(computeSignalCorrectness(noSignal, false)).toBe(true);
    expect(computeBrierScoreBps(yesSignal, true)).toBe(576);
    expect(computePaperRoiBps(yesSignal, true)).toBe(4600);
    expect(computePaperRoiBps(yesSignal, false)).toBe(-5400);
    expect(
      computeResolutionAccounting([
        { signal: yesSignal, outcomeCorrect: true },
        { signal: noSignal, outcomeCorrect: false }
      ])
    ).toMatchObject({
      resolvedCount: 2,
      correctCount: 1,
      accuracyBps: 5000,
      refundedMicroUsdc: 50000,
      slashedMicroUsdc: 50000
    });
  });
});
