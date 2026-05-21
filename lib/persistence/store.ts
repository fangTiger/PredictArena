import path from 'node:path';
import {
  parseServerEnv,
  type AgentAutonomyPolicyConfig,
  type AutonomyMode
} from '@/lib/config/env';
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

export type AutonomyQueueStatus =
  | 'not_eligible'
  | 'mode_off'
  | 'policy_blocked'
  | 'claim_blocked'
  | 'dry_run_eligible'
  | 'committed'
  | 'commit_failed';

export interface AutonomyQueueEntry {
  signalId: string;
  agentName: AgentSignal['agentName'];
  status: AutonomyQueueStatus;
  reason: string | null;
  txHash: `0x${string}` | null;
  edgeBps: number;
  stakeMicroUsdc: number;
}

export interface AutonomyBudgetSnapshot {
  agentName: AgentSignal['agentName'];
  mode: AutonomyMode;
  dailyBondUsedUsdc6: number;
  signalsUsedToday: number;
  openSignals: number;
  policy: AgentAutonomyPolicyConfig;
}

export interface AutonomousRunRecord {
  runId: string;
  idempotencyKey?: string | null;
  scheduleWindowId?: string | null;
  status?: 'started' | 'completed' | 'failed';
  source: 'live' | 'demo_snapshot';
  triggeredAt: string;
  completedAt: string;
  marketCount: number;
  generatedSignalCount: number;
  modeByAgent: Record<AgentSignal['agentName'], AutonomyMode>;
  queue: AutonomyQueueEntry[];
  committedCount?: number;
  dryRunCount?: number;
  skippedCount?: number;
  budgetSnapshots?: AutonomyBudgetSnapshot[];
  failureReasonCode?: string | null;
  lockExpiresAt?: string | null;
}

export interface ArenaState {
  latestScan?: LatestScanState;
  markets: ParsedCryptoMarket[];
  signals: AgentSignal[];
  autonomyRuns: AutonomousRunRecord[];
  ops?: ArenaOperationsState;
  lastRun?: {
    runId: string;
    source: 'live' | 'demo_snapshot';
    generatedAt: string;
  };
}

export type CommitClaimScope = 'autonomy' | 'proof';
export type CommitClaimStatus = 'pending' | 'committed' | 'uncertain' | 'failed';

export interface OperationLockRecord {
  scope: 'autonomy' | 'proof';
  token: string;
  key: string;
  owner?: string | null;
  runId?: string | null;
  signalId?: string | null;
  acquiredAt: string;
  expiresAt: string;
}

export interface CommitClaimRecord {
  scope: CommitClaimScope;
  claimKey: string;
  signalId: string;
  agentName: AgentSignal['agentName'];
  stakeMicroUsdc: number;
  chainId: number;
  arenaAddress: `0x${string}` | null;
  runId?: string | null;
  status: CommitClaimStatus;
  reasonCode: string | null;
  txHash: `0x${string}` | null;
  createdAt: string;
  updatedAt: string;
}

export interface AutonomousFailureRecord {
  runId: string;
  reasonCode: string;
  rawDiagnostic?: string | null;
  occurredAt: string;
}

export interface ArenaOperationsState {
  autonomous: {
    lock: OperationLockRecord | null;
    claims: CommitClaimRecord[];
    lastFailure: AutonomousFailureRecord | null;
  };
  proof: {
    lock: OperationLockRecord | null;
    claims: CommitClaimRecord[];
  };
}

export interface AcquireAutonomousRunInput {
  runId: string;
  idempotencyKey: string;
  scheduleWindowId: string;
  source: 'live' | 'demo_snapshot';
  triggeredAt: string;
  lockTtlMs: number;
  owner?: string | null;
}

export type AcquireAutonomousRunResult =
  | {
      status: 'acquired';
      run: AutonomousRunRecord;
    }
  | {
      status: 'duplicate';
      duplicateBy: 'idempotency_key' | 'schedule_window';
      run: AutonomousRunRecord;
    }
  | {
      status: 'locked';
      lock: OperationLockRecord;
    };

export interface AcquireCommitClaimInput {
  scope: CommitClaimScope;
  claimKey: string;
  signalId: string;
  agentName: AgentSignal['agentName'];
  stakeMicroUsdc: number;
  chainId: number;
  arenaAddress: `0x${string}` | null;
  createdAt: string;
  runId?: string | null;
}

export interface AcquireCommitClaimResult {
  status: 'acquired' | 'existing';
  claim: CommitClaimRecord;
}

export interface UpdateCommitClaimInput {
  scope: CommitClaimScope;
  claimKey: string;
  status: CommitClaimStatus;
  updatedAt: string;
  reasonCode?: string | null;
  txHash?: `0x${string}` | null;
}

export interface AcquireOperationLockInput {
  scope: 'proof';
  key: string;
  acquiredAt: string;
  ttlMs: number;
  owner?: string | null;
  signalId?: string | null;
}

export type AcquireOperationLockResult =
  | {
      status: 'acquired';
      lock: OperationLockRecord;
    }
  | {
      status: 'locked';
      lock: OperationLockRecord;
    };

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
  openSignals: number;
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
  saveAutonomousRun(record: AutonomousRunRecord): Promise<void>;
  replaceArenaState(state: ArenaState): Promise<void>;
  getArenaState(): Promise<ArenaState>;
  getOperationsState(): Promise<ArenaOperationsState>;
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
  acquireAutonomousRun(input: AcquireAutonomousRunInput): Promise<AcquireAutonomousRunResult>;
  finalizeAutonomousRun(
    record: AutonomousRunRecord,
    options?: { rawDiagnostic?: string | null }
  ): Promise<AutonomousRunRecord>;
  acquireCommitClaim(input: AcquireCommitClaimInput): Promise<AcquireCommitClaimResult>;
  updateCommitClaim(input: UpdateCommitClaimInput): Promise<CommitClaimRecord>;
  acquireOperationLock(input: AcquireOperationLockInput): Promise<AcquireOperationLockResult>;
  releaseOperationLock(scope: 'proof', token: string): Promise<void>;
  getLeaderboard(): Promise<LeaderboardEntry[]>;
  getMetrics(): Promise<ArenaMetrics>;
}

export function createEmptyOperationsState(): ArenaOperationsState {
  return {
    autonomous: {
      lock: null,
      claims: [],
      lastFailure: null
    },
    proof: {
      lock: null,
      claims: []
    }
  };
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
