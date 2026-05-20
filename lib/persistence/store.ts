import path from 'node:path';
import { parseServerEnv } from '@/lib/config/env';
import { createLocalStore } from '@/lib/persistence/localStore';
import { createSupabaseStore } from '@/lib/persistence/supabaseStore';
import type { AgentSignal, ParsedCryptoMarket, ResolutionSource } from '@/lib/polymarket/types';

export interface LatestScanState {
  source: 'live' | 'demo_snapshot';
  fallbackReason?: string;
  scannedAt: string;
  marketCount: number;
}

export interface AgentRunRecord {
  runId: string;
  source: 'live' | 'demo_snapshot';
  generatedAt: string;
  signals: AgentSignal[];
}

export interface ArenaState {
  latestScan?: LatestScanState;
  markets: ParsedCryptoMarket[];
  signals: AgentSignal[];
  lastRun?: {
    runId: string;
    source: 'live' | 'demo_snapshot';
    generatedAt: string;
  };
}

export interface MarketScanRecord {
  source: 'live' | 'demo_snapshot';
  fallbackReason?: string;
  markets: ParsedCryptoMarket[];
}

export interface LeaderboardEntry {
  rank: number;
  agentName: 'volatility' | 'momentum';
  generatedSignals: number;
  committedSignals: number;
  resolvedSignals: number;
  accuracyBps: number;
  averageEdgeBps: number;
  totalBondedMicroUsdc: number;
  refundedMicroUsdc: number;
  slashedMicroUsdc: number;
  paperRoiBps: number;
  brierScoreBps: number | null;
  confidenceDistribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export interface ArenaMetrics {
  generatedSignals: number;
  committedSignals: number;
  resolvedSignals: number;
  averageEdgeBps: number;
  totalBondedMicroUsdc: number;
}

export interface SignalResolutionDetails {
  yesOutcome?: boolean;
  source?: ResolutionSource;
  settlementPrice?: number;
  observedAt?: string;
  onchainTxHash?: `0x${string}` | null;
}

export interface PersistenceStore {
  saveMarketScan(record: MarketScanRecord): Promise<void>;
  saveAgentRun(record: AgentRunRecord): Promise<void>;
  getArenaState(): Promise<ArenaState>;
  listSignals(): Promise<AgentSignal[]>;
  getSignal(signalId: string): Promise<AgentSignal | undefined>;
  markSignalCommitted(
    signalId: string,
    txHash: `0x${string}`,
    signalRecordId?: number | null
  ): Promise<AgentSignal>;
  resolveSignal(
    signalId: string,
    outcomeCorrect: boolean,
    resolvedAt?: string,
    details?: SignalResolutionDetails
  ): Promise<AgentSignal>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getMetrics(): Promise<ArenaMetrics>;
}

function defaultLocalStorePath(): string {
  return path.join(process.cwd(), 'data', 'runtime', 'predictarena-store.json');
}

export function createPersistenceStore(envSource: Record<string, string | undefined> = process.env): PersistenceStore {
  const env = parseServerEnv(envSource);

  if (env.supabase) {
    return createSupabaseStore({
      url: env.supabase.url,
      serviceRoleKey: env.supabase.serviceRoleKey,
      stateTable: env.supabaseStateTable
    });
  }

  return createLocalStore({
    storagePath: env.localStorePath ?? defaultLocalStorePath()
  });
}

let runtimeStore: PersistenceStore | null = null;

export function getRuntimeStore(): PersistenceStore {
  runtimeStore ??= createPersistenceStore(process.env);
  return runtimeStore;
}

export function setRuntimeStoreForTests(store: PersistenceStore): void {
  runtimeStore = store;
}

export function resetRuntimeStoreForTests(): void {
  runtimeStore = null;
}
