import type {
  MarketDirection,
  ParseResult,
  ParsedMarket,
  RawPolymarketMarket,
  SupportedAsset
} from '@/types/predictarena';

const ASSET_PATTERNS: Array<{ asset: SupportedAsset; matcher: RegExp }> = [
  { asset: 'BTC', matcher: /\b(BTC|BITCOIN)\b/i },
  { asset: 'ETH', matcher: /\b(ETH|ETHER|ETHEREUM)\b/i },
  { asset: 'SOL', matcher: /\b(SOL|SOLANA)\b/i }
];

const THRESHOLD_PATTERN =
  /\b(above|over|below|under)\s+\$?(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/i;

function clampBps(value: number): number {
  return Math.max(0, Math.min(10_000, value));
}

type PriceParseResult =
  | {
      error: 'invalid_binary_outcomes' | 'missing_prices';
    }
  | {
      yesPriceBps: number;
      noPriceBps: number;
    };

function parseJsonArray(rawValue?: string | null): string[] | undefined {
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item));
    }
  } catch (_error) {
    return undefined;
  }

  return undefined;
}

function detectSingleAsset(question: string): SupportedAsset[] {
  return ASSET_PATTERNS.filter(({ matcher }) => matcher.test(question)).map(({ asset }) => asset);
}

function detectDirection(rawDirection: string): MarketDirection | undefined {
  if (/above|over/i.test(rawDirection)) {
    return 'ABOVE';
  }

  if (/below|under/i.test(rawDirection)) {
    return 'BELOW';
  }

  return undefined;
}

function parseThresholdCents(rawNumber: string): number {
  return Math.round(Number(rawNumber.replaceAll(',', '')) * 100);
}

function resolveExpiry(rawMarket: RawPolymarketMarket): string | undefined {
  if (rawMarket.endDate) {
    const fromField = new Date(rawMarket.endDate);
    if (!Number.isNaN(fromField.getTime())) {
      return fromField.toISOString();
    }
  }

  const questionMatch = rawMarket.question.match(
    /\b(on|by)\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i
  );
  if (!questionMatch) {
    return undefined;
  }

  const parsed = new Date(questionMatch[2]);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString();
}

function parsePrices(rawMarket: RawPolymarketMarket): PriceParseResult {
  const outcomes = parseJsonArray(rawMarket.outcomes);
  const prices = parseJsonArray(rawMarket.outcomePrices);

  if (!outcomes || outcomes.length !== 2) {
    return { error: 'invalid_binary_outcomes' as const };
  }

  const normalizedOutcomes = outcomes.map((value) => value.toLowerCase());
  if (normalizedOutcomes[0] !== 'yes' || normalizedOutcomes[1] !== 'no') {
    return { error: 'invalid_binary_outcomes' as const };
  }

  if (!prices || prices.length !== 2) {
    return { error: 'missing_prices' as const };
  }

  const yesPrice = Number(prices[0]);
  const noPrice = Number(prices[1]);

  if (!Number.isFinite(yesPrice) || !Number.isFinite(noPrice)) {
    return { error: 'missing_prices' as const };
  }

  return {
    yesPriceBps: clampBps(Math.round(yesPrice * 10_000)),
    noPriceBps: clampBps(Math.round(noPrice * 10_000))
  };
}

function computeLiquidityScoreBps(rawMarket: RawPolymarketMarket): number {
  return clampBps(Math.round((rawMarket.liquidityNum ?? 0) / 100));
}

function computeParseConfidenceBps(rawMarket: RawPolymarketMarket, asset: SupportedAsset): number {
  let score = 9_000;

  if (/\b(BTC|ETH|SOL)\b/.test(rawMarket.question)) {
    score += 200;
  }

  if (rawMarket.endDate) {
    score += 100;
  }

  if (asset === 'BTC' || asset === 'ETH') {
    score += 100;
  }

  return clampBps(score);
}

export function parsePolymarketMarket(
  rawMarket: RawPolymarketMarket,
  source: ParsedMarket['source'] = 'live'
): ParseResult {
  const assets = detectSingleAsset(rawMarket.question);
  if (assets.length > 1) {
    return {
      kind: 'skipped',
      marketId: rawMarket.id,
      reason: 'ambiguous_asset'
    };
  }

  if (assets.length === 0) {
    return {
      kind: 'skipped',
      marketId: rawMarket.id,
      reason: 'unsupported_asset'
    };
  }

  const thresholdMatch = rawMarket.question.match(THRESHOLD_PATTERN);
  if (!thresholdMatch) {
    return {
      kind: 'skipped',
      marketId: rawMarket.id,
      reason: 'missing_threshold'
    };
  }

  const direction = detectDirection(thresholdMatch[1]);
  if (!direction) {
    return {
      kind: 'skipped',
      marketId: rawMarket.id,
      reason: 'unsupported_direction'
    };
  }

  const expiryAt = resolveExpiry(rawMarket);
  if (!expiryAt) {
    return {
      kind: 'skipped',
      marketId: rawMarket.id,
      reason: 'missing_deadline'
    };
  }

  const priceResult = parsePrices(rawMarket);
  if ('error' in priceResult) {
    return {
      kind: 'skipped',
      marketId: rawMarket.id,
      reason: priceResult.error
    };
  }

  return {
    kind: 'parsed',
    market: {
      id: rawMarket.id,
      eventId: rawMarket.eventId,
      slug: rawMarket.slug,
      question: rawMarket.question,
      asset: assets[0],
      direction,
      thresholdCents: parseThresholdCents(thresholdMatch[2]),
      expiryAt,
      yesPriceBps: priceResult.yesPriceBps,
      noPriceBps: priceResult.noPriceBps,
      liquidityScoreBps: computeLiquidityScoreBps(rawMarket),
      parseConfidenceBps: computeParseConfidenceBps(rawMarket, assets[0]),
      source,
      rawPayload: rawMarket as unknown as Record<string, unknown>
    }
  };
}
