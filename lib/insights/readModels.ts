import type {
  ArenaState,
  AutonomyBudgetSnapshot,
  AutonomyQueueEntry
} from '@/lib/persistence/store';
import type { AgentSignal } from '@/lib/polymarket/types';
import { computeBrierScoreBps, computePaperRoiBps } from '@/lib/resolution/scoring';

export type SupportedAgentName = AgentSignal['agentName'];

export interface ReceiptQueueSignal {
  signalId: string;
  agentName: SupportedAgentName;
  status: AutonomyQueueEntry['status'];
  reason: string | null;
  txHash: `0x${string}` | null;
  marketQuestion: string | null;
  marketId: string | null;
  side: AgentSignal['side'] | null;
  signalStatus: AgentSignal['status'] | null;
  confidence: AgentSignal['confidence'] | null;
  edgeBps: number;
  stakeMicroUsdc: number;
  modelHash: `0x${string}` | null;
  dataHash: `0x${string}` | null;
}

export interface AutonomousRunReceiptView {
  runId: string;
  source: ArenaState['autonomyRuns'][number]['source'];
  triggeredAt: string;
  completedAt: string;
  marketCount: number;
  generatedSignalCount: number;
  modeByAgent: Record<SupportedAgentName, string>;
  committedCount: number;
  dryRunCount: number;
  skippedCount: number;
  budgetSnapshots: AutonomyBudgetSnapshot[];
  queue: ReceiptQueueSignal[];
}

export interface ReputationSignalSummary {
  signalId: string;
  marketQuestion: string;
  status: AgentSignal['status'];
  side: AgentSignal['side'];
  confidence: AgentSignal['confidence'];
  edgeBps: number;
  stakeMicroUsdc: number;
  txHash: `0x${string}` | null;
  createdAt: string;
  resolvedAt: string | null;
  outcomeCorrect: boolean | null;
  brierScoreBps: number | null;
}

export interface AgentReputationProfile {
  agentName: SupportedAgentName;
  displayName: string;
  generatedSignals: number;
  committedSignals: number;
  openSignals: number;
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
  recentSignals: ReputationSignalSummary[];
  resolvedTrail: ReputationSignalSummary[];
  bestResolvedSignal: ReputationSignalSummary | null;
  worstResolvedSignal: ReputationSignalSummary | null;
}

export interface DemoScriptSignal {
  signalId: string;
  agentName: SupportedAgentName;
  marketQuestion: string;
  side: AgentSignal['side'];
  confidence: AgentSignal['confidence'];
  edgeBps: number;
  stakeMicroUsdc: number;
  txHash: `0x${string}` | null;
  resolvedAt: string | null;
  outcomeCorrect: boolean | null;
}

export interface DemoScriptStep {
  id: 'generate' | 'commit-readiness' | 'demo-settlement' | 'leaderboard-sync' | 'verify';
  title: string;
  state: 'ready' | 'pending' | 'complete';
  detail: string;
}

export interface ResolutionDemoScriptView {
  settlementLabel: 'Demo/Admin Only';
  oracleDisclaimer: 'not an oracle';
  eligibleSignals: DemoScriptSignal[];
  recentResolvedSignals: DemoScriptSignal[];
  leaderboardSummary: Array<{
    agentName: SupportedAgentName;
    generatedSignals: number;
    committedSignals: number;
    resolvedSignals: number;
    brierScoreBps: number | null;
  }>;
  steps: DemoScriptStep[];
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function displayAgentName(agentName: SupportedAgentName): string {
  return agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';
}

function yesOutcomeFromCorrectness(signal: AgentSignal): boolean {
  if (signal.resolution?.yesOutcome !== undefined) {
    return signal.resolution.yesOutcome;
  }

  if (signal.side === 'YES') {
    return Boolean(signal.resolution?.outcomeCorrect);
  }

  if (signal.side === 'NO') {
    return !signal.resolution?.outcomeCorrect;
  }

  return false;
}

function summarizeSignal(signal: AgentSignal): ReputationSignalSummary {
  const brierScoreBps = signal.resolution
    ? computeBrierScoreBps(signal, yesOutcomeFromCorrectness(signal))
    : null;

  return {
    signalId: signal.id,
    marketQuestion: signal.marketQuestion,
    status: signal.status,
    side: signal.side,
    confidence: signal.confidence,
    edgeBps: signal.edgeBps,
    stakeMicroUsdc: signal.stakeMicroUsdc,
    txHash: signal.arcTxHash,
    createdAt: signal.createdAt,
    resolvedAt: signal.resolution?.resolvedAt ?? null,
    outcomeCorrect: signal.resolution?.outcomeCorrect ?? null,
    brierScoreBps
  };
}

function summarizeDemoSignal(signal: AgentSignal): DemoScriptSignal {
  return {
    signalId: signal.id,
    agentName: signal.agentName,
    marketQuestion: signal.marketQuestion,
    side: signal.side,
    confidence: signal.confidence,
    edgeBps: signal.edgeBps,
    stakeMicroUsdc: signal.stakeMicroUsdc,
    txHash: signal.arcTxHash,
    resolvedAt: signal.resolution?.resolvedAt ?? null,
    outcomeCorrect: signal.resolution?.outcomeCorrect ?? null
  };
}

export function buildAutonomousRunReceipt(
  state: ArenaState,
  runId: string
): AutonomousRunReceiptView | null {
  const run = state.autonomyRuns.find((entry) => entry.runId === runId);
  if (!run) {
    return null;
  }

  const signalsById = new Map(state.signals.map((signal) => [signal.id, signal] as const));

  return {
    runId: run.runId,
    source: run.source,
    triggeredAt: run.triggeredAt,
    completedAt: run.completedAt,
    marketCount: run.marketCount,
    generatedSignalCount: run.generatedSignalCount,
    modeByAgent: run.modeByAgent,
    committedCount: run.committedCount ?? 0,
    dryRunCount: run.dryRunCount ?? 0,
    skippedCount: run.skippedCount ?? 0,
    budgetSnapshots: run.budgetSnapshots ?? [],
    queue: run.queue.map((entry) => {
      const signal = signalsById.get(entry.signalId);

      return {
        signalId: entry.signalId,
        agentName: entry.agentName,
        status: entry.status,
        reason: entry.reason,
        txHash: entry.txHash,
        marketQuestion: signal?.marketQuestion ?? null,
        marketId: signal?.marketId ?? null,
        side: signal?.side ?? null,
        signalStatus: signal?.status ?? null,
        confidence: signal?.confidence ?? null,
        edgeBps: entry.edgeBps,
        stakeMicroUsdc: entry.stakeMicroUsdc,
        modelHash: signal?.modelHash ?? null,
        dataHash: signal?.dataHash ?? null
      };
    })
  };
}

export function buildAgentReputationProfile(
  state: ArenaState,
  agentName: SupportedAgentName
): AgentReputationProfile {
  const signals = state.signals.filter((signal) => signal.agentName === agentName);
  const committedSignals = signals.filter((signal) => Boolean(signal.arcTxHash));
  const openSignals = committedSignals.filter((signal) => !signal.resolution);
  const resolvedSignals = signals.filter((signal) => signal.resolution);
  const correctSignals = resolvedSignals.filter((signal) => signal.resolution?.outcomeCorrect);
  const resolvedSummaries = resolvedSignals.map(summarizeSignal);
  const brierScores = resolvedSummaries
    .map((signal) => signal.brierScoreBps)
    .filter((value): value is number => value !== null);

  const bestResolvedSignal =
    resolvedSummaries.length === 0
      ? null
      : [...resolvedSummaries].sort(
          (left, right) => (left.brierScoreBps ?? 0) - (right.brierScoreBps ?? 0)
        )[0];
  const worstResolvedSignal =
    resolvedSummaries.length === 0
      ? null
      : [...resolvedSummaries].sort(
          (left, right) => (right.brierScoreBps ?? 0) - (left.brierScoreBps ?? 0)
        )[0];

  return {
    agentName,
    displayName: displayAgentName(agentName),
    generatedSignals: signals.length,
    committedSignals: committedSignals.length,
    openSignals: openSignals.length,
    resolvedSignals: resolvedSignals.length,
    accuracyBps:
      resolvedSignals.length === 0
        ? 0
        : Math.round((correctSignals.length / resolvedSignals.length) * 10_000),
    averageEdgeBps: average(signals.map((signal) => signal.edgeBps)),
    totalBondedMicroUsdc: committedSignals.reduce(
      (sum, signal) => sum + signal.stakeMicroUsdc,
      0
    ),
    refundedMicroUsdc: resolvedSignals
      .filter((signal) => signal.resolution?.outcomeCorrect)
      .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0),
    slashedMicroUsdc: resolvedSignals
      .filter((signal) => !signal.resolution?.outcomeCorrect)
      .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0),
    paperRoiBps: average(
      resolvedSignals.map((signal) =>
        computePaperRoiBps(signal, Boolean(signal.resolution?.outcomeCorrect))
      )
    ),
    brierScoreBps: brierScores.length === 0 ? null : average(brierScores),
    confidenceDistribution: {
      low: signals.filter((signal) => signal.confidence === 'LOW').length,
      medium: signals.filter((signal) => signal.confidence === 'MEDIUM').length,
      high: signals.filter((signal) => signal.confidence === 'HIGH').length
    },
    recentSignals: signals
      .map(summarizeSignal)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 12),
    resolvedTrail: resolvedSummaries.sort((left, right) =>
      (right.resolvedAt ?? '').localeCompare(left.resolvedAt ?? '')
    ),
    bestResolvedSignal,
    worstResolvedSignal
  };
}

export function buildResolutionDemoScript(state: ArenaState): ResolutionDemoScriptView {
  const committedSignals = state.signals.filter((signal) => Boolean(signal.arcTxHash));
  const eligibleSignals = committedSignals
    .filter((signal) => !signal.resolution)
    .map(summarizeDemoSignal)
    .sort((left, right) => right.edgeBps - left.edgeBps);
  const recentResolvedSignals = committedSignals
    .filter((signal) => signal.resolution)
    .map(summarizeDemoSignal)
    .sort((left, right) => (right.resolvedAt ?? '').localeCompare(left.resolvedAt ?? ''))
    .slice(0, 8);

  const leaderboardSummary = (['volatility', 'momentum'] as const).map((agentName) => {
    const profile = buildAgentReputationProfile(state, agentName);

    return {
      agentName,
      generatedSignals: profile.generatedSignals,
      committedSignals: profile.committedSignals,
      resolvedSignals: profile.resolvedSignals,
      brierScoreBps: profile.brierScoreBps
    };
  });

  return {
    settlementLabel: 'Demo/Admin Only',
    oracleDisclaimer: 'not an oracle',
    eligibleSignals,
    recentResolvedSignals,
    leaderboardSummary,
    steps: [
      {
        id: 'generate',
        title: 'Generate Signals',
        state: state.signals.length > 0 ? 'complete' : 'pending',
        detail: 'Run agents or autonomous cron to produce deterministic market signals.'
      },
      {
        id: 'commit-readiness',
        title: 'Commit / Readiness',
        state: committedSignals.length > 0 ? 'complete' : 'pending',
        detail: 'Confirm Arc readiness and commit eligible medium/high confidence signals.'
      },
      {
        id: 'demo-settlement',
        title: 'Demo/Admin Settlement',
        state: eligibleSignals.length > 0 ? 'ready' : 'pending',
        detail: 'Use the admin token to mark one committed signal correct or incorrect.'
      },
      {
        id: 'leaderboard-sync',
        title: 'Leaderboard Sync',
        state: recentResolvedSignals.length > 0 ? 'complete' : 'pending',
        detail: 'Refresh the leaderboard after demo settlement or Arc sync.'
      },
      {
        id: 'verify',
        title: 'Verify Reputation',
        state: recentResolvedSignals.length > 0 ? 'ready' : 'pending',
        detail: 'Open the agent reputation profile and inspect Brier, refund, and slash impact.'
      }
    ]
  };
}

export function isSupportedAgentName(input: string): input is SupportedAgentName {
  return input === 'volatility' || input === 'momentum';
}
