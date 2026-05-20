import type {
  ArenaRunResult,
  ArenaSignal,
  CommitmentRecord,
  DashboardStats,
  LeaderboardEntry,
  ParsedMarket,
  ScanRecord,
  SkippedMarket
} from '@/types/predictarena';

export interface SaveScanInput {
  scan: ScanRecord;
  markets: ParsedMarket[];
  skips: SkippedMarket[];
}

export interface PredictArenaStore {
  saveScan(input: SaveScanInput): Promise<void>;
  getLatestScan(): Promise<ScanRecord | undefined>;
  getMarkets(): Promise<ParsedMarket[]>;
  getSkips(): Promise<SkippedMarket[]>;
  getMarket(id: string): Promise<ParsedMarket | undefined>;
  saveArenaRuns(runs: ArenaRunResult[]): Promise<void>;
  getSignals(): Promise<ArenaSignal[]>;
  getSignal(id: string): Promise<ArenaSignal | undefined>;
  saveCommitment(commitment: CommitmentRecord): Promise<void>;
  getDashboardStats(): Promise<DashboardStats>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
}
