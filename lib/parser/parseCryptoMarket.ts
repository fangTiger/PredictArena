import type {
  MarketCandidate,
  MarketConditionType,
  ParsedCryptoMarket,
  SupportedAsset
} from '@/lib/polymarket/types';

type ParseFailureReason =
  | 'unsupported_question'
  | 'expired_market'
  | 'expiry_too_far'
  | 'invalid_market';

type ParseResult =
  | {
      ok: true;
      market: ParsedCryptoMarket;
    }
  | {
      ok: false;
      reason: ParseFailureReason;
    };

const ASSET_PATTERNS: Array<{ asset: SupportedAsset; pattern: RegExp }> = [
  { asset: 'BTC', pattern: /\b(BTC|BITCOIN)\b/i },
  { asset: 'ETH', pattern: /\b(ETH|ETHER|ETHEREUM)\b/i },
  { asset: 'SOL', pattern: /\b(SOL|SOLANA)\b/i }
];

const TOUCH_ABOVE_PATTERN = /\b(touch|reach|surpass|exceed|hit)\b/i;
const TOUCH_BELOW_PATTERN = /\b(drop|fall|dip|touch below)\b/i;
const EXPIRY_ABOVE_PATTERN = /\b(close above|above|over|higher)\b/i;
const EXPIRY_BELOW_PATTERN = /\b(close below|below|under|lower)\b/i;
const THRESHOLD_PATTERN = /\$?\s*(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(k)?\b/i;

function parseThreshold(question: string): number | null {
  const match = question.match(THRESHOLD_PATTERN);
  if (!match) {
    return null;
  }

  const numeric = Number(match[1].replaceAll(',', ''));
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return match[2] ? numeric * 1_000 : numeric;
}

function parseAsset(question: string): SupportedAsset | null {
  const matches = ASSET_PATTERNS.filter(({ pattern }) => pattern.test(question));
  if (matches.length !== 1) {
    return null;
  }

  return matches[0].asset;
}

function parseCondition(question: string): MarketConditionType | null {
  if (TOUCH_BELOW_PATTERN.test(question)) {
    return 'TOUCH_BELOW';
  }

  if (TOUCH_ABOVE_PATTERN.test(question)) {
    return 'TOUCH_ABOVE';
  }

  if (EXPIRY_BELOW_PATTERN.test(question)) {
    return 'EXPIRY_BELOW';
  }

  if (EXPIRY_ABOVE_PATTERN.test(question)) {
    return 'EXPIRY_ABOVE';
  }

  return null;
}

function computeConfidence(question: string, asset: SupportedAsset, conditionType: MarketConditionType): number {
  let score = 0.75;

  if (/\$/.test(question) || /k\b/i.test(question)) {
    score += 0.08;
  }

  if (asset === 'BTC' || asset === 'ETH') {
    score += 0.05;
  }

  if (conditionType.startsWith('TOUCH')) {
    score += 0.04;
  }

  return Math.min(0.99, score);
}

function buildYesMeaning(asset: SupportedAsset, conditionType: MarketConditionType, thresholdUsd: number): string {
  const formattedThreshold = thresholdUsd.toLocaleString('en-US', { maximumFractionDigits: 2 });

  switch (conditionType) {
    case 'TOUCH_ABOVE':
      return `YES means ${asset} touches $${formattedThreshold} before expiry.`;
    case 'TOUCH_BELOW':
      return `YES means ${asset} touches below $${formattedThreshold} before expiry.`;
    case 'EXPIRY_ABOVE':
      return `YES means ${asset} closes above $${formattedThreshold} at expiry.`;
    case 'EXPIRY_BELOW':
      return `YES means ${asset} closes below $${formattedThreshold} at expiry.`;
  }
}

export function parseCryptoMarket(candidate: MarketCandidate, now = new Date()): ParseResult {
  if (!candidate.active || candidate.closed) {
    return { ok: false, reason: 'invalid_market' };
  }

  const asset = parseAsset(candidate.question);
  const thresholdUsd = parseThreshold(candidate.question);
  const conditionType = parseCondition(candidate.question);
  const expiresAt = new Date(candidate.endDate);
  const hoursToExpiry = (expiresAt.getTime() - now.getTime()) / (60 * 60 * 1000);

  if (!asset || !thresholdUsd || !conditionType || Number.isNaN(expiresAt.getTime())) {
    return { ok: false, reason: 'unsupported_question' };
  }

  if (hoursToExpiry <= 0) {
    return { ok: false, reason: 'expired_market' };
  }

  if (hoursToExpiry > 21 * 24) {
    return { ok: false, reason: 'expiry_too_far' };
  }

  const parseConfidence = computeConfidence(candidate.question, asset, conditionType);

  return {
    ok: true,
    market: {
      ...candidate,
      asset,
      conditionType,
      thresholdUsd,
      expiresAt: expiresAt.toISOString(),
      yesMeaning: buildYesMeaning(asset, conditionType, thresholdUsd),
      parseConfidence,
      scoutScoreBps: 0
    }
  };
}
