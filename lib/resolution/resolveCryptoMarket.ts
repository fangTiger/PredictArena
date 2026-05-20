import type { AgentSignal } from '@/lib/polymarket/types';
import type { Candle } from '@/lib/prices/types';

export type ResolutionSkipReason =
  | 'not_committed'
  | 'already_resolved'
  | 'avoid_signal'
  | 'expiry_not_passed'
  | 'missing_candles'
  | 'missing_settlement_candle'
  | 'touch_window_empty';

export type CryptoResolutionResult =
  | {
      ok: true;
      yesOutcome: boolean;
      settlementPrice: number;
      observedAt: string;
    }
  | {
      ok: false;
      reason: ResolutionSkipReason;
    };

interface ResolveCryptoMarketInput {
  signal: AgentSignal;
  candles: Candle[];
  now?: string | Date;
}

function toTime(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function isFinitePrice(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function sortCandles(candles: Candle[]): Candle[] {
  return [...candles].sort((left, right) => left.timestamp.localeCompare(right.timestamp));
}

function pickExtremeCandle(
  candles: Candle[],
  direction: 'high' | 'low'
): { candle: Candle; price: number } | null {
  let selected: { candle: Candle; price: number } | null = null;

  for (const candle of candles) {
    const price = direction === 'high' ? candle.high : candle.low;
    if (!isFinitePrice(price)) {
      continue;
    }

    if (!selected) {
      selected = { candle, price };
      continue;
    }

    if (direction === 'high' ? price > selected.price : price < selected.price) {
      selected = { candle, price };
    }
  }

  return selected;
}

export function resolveCryptoMarket({
  signal,
  candles,
  now = new Date()
}: ResolveCryptoMarketInput): CryptoResolutionResult {
  if (signal.status !== 'committed') {
    return { ok: false, reason: 'not_committed' };
  }

  if (signal.resolution) {
    return { ok: false, reason: 'already_resolved' };
  }

  if (signal.side === 'AVOID') {
    return { ok: false, reason: 'avoid_signal' };
  }

  if (candles.length === 0) {
    return { ok: false, reason: 'missing_candles' };
  }

  const sortedCandles = sortCandles(candles);
  const nowTime = toTime(now);
  const expiryTime = toTime(signal.expiresAt);

  if (signal.conditionType === 'EXPIRY_ABOVE' || signal.conditionType === 'EXPIRY_BELOW') {
    if (nowTime < expiryTime) {
      return { ok: false, reason: 'expiry_not_passed' };
    }

    const settlement = sortedCandles
      .filter((candle) => toTime(candle.timestamp) <= expiryTime && isFinitePrice(candle.close))
      .at(-1);

    if (!settlement) {
      return { ok: false, reason: 'missing_settlement_candle' };
    }

    const yesOutcome =
      signal.conditionType === 'EXPIRY_ABOVE'
        ? settlement.close > signal.thresholdUsd
        : settlement.close < signal.thresholdUsd;

    return {
      ok: true,
      yesOutcome,
      settlementPrice: settlement.close,
      observedAt: settlement.timestamp
    };
  }

  const createdAtTime = toTime(signal.createdAt);
  const windowCandles = sortedCandles.filter((candle) => {
    const candleTime = toTime(candle.timestamp);
    return candleTime >= createdAtTime && candleTime <= expiryTime;
  });

  if (windowCandles.length === 0) {
    return { ok: false, reason: 'touch_window_empty' };
  }

  if (signal.conditionType === 'TOUCH_ABOVE') {
    const extreme = pickExtremeCandle(windowCandles, 'high');
    if (!extreme) {
      return { ok: false, reason: 'missing_candles' };
    }

    const yesOutcome = extreme.price >= signal.thresholdUsd;
    if (!yesOutcome && nowTime < expiryTime) {
      return { ok: false, reason: 'expiry_not_passed' };
    }

    return {
      ok: true,
      yesOutcome,
      settlementPrice: extreme.price,
      observedAt: extreme.candle.timestamp
    };
  }

  const extreme = pickExtremeCandle(windowCandles, 'low');
  if (!extreme) {
    return { ok: false, reason: 'missing_candles' };
  }

  const yesOutcome = extreme.price <= signal.thresholdUsd;
  if (!yesOutcome && nowTime < expiryTime) {
    return { ok: false, reason: 'expiry_not_passed' };
  }

  return {
    ok: true,
    yesOutcome,
    settlementPrice: extreme.price,
    observedAt: extreme.candle.timestamp
  };
}
