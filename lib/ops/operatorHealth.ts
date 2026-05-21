import type { ArcControlRoomState } from '@/lib/arc/controlRoom';
import type { ServerEnvConfig } from '@/lib/config/env';
import {
  createEmptyOperationsState,
  type ArenaState,
  type CommitClaimRecord,
  type OperationLockRecord
} from '@/lib/persistence/store';

export type OperatorImpact =
  | 'read_only_proof_safe'
  | 'bounded_tx_blocked'
  | 'autonomy_dry_run_or_off'
  | 'autonomy_blocked'
  | 'demo_attention_needed';

export interface OperatorHealthItem {
  reasonCode: string;
  blockingFact: string;
  impact: OperatorImpact;
  nextAction: string;
  scope: 'autonomy' | 'proof' | 'chain' | 'budget' | 'persistence';
  expiresAt?: string | null;
}

export interface OperatorHealthView {
  generatedAt: string;
  persistenceMode: 'local_atomic' | 'supabase_best_effort';
  latestRun: {
    runId: string;
    status: ArenaState['autonomyRuns'][number]['status'];
    completedAt: string;
    failureReasonCode: string | null;
  } | null;
  locks: {
    autonomy: {
      active: boolean;
      zombie: boolean;
      expiresAt: string | null;
      runId: string | null;
    };
    proof: {
      active: boolean;
      zombie: boolean;
      expiresAt: string | null;
      signalId: string | null;
    };
  };
  items: OperatorHealthItem[];
}

interface BuildOperatorHealthViewInput {
  env: ServerEnvConfig;
  state: ArenaState;
  controlRoom: ArcControlRoomState;
  now?: string;
}

function toIsoString(input?: string): string {
  return input ?? new Date().toISOString();
}

function isSameUtcDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10);
}

function isLockActive(lock: OperationLockRecord | null | undefined, now: string): boolean {
  if (!lock) {
    return false;
  }

  return new Date(lock.expiresAt).getTime() > new Date(now).getTime();
}

function isZombieLock(lock: OperationLockRecord | null | undefined, now: string): boolean {
  if (!lock) {
    return false;
  }

  return !isLockActive(lock, now);
}

function safeReadinessFact(reason: string | null): string {
  switch (reason) {
    case 'missing_agent_private_keys':
      return 'Agent wallet keys are not configured for Arc commits.';
    case 'missing_signal_bond_arena_address':
      return 'SignalBondArena contract address is not configured.';
    case 'arc_chain_mismatch':
      return 'Arc RPC chain id does not match the configured chain.';
    case 'arc_readiness_unavailable':
      return 'Arc readiness checks are currently unavailable.';
    default:
      if (reason?.startsWith('unsupported_chain_')) {
        return 'Configured Arc chain is not supported by the commit flow.';
      }
      if (reason?.startsWith('unsupported_usdc_decimals_')) {
        return 'Configured USDC decimals do not match the supported testnet asset.';
      }
      return 'Arc readiness checks are degraded.';
  }
}

function highestConfiguredStake(env: ServerEnvConfig): number {
  return Math.max(
    env.proof.maxStakePerSignalUsdc6,
    env.autonomy.policies.volatility.maxStakePerSignalUsdc6,
    env.autonomy.policies.momentum.maxStakePerSignalUsdc6
  );
}

function activeProofClaimsToday(claims: CommitClaimRecord[], now: string): CommitClaimRecord[] {
  return claims.filter(
    (claim) => claim.status !== 'failed' && isSameUtcDay(claim.updatedAt, now)
  );
}

function latestAutonomyRun(state: ArenaState): ArenaState['autonomyRuns'][number] | null {
  return [...state.autonomyRuns].sort((left, right) =>
    right.triggeredAt.localeCompare(left.triggeredAt)
  )[0] ?? null;
}

export function buildOperatorHealthView(
  input: BuildOperatorHealthViewInput
): OperatorHealthView {
  const now = toIsoString(input.now);
  const ops = input.state.ops ?? createEmptyOperationsState();
  const items: OperatorHealthItem[] = [];
  const requiredStake = highestConfiguredStake(input.env);
  const proofClaimsToday = activeProofClaimsToday(ops.proof.claims, now);
  const proofDailySpend = proofClaimsToday.reduce(
    (sum, claim) => sum + claim.stakeMicroUsdc,
    0
  );
  const autonomyLock = ops.autonomous.lock ?? null;
  const proofLock = ops.proof.lock ?? null;
  const latestRun = latestAutonomyRun(input.state);

  if (
    input.env.autonomy.policies.volatility.mode !== 'LIVE' ||
    input.env.autonomy.policies.momentum.mode !== 'LIVE'
  ) {
    items.push({
      reasonCode: 'AUTONOMY_DRY_RUN',
      blockingFact: 'One or more autonomy agents are not in LIVE mode.',
      impact: 'autonomy_dry_run_or_off',
      nextAction: 'Switch both autonomy policies to LIVE after operator review.',
      scope: 'autonomy'
    });
  }

  if (isLockActive(autonomyLock, now)) {
    items.push({
      reasonCode: 'LOCK_ACTIVE',
      blockingFact: 'An autonomous run lock is still active for the current scheduler slot.',
      impact: 'autonomy_blocked',
      nextAction: 'Wait for the lock to expire or investigate the active run before retrying.',
      scope: 'autonomy',
      expiresAt: autonomyLock?.expiresAt ?? null
    });
  } else if (isZombieLock(autonomyLock, now)) {
    items.push({
      reasonCode: 'ZOMBIE_LOCK_VISIBLE',
      blockingFact: 'A prior autonomous run lock expired without being cleared.',
      impact: 'read_only_proof_safe',
      nextAction: 'Review the previous run receipt and reconcile before re-enabling spend.',
      scope: 'autonomy',
      expiresAt: autonomyLock?.expiresAt ?? null
    });
  }

  if (isLockActive(proofLock, now)) {
    items.push({
      reasonCode: 'PROOF_LOCK_ACTIVE',
      blockingFact: 'A bounded proof transaction is already in flight.',
      impact: 'bounded_tx_blocked',
      nextAction: 'Wait for the proof lock to clear before attempting another proof transaction.',
      scope: 'proof',
      expiresAt: proofLock?.expiresAt ?? null
    });
  } else if (isZombieLock(proofLock, now)) {
    items.push({
      reasonCode: 'PROOF_LOCK_EXPIRED',
      blockingFact: 'A prior proof transaction lock expired without a clean release.',
      impact: 'bounded_tx_blocked',
      nextAction: 'Reconcile the last proof attempt before retrying a bounded transaction.',
      scope: 'proof',
      expiresAt: proofLock?.expiresAt ?? null
    });
  }

  if (ops.autonomous.claims.some((claim) => claim.status === 'uncertain')) {
    items.push({
      reasonCode: 'UNCERTAIN_CLAIM_RECONCILE_REQUIRED',
      blockingFact:
        'At least one autonomous commit claim is uncertain and may already correspond to a sent transaction.',
      impact: 'bounded_tx_blocked',
      nextAction: 'Reconcile the latest tx hash for the affected signal before any retry.',
      scope: 'autonomy'
    });
  }

  if (latestRun?.status === 'failed' || ops.autonomous.lastFailure) {
    items.push({
      reasonCode: 'LAST_RUN_FAILED',
      blockingFact: 'The latest autonomous run ended in a failed state.',
      impact: 'demo_attention_needed',
      nextAction: 'Review the latest autonomous receipt and correct the failure before the demo.',
      scope: 'autonomy'
    });
  }

  if (input.controlRoom.status === 'degraded' || !input.controlRoom.commitAvailable) {
    items.push({
      reasonCode: 'CHAIN_DEGRADED',
      blockingFact: safeReadinessFact(input.controlRoom.reason),
      impact: 'read_only_proof_safe',
      nextAction: 'Use read-only proof data only until Arc readiness returns to a healthy state.',
      scope: 'chain'
    });
  }

  const allowanceLow = Object.values(input.controlRoom.wallets).some((wallet) => {
    if (wallet.allowanceMicroUsdc === null) {
      return false;
    }

    return Number(wallet.allowanceMicroUsdc) < requiredStake;
  });
  if (allowanceLow && requiredStake > 0) {
    items.push({
      reasonCode: 'ALLOWANCE_LOW',
      blockingFact: 'At least one public agent wallet allowance is below the configured stake cap.',
      impact: 'bounded_tx_blocked',
      nextAction: 'Increase USDC allowance from the server wallet before any bounded transaction.',
      scope: 'budget'
    });
  }

  const balanceLow = Object.values(input.controlRoom.wallets).some((wallet) => {
    if (wallet.usdcBalanceMicroUsdc === null) {
      return false;
    }

    return Number(wallet.usdcBalanceMicroUsdc) < requiredStake;
  });
  if (balanceLow && requiredStake > 0) {
    items.push({
      reasonCode: 'BALANCE_LOW',
      blockingFact: 'At least one public agent wallet balance is below the configured stake cap.',
      impact: 'bounded_tx_blocked',
      nextAction: 'Top up the funded server wallet before attempting a bounded transaction.',
      scope: 'budget'
    });
  }

  if (
    input.env.proof.maxDailySpendUsdc6 > 0 &&
    proofDailySpend >= input.env.proof.maxDailySpendUsdc6
  ) {
    items.push({
      reasonCode: 'PROOF_BUDGET_EXHAUSTED',
      blockingFact: 'The configured daily proof spend cap has already been reached.',
      impact: 'bounded_tx_blocked',
      nextAction: 'Wait for the next UTC day or lower proof usage before another proof transaction.',
      scope: 'proof'
    });
  }

  if (
    input.env.proof.maxTransactionsPerDay > 0 &&
    proofClaimsToday.length >= input.env.proof.maxTransactionsPerDay
  ) {
    items.push({
      reasonCode: 'PROOF_TRANSACTION_CAP_EXHAUSTED',
      blockingFact: 'The configured daily proof transaction count cap has already been reached.',
      impact: 'bounded_tx_blocked',
      nextAction: 'Wait for the next UTC day before sending another proof transaction.',
      scope: 'proof'
    });
  }

  return {
    generatedAt: now,
    persistenceMode: input.env.supabase ? 'supabase_best_effort' : 'local_atomic',
    latestRun: latestRun
      ? {
          runId: latestRun.runId,
          status: latestRun.status ?? 'completed',
          completedAt: latestRun.completedAt,
          failureReasonCode: latestRun.failureReasonCode ?? null
        }
      : null,
    locks: {
      autonomy: {
        active: isLockActive(autonomyLock, now),
        zombie: isZombieLock(autonomyLock, now),
        expiresAt: autonomyLock?.expiresAt ?? null,
        runId: autonomyLock?.runId ?? null
      },
      proof: {
        active: isLockActive(proofLock, now),
        zombie: isZombieLock(proofLock, now),
        expiresAt: proofLock?.expiresAt ?? null,
        signalId: proofLock?.signalId ?? null
      }
    },
    items
  };
}
