import { runAgents as defaultRunAgents } from '@/lib/agents/runAgents';
import {
  commitSignalToArena as defaultCommitSignalToArena,
  getCommitTxHashFromError
} from '@/lib/arc/commitSignal';
import {
  AUTONOMOUS_RUN_LOCK_TTL_MS,
  CRON_SCHEDULE_WINDOW_MINUTES
} from '@/lib/config/constants';
import { parseServerEnv, type ServerEnvConfig } from '@/lib/config/env';
import type {
  AutonomyBudgetSnapshot,
  AutonomyQueueEntry,
  AutonomousRunRecord,
  CommitClaimRecord,
  CommitClaimStatus,
  OperationLockRecord,
  PersistenceStore
} from '@/lib/persistence/store';
import { fetchCandidateMarkets as defaultFetchCandidateMarkets } from '@/lib/polymarket/fetchMarkets';
import type { FetchCandidateMarketsResult } from '@/lib/polymarket/fetchMarkets';
import type { AgentSignal } from '@/lib/polymarket/types';
import { fetchPriceSnapshots as defaultFetchPriceSnapshots } from '@/lib/prices/fetchCandles';
import { getSignalCommitEligibilityReason } from '@/lib/utils/signal';
import {
  createEmptyAutonomyBudgetUsage,
  evaluateAutonomyCandidate,
  type AutonomyBudgetUsage
} from '@/lib/autonomy/policy';

type AgentName = AgentSignal['agentName'];

interface RunAutonomousAgentsDeps {
  env?: ServerEnvConfig;
  now?: string;
  limit?: number;
  idempotencyKey?: string;
  scheduleWindowId?: string;
  lockTtlMs?: number;
  fetchCandidateMarkets?: (options?: { now?: string; limit?: number }) => Promise<FetchCandidateMarketsResult>;
  fetchPriceSnapshots?: typeof defaultFetchPriceSnapshots;
  runAgents?: typeof defaultRunAgents;
  commitSignalToArena?: typeof defaultCommitSignalToArena;
}

interface RunAutonomousAgentsResult {
  status: 'completed' | 'duplicate' | 'locked';
  duplicateBy?: 'idempotency_key' | 'schedule_window';
  lock?: OperationLockRecord;
  source: FetchCandidateMarketsResult['source'];
  fallbackReason?: string;
  signals: AgentSignal[];
  run: AutonomousRunRecord;
}

function toIsoString(input?: string): string {
  return input ?? new Date().toISOString();
}

function safeReasonCode(input: unknown, fallback: string): string {
  if (typeof input !== 'string') {
    return fallback;
  }

  return /^[a-z0-9_:-]+$/i.test(input) ? input : fallback;
}

export function deriveUtcScheduleWindowId(
  now: string,
  windowMinutes = CRON_SCHEDULE_WINDOW_MINUTES
): string {
  const date = new Date(now);
  const utcMinutes = date.getUTCMinutes();
  const flooredMinutes = Math.floor(utcMinutes / windowMinutes) * windowMinutes;
  const windowStart = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      flooredMinutes,
      0,
      0
    )
  );

  return `${windowStart.toISOString()}/${windowMinutes}m`;
}

export function deriveAutonomousIdempotencyKey(scheduleWindowId: string): string {
  return `cron:${scheduleWindowId}`;
}

function isSameUtcDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10);
}

function buildUsageByAgent(signals: AgentSignal[], now: string): Record<AgentName, AutonomyBudgetUsage> {
  const usage: Record<AgentName, AutonomyBudgetUsage> = {
    volatility: createEmptyAutonomyBudgetUsage(),
    momentum: createEmptyAutonomyBudgetUsage()
  };

  for (const signal of signals) {
    const agentUsage = usage[signal.agentName];

    if (signal.arcTxHash && isSameUtcDay(signal.createdAt, now)) {
      agentUsage.dailyBondUsedUsdc6 += signal.stakeMicroUsdc;
      agentUsage.signalsUsedToday += 1;
    }

    if (signal.status === 'committed' && !signal.resolution) {
      agentUsage.openSignals += 1;
    }
  }

  return usage;
}

function buildQueueEntry(
  signal: AgentSignal,
  status: AutonomyQueueEntry['status'],
  reason: string | null,
  txHash: `0x${string}` | null
): AutonomyQueueEntry {
  return {
    signalId: signal.id,
    agentName: signal.agentName,
    status,
    reason,
    txHash,
    edgeBps: signal.edgeBps,
    stakeMicroUsdc: signal.stakeMicroUsdc
  };
}

function buildBudgetSnapshots(
  env: ServerEnvConfig,
  usageByAgent: Record<AgentName, AutonomyBudgetUsage>
): AutonomyBudgetSnapshot[] {
  return (['volatility', 'momentum'] as const).map((agentName) => ({
    agentName,
    mode: env.autonomy.policies[agentName].mode,
    dailyBondUsedUsdc6: usageByAgent[agentName].dailyBondUsedUsdc6,
    signalsUsedToday: usageByAgent[agentName].signalsUsedToday,
    openSignals: usageByAgent[agentName].openSignals,
    policy: env.autonomy.policies[agentName]
  }));
}

function countQueue(queue: AutonomyQueueEntry[], status: AutonomyQueueEntry['status']): number {
  return queue.filter((entry) => entry.status === status).length;
}

function recordCommittedBudgetUsage(usage: AutonomyBudgetUsage, signal: AgentSignal): void {
  usage.dailyBondUsedUsdc6 += signal.stakeMicroUsdc;
  usage.signalsUsedToday += 1;
  usage.openSignals += 1;
}

function blockingClaimForSignal(claims: CommitClaimRecord[], signalId: string): CommitClaimRecord | null {
  return (
    [...claims]
      .filter((claim) => claim.signalId === signalId && claim.status !== 'failed')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

function claimBlockedReason(status: CommitClaimStatus): string {
  return status === 'uncertain' ? 'claim_uncertain_reconcile_required' : `claim_${status}`;
}

function buildAutonomyClaimKey(env: ServerEnvConfig, signal: AgentSignal): string {
  const arenaKey = env.arc.signalBondArenaAddress ?? 'arena-unconfigured';
  return `autonomy:${env.arc.chainId}:${arenaKey}:${signal.id}:${signal.agentName}`;
}

export async function runAutonomousAgents(
  store: PersistenceStore,
  deps: RunAutonomousAgentsDeps = {}
): Promise<RunAutonomousAgentsResult> {
  const env = deps.env ?? parseServerEnv(process.env);
  const now = toIsoString(deps.now);
  const scheduleWindowId = deps.scheduleWindowId ?? deriveUtcScheduleWindowId(now);
  const idempotencyKey = deps.idempotencyKey ?? deriveAutonomousIdempotencyKey(scheduleWindowId);
  const runId = `autonomy:${scheduleWindowId}`;
  const fetchCandidateMarkets = deps.fetchCandidateMarkets ?? defaultFetchCandidateMarkets;
  const fetchPriceSnapshots = deps.fetchPriceSnapshots ?? defaultFetchPriceSnapshots;
  const runAgents = deps.runAgents ?? defaultRunAgents;
  const commitSignalToArena = deps.commitSignalToArena ?? defaultCommitSignalToArena;
  const acquireResult = await store.acquireAutonomousRun({
    runId,
    idempotencyKey,
    scheduleWindowId,
    source: 'demo_snapshot',
    triggeredAt: now,
    lockTtlMs: deps.lockTtlMs ?? AUTONOMOUS_RUN_LOCK_TTL_MS,
    owner: 'cron'
  });

  if (acquireResult.status === 'duplicate') {
    return {
      status: 'duplicate',
      duplicateBy: acquireResult.duplicateBy,
      source: acquireResult.run.source,
      signals: [],
      run: acquireResult.run
    };
  }

  if (acquireResult.status === 'locked') {
    return {
      status: 'locked',
      lock: acquireResult.lock,
      source: 'demo_snapshot',
      signals: [],
      run: {
        runId,
        idempotencyKey,
        scheduleWindowId,
        status: 'failed',
        source: 'demo_snapshot',
        triggeredAt: now,
        completedAt: now,
        marketCount: 0,
        generatedSignalCount: 0,
        modeByAgent: {
          volatility: env.autonomy.policies.volatility.mode,
          momentum: env.autonomy.policies.momentum.mode
        },
        queue: [],
        committedCount: 0,
        dryRunCount: 0,
        skippedCount: 0,
        budgetSnapshots: buildBudgetSnapshots(env, {
          volatility: createEmptyAutonomyBudgetUsage(),
          momentum: createEmptyAutonomyBudgetUsage()
        }),
        failureReasonCode: 'autonomous_run_locked'
      }
    };
  }

  try {
    const marketResult = await fetchCandidateMarkets({
      now,
      limit: deps.limit
    });
    await store.saveMarketScan(marketResult);

    const assets = [...new Set(marketResult.markets.map((market) => market.asset))];
    const priceByAsset = await fetchPriceSnapshots(assets);
    const signals = runAgents(marketResult.markets, priceByAsset, { now });

    await store.saveAgentRun({
      runId,
      source: marketResult.source,
      generatedAt: now,
      signals
    });

    const persistedSignals = await store.listSignals();
    const usageByAgent = buildUsageByAgent(persistedSignals, now);
    const queue: AutonomyQueueEntry[] = [];

    for (const signal of signals) {
      const policy = env.autonomy.policies[signal.agentName];

      if (policy.mode === 'OFF') {
        queue.push(buildQueueEntry(signal, 'mode_off', 'mode_off', null));
        continue;
      }

      const ineligibleReason = getSignalCommitEligibilityReason(signal);
      if (ineligibleReason) {
        queue.push(buildQueueEntry(signal, 'not_eligible', ineligibleReason, null));
        continue;
      }

      const decision = evaluateAutonomyCandidate(signal, policy, usageByAgent[signal.agentName]);
      if (!decision.allowed) {
        queue.push(buildQueueEntry(signal, 'policy_blocked', decision.reason, null));
        continue;
      }

      if (policy.mode === 'DRY_RUN') {
        queue.push(buildQueueEntry(signal, 'dry_run_eligible', null, null));
        continue;
      }

      const ops = await store.getOperationsState();
      const existingClaim = blockingClaimForSignal(ops.autonomous.claims, signal.id);
      if (existingClaim) {
        queue.push(
          buildQueueEntry(
            signal,
            'claim_blocked',
            claimBlockedReason(existingClaim.status),
            existingClaim.txHash
          )
        );
        continue;
      }

      const claimKey = buildAutonomyClaimKey(env, signal);
      const claimResult = await store.acquireCommitClaim({
        scope: 'autonomy',
        claimKey,
        signalId: signal.id,
        agentName: signal.agentName,
        stakeMicroUsdc: signal.stakeMicroUsdc,
        chainId: env.arc.chainId,
        arenaAddress: env.arc.signalBondArenaAddress,
        createdAt: now,
        runId
      });
      if (claimResult.status === 'existing') {
        queue.push(
          buildQueueEntry(
            signal,
            'claim_blocked',
            claimBlockedReason(claimResult.claim.status),
            claimResult.claim.txHash
          )
        );
        continue;
      }

      let commitResult: { txHash: `0x${string}`; signalRecordId: number | null } | null = null;
      try {
        commitResult = await commitSignalToArena(store, signal);
        recordCommittedBudgetUsage(usageByAgent[signal.agentName], signal);
        await store.markSignalCommitted(signal.id, commitResult.txHash, commitResult.signalRecordId);
        await store.updateCommitClaim({
          scope: 'autonomy',
          claimKey,
          status: 'committed',
          txHash: commitResult.txHash,
          updatedAt: now
        });
        queue.push(buildQueueEntry(signal, 'committed', null, commitResult.txHash));
      } catch (error) {
        const reason = safeReasonCode(
          error instanceof Error ? error.message : null,
          'commit_failed'
        );
        const possibleTxHash = commitResult?.txHash ?? getCommitTxHashFromError(error);
        const claimStatus: CommitClaimStatus = possibleTxHash ? 'uncertain' : 'failed';
        const reasonCode = commitResult
          ? `persist_committed_signal_failed:${reason}`
          : possibleTxHash
            ? reason
            : reason;
        await store.updateCommitClaim({
          scope: 'autonomy',
          claimKey,
          status: claimStatus,
          txHash: possibleTxHash,
          reasonCode,
          updatedAt: now
        });
        queue.push(
          buildQueueEntry(
            signal,
            'commit_failed',
            commitResult ? `persist_committed_signal_failed:${reason}` : reason,
            possibleTxHash
          )
        );
      }
    }

    const completedAt = toIsoString(deps.now);
    const run: AutonomousRunRecord = {
      runId,
      idempotencyKey,
      scheduleWindowId,
      status: 'completed',
      source: marketResult.source,
      triggeredAt: now,
      completedAt,
      marketCount: marketResult.markets.length,
      generatedSignalCount: signals.length,
      modeByAgent: {
        volatility: env.autonomy.policies.volatility.mode,
        momentum: env.autonomy.policies.momentum.mode
      },
      queue,
      committedCount: countQueue(queue, 'committed'),
      dryRunCount: countQueue(queue, 'dry_run_eligible'),
      skippedCount: queue.filter((entry) =>
        ['not_eligible', 'mode_off', 'policy_blocked', 'claim_blocked', 'commit_failed'].includes(
          entry.status
        )
      ).length,
      budgetSnapshots: buildBudgetSnapshots(env, usageByAgent),
      failureReasonCode: null
    };

    const finalizedRun = await store.finalizeAutonomousRun(run);

    return {
      status: 'completed',
      source: marketResult.source,
      fallbackReason: marketResult.fallbackReason,
      signals,
      run: finalizedRun
    };
  } catch (error) {
    const failureReasonCode = safeReasonCode(
      error instanceof Error ? error.message : null,
      'autonomous_run_failed'
    );
    const failedRun = await store.finalizeAutonomousRun(
      {
        runId,
        idempotencyKey,
        scheduleWindowId,
        status: 'failed',
        source: 'demo_snapshot',
        triggeredAt: now,
        completedAt: now,
        marketCount: 0,
        generatedSignalCount: 0,
        modeByAgent: {
          volatility: env.autonomy.policies.volatility.mode,
          momentum: env.autonomy.policies.momentum.mode
        },
        queue: [],
        committedCount: 0,
        dryRunCount: 0,
        skippedCount: 0,
        budgetSnapshots: buildBudgetSnapshots(env, {
          volatility: createEmptyAutonomyBudgetUsage(),
          momentum: createEmptyAutonomyBudgetUsage()
        }),
        failureReasonCode
      },
      {
        rawDiagnostic: error instanceof Error ? error.message : null
      }
    );

    return {
      status: 'completed',
      source: failedRun.source,
      signals: [],
      run: failedRun
    };
  }
}
