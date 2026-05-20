export type SupportedAsset = 'BTC' | 'ETH' | 'SOL';
export type MarketDirection = 'ABOVE' | 'BELOW';
export type ScanSource = 'live' | 'demo_snapshot';
export type SignalDecision = 'BUY_YES' | 'BUY_NO' | 'AVOID';
export type ParseSkipReason =
  | 'ambiguous_asset'
  | 'unsupported_asset'
  | 'missing_threshold'
  | 'missing_deadline'
  | 'invalid_binary_outcomes'
  | 'missing_prices'
  | 'unsupported_direction';

export interface RawPolymarketMarket {
  id: string;
  eventId: string;
  slug: string;
  question: string;
  endDate?: string | null;
  outcomes?: string | null;
  outcomePrices?: string | null;
  volumeNum?: number | null;
  liquidityNum?: number | null;
}

export interface SkippedMarket {
  marketId: string;
  reason: ParseSkipReason;
  question?: string;
}

export interface ParsedMarket {
  id: string;
  eventId: string;
  slug: string;
  question: string;
  asset: SupportedAsset;
  direction: MarketDirection;
  thresholdCents: number;
  expiryAt: string;
  yesPriceBps: number;
  noPriceBps: number;
  liquidityScoreBps: number;
  parseConfidenceBps: number;
  source: ScanSource;
  rawPayload: Record<string, unknown>;
}

export type ParseResult =
  | {
      kind: 'parsed';
      market: ParsedMarket;
    }
  | ({
      kind: 'skipped';
    } & SkippedMarket);

export interface ScanRecord {
  id: string;
  source: ScanSource;
  fallbackReason?: string;
  liveMarketCount: number;
  parsedMarketCount: number;
  skippedMarketCount: number;
  createdAt: string;
}

export interface ScanResult {
  scan: ScanRecord;
  markets: ParsedMarket[];
  skips: SkippedMarket[];
}

export interface PriceFeatureSet {
  asset: SupportedAsset;
  asOf: string;
  currentPriceCents: number;
  trailingHighCents: number;
  trailingLowCents: number;
  realizedVolatilityBps: number;
  momentumBps: number;
}

export interface AgentForecast {
  agent: 'volatility' | 'momentum';
  probabilityBps: number;
  reasons: string[];
}

export interface ArenaSignal {
  id: string;
  marketId: string;
  decision: SignalDecision;
  yesProbabilityBps: number;
  noProbabilityBps: number;
  confidenceBps: number;
  edgeBps: number;
  eligibleForCommit: boolean;
  disabledReason?: string;
  bondAmountMicroUsdc: number;
  agentScoreBps: number;
  reasons: string[];
  createdAt: string;
  committedTxHash?: string;
  commitmentStatus: 'not_started' | 'committed' | 'disabled';
}

export interface ArenaRunResult {
  market: ParsedMarket;
  volatility: AgentForecast;
  momentum: AgentForecast;
  signal: ArenaSignal;
}

export interface CommitmentRecord {
  signalId: string;
  txHash: string;
  bondAmountMicroUsdc: number;
  chainId: number;
  committedAt: string;
}

export interface DashboardStats {
  totalScannedMarkets: number;
  parsedMarkets: number;
  skippedMarkets: number;
  generatedSignals: number;
  committedSignals: number;
  usdcBondedMicro: number;
  averageAgentScoreBps: number;
}

export interface LeaderboardEntry {
  asset: SupportedAsset;
  scoreBps: number;
  signalCount: number;
  committedCount: number;
}

export interface DashboardState {
  scan?: ScanRecord;
  markets: ParsedMarket[];
  skips: SkippedMarket[];
  signals: ArenaSignal[];
  stats: DashboardStats;
  leaderboard: LeaderboardEntry[];
  commitDisabledReason?: string;
  lastCommitResult?:
    | {
        status: 'committed';
        signalId: string;
        txHash: string;
      }
    | {
        status: 'disabled';
        signalId: string;
        reason: string;
      };
}
