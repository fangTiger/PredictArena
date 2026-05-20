import type { MarketCandidate, MarketSource, RawPolymarketMarket } from '@/lib/polymarket/types';

function parseArray(raw: RawPolymarketMarket['outcomes'] | RawPolymarketMarket['outcomePrices'] | RawPolymarketMarket['clobTokenIds']): string[] {
  if (!raw) {
    return [];
  }

  if (Array.isArray(raw)) {
    return raw.map((value) => String(value));
  }

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((value) => String(value));
    }
  } catch {
    return [];
  }

  return [];
}

function parseNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function normalizeGammaMarket(
  raw: RawPolymarketMarket,
  source: MarketSource
): MarketCandidate | null {
  const outcomes = parseArray(raw.outcomes);
  const prices = parseArray(raw.outcomePrices);

  if (outcomes.length !== 2 || prices.length !== 2) {
    return null;
  }

  const normalizedOutcomes = outcomes.map((value) => value.toLowerCase());
  if (normalizedOutcomes[0] !== 'yes' || normalizedOutcomes[1] !== 'no') {
    return null;
  }

  const yesPrice = Number(prices[0]);
  const noPrice = Number(prices[1]);
  if (!Number.isFinite(yesPrice) || !Number.isFinite(noPrice)) {
    return null;
  }

  return {
    id: raw.id,
    eventId: raw.eventId ?? raw.id,
    slug: raw.slug ?? raw.id,
    question: raw.question,
    source,
    endDate: raw.endDate ?? new Date().toISOString(),
    yesPriceBps: Math.max(0, Math.min(10_000, Math.round(yesPrice * 10_000))),
    noPriceBps: Math.max(0, Math.min(10_000, Math.round(noPrice * 10_000))),
    liquidity: parseNumber(raw.liquidityNum ?? raw.liquidity),
    volume: parseNumber(raw.volumeNum ?? raw.volume),
    active: raw.active ?? true,
    closed: raw.closed ?? false,
    clobTokenIds: parseArray(raw.clobTokenIds),
    url: raw.url ?? (raw.slug ? `https://polymarket.com/event/${raw.slug}` : null),
    rawPayload: raw as Record<string, unknown>
  };
}
