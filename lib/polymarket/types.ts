export type MarketSource = 'live' | 'demo_snapshot';
export type SupportedAsset = 'BTC' | 'ETH' | 'SOL';
export type MarketConditionType =
  | 'TOUCH_ABOVE'
  | 'TOUCH_BELOW'
  | 'EXPIRY_ABOVE'
  | 'EXPIRY_BELOW';
export type SignalSide = 'YES' | 'NO' | 'AVOID';
export type SignalStatus =
  | 'generated'
  | 'committed'
  | 'resolved_correct'
  | 'resolved_incorrect';
export type ConfidenceLabel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface RawPolymarketMarket {
  id: string;
  eventId?: string | null;
  slug?: string | null;
  question: string;
  description?: string | null;
  active?: boolean | null;
  closed?: boolean | null;
  endDate?: string | null;
  outcomes?: string[] | string | null;
  outcomePrices?: string[] | string | null;
  volume?: number | string | null;
  volumeNum?: number | null;
  liquidity?: number | string | null;
  liquidityNum?: number | null;
  clobTokenIds?: string[] | string | null;
  url?: string | null;
  [key: string]: unknown;
}

export interface MarketCandidate {
  id: string;
  eventId: string;
  slug: string;
  question: string;
  source: MarketSource;
  endDate: string;
  yesPriceBps: number;
  noPriceBps: number;
  liquidity: number;
  volume: number;
  active: boolean;
  closed: boolean;
  clobTokenIds: string[];
  url: string | null;
  rawPayload: Record<string, unknown>;
}

export interface ParsedCryptoMarket extends MarketCandidate {
  asset: SupportedAsset;
  conditionType: MarketConditionType;
  thresholdUsd: number;
  expiresAt: string;
  yesMeaning: string;
  parseConfidence: number;
  scoutScoreBps: number;
}

export interface AgentSignal {
  id: string;
  runId: string;
  marketId: string;
  marketQuestion: string;
  marketUrl: string | null;
  asset: SupportedAsset;
  conditionType: MarketConditionType;
  thresholdUsd: number;
  expiresAt: string;
  agentName: 'volatility' | 'momentum';
  modelVersion: string;
  modelParams: Record<string, number | string | boolean>;
  modelHash: `0x${string}`;
  dataHash: `0x${string}`;
  side: SignalSide;
  status: SignalStatus;
  confidence: ConfidenceLabel;
  confidenceBps: number;
  marketPriceBps: number;
  agentProbabilityBps: number;
  yesPriceBps: number;
  pYesBps: number;
  edgeBps: number;
  kellyBps: number;
  stakeMicroUsdc: number;
  riskFlags: string[];
  arcTxHash: `0x${string}` | null;
  createdAt: string;
  updatedAt: string;
  source: MarketSource;
  resolution: null | {
    outcomeCorrect: boolean;
    resolvedAt: string;
  };
}
