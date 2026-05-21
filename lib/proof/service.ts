import {
  commitSignalToArena as defaultCommitSignalToArena,
  getCommitTxHashFromError
} from '@/lib/arc/commitSignal';
import { getArcControlRoomState, type ArcControlRoomState } from '@/lib/arc/controlRoom';
import { PROOF_OPERATION_LOCK_TTL_MS } from '@/lib/config/constants';
import { getServerEnv, type ServerEnvConfig } from '@/lib/config/env';
import {
  buildAgentReputationProfile,
  buildAutonomousRunReceipt,
  buildResolutionDemoScript
} from '@/lib/insights/readModels';
import { buildOperatorHealthView, type OperatorHealthView } from '@/lib/ops/operatorHealth';
import { getRuntimeStore } from '@/lib/persistence/store';
import type {
  ArenaState,
  CommitClaimRecord,
  CommitClaimStatus,
  OperationLockRecord,
  PersistenceStore
} from '@/lib/persistence/store';
import { createEmptyOperationsState } from '@/lib/persistence/store';
import { getSignalCommitEligibilityReason } from '@/lib/utils/signal';
import type { AgentSignal } from '@/lib/polymarket/types';

export interface ProofEligibleSignal {
  id: string;
  agentName: AgentSignal['agentName'];
  marketQuestion: string;
  confidence: AgentSignal['confidence'];
  confidenceBps: number;
  edgeBps: number;
  stakeMicroUsdc: number;
}

export interface ProofSmokeView {
  mode: 'read_only';
  transactionAttempted: false;
  chainId: number;
  contract: {
    arenaAddress: `0x${string}` | null;
    usdcAddress: `0x${string}`;
    usdcDecimals: number;
  };
  wallets: ArcControlRoomState['wallets'];
  latestTxHash: `0x${string}` | null;
  commitPreconditions: {
    commitAvailable: boolean;
    eligibleSignalCount: number;
    blockingReasonCode: string | null;
    blockingFact: string;
    nextAction: string;
  };
  eligibleSignals: ProofEligibleSignal[];
  proofLimits: {
    maxStakePerSignalUsdc6: number;
    maxDailySpendUsdc6: number;
    maxTransactionsPerDay: number;
  };
}

export interface ProofPackView {
  generatedAt: string;
  persistenceMode: OperatorHealthView['persistenceMode'];
  smoke: ProofSmokeView;
  operatorHealth: OperatorHealthView;
  latestReceipt: ReturnType<typeof buildAutonomousRunReceipt>;
  bondedUsdcMicroUsdc: number;
  latestTxHash: `0x${string}` | null;
  topReputation: {
    agentName: AgentSignal['agentName'];
    displayName: string;
    accuracyBps: number;
    resolvedSignals: number;
    totalBondedMicroUsdc: number;
    brierScoreBps: number | null;
  } | null;
  resolutionSummary: {
    resolvedSignals: number;
    openSignals: number;
    refundedMicroUsdc: number;
    slashedMicroUsdc: number;
  };
  nextDemoAction: string;
}

export interface ProofTransactionOutcome {
  httpStatus: number;
  body: Record<string, unknown>;
}

interface ProofServiceOptions {
  env?: ServerEnvConfig;
  store?: PersistenceStore;
  now?: string;
  controlRoom?: ArcControlRoomState;
}

interface ExecuteProofTransactionOptions extends ProofServiceOptions {
  signalId: string;
  confirmTx: boolean;
  proofSecret?: string | null;
  commitSignal?: typeof defaultCommitSignalToArena;
}

interface ProofAutonomyBlocker {
  reasonCode: string;
  blockedBy: 'autonomy_lock' | 'autonomy_claim';
  blockingFact: string;
  nextAction: string;
  claimStatus?: CommitClaimStatus;
  txHash?: `0x${string}` | null;
  expiresAt?: string;
}

function toIsoString(input?: string): string {
  return input ?? new Date().toISOString();
}

function isSameUtcDay(left: string, right: string): boolean {
  return left.slice(0, 10) === right.slice(0, 10);
}

function safeReasonCode(input: unknown, fallback: string): string {
  if (typeof input !== 'string') {
    return fallback;
  }

  return /^[a-z0-9_:-]+$/i.test(input) ? input : fallback;
}

function selectTopReputation(state: ArenaState): ProofPackView['topReputation'] {
  const profiles = (['volatility', 'momentum'] as const)
    .map((agentName) => buildAgentReputationProfile(state, agentName))
    .filter((profile) => profile.generatedSignals > 0);

  const top = profiles.sort((left, right) => {
    if (right.resolvedSignals !== left.resolvedSignals) {
      return right.resolvedSignals - left.resolvedSignals;
    }
    if (right.accuracyBps !== left.accuracyBps) {
      return right.accuracyBps - left.accuracyBps;
    }
    return right.totalBondedMicroUsdc - left.totalBondedMicroUsdc;
  })[0];

  if (!top) {
    return null;
  }

  return {
    agentName: top.agentName,
    displayName: top.displayName,
    accuracyBps: top.accuracyBps,
    resolvedSignals: top.resolvedSignals,
    totalBondedMicroUsdc: top.totalBondedMicroUsdc,
    brierScoreBps: top.brierScoreBps
  };
}

function buildResolutionSummary(state: ArenaState): ProofPackView['resolutionSummary'] {
  const committedSignals = state.signals.filter((signal) => Boolean(signal.arcTxHash));
  const resolvedSignals = committedSignals.filter((signal) => signal.resolution);

  return {
    resolvedSignals: resolvedSignals.length,
    openSignals: committedSignals.filter((signal) => !signal.resolution).length,
    refundedMicroUsdc: resolvedSignals
      .filter((signal) => signal.resolution?.outcomeCorrect)
      .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0),
    slashedMicroUsdc: resolvedSignals
      .filter((signal) => !signal.resolution?.outcomeCorrect)
      .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0)
  };
}

function isLockActive(lock: OperationLockRecord | null | undefined, now: string): boolean {
  if (!lock) {
    return false;
  }

  return new Date(lock.expiresAt).getTime() > new Date(now).getTime();
}

function baseProofSignalCandidates(state: ArenaState): AgentSignal[] {
  return state.signals.filter((signal) => {
    if (signal.arcTxHash || signal.status === 'committed' || signal.resolution) {
      return false;
    }

    return getSignalCommitEligibilityReason(signal) === null;
  });
}

function baseEligibleProofSignals(state: ArenaState, env: ServerEnvConfig): AgentSignal[] {
  return baseProofSignalCandidates(state).filter(
    (signal) => signal.stakeMicroUsdc <= env.proof.maxStakePerSignalUsdc6
  );
}

function unclaimedProofSignals(signals: AgentSignal[], state: ArenaState): AgentSignal[] {
  const ops = state.ops ?? createEmptyOperationsState();
  const proofClaims = ops.proof.claims ?? [];
  const autonomyClaims = ops.autonomous.claims ?? [];

  return signals.filter(
    (signal) =>
      findBlockingProofClaim(proofClaims, signal.id) === null &&
      findBlockingAutonomyClaim(autonomyClaims, signal.id) === null
  );
}

function eligibleProofSignals(state: ArenaState, env: ServerEnvConfig): AgentSignal[] {
  return unclaimedProofSignals(baseEligibleProofSignals(state, env), state);
}

function proofAutofillSignals(state: ArenaState, env: ServerEnvConfig): AgentSignal[] {
  const eligibleSignals = eligibleProofSignals(state, env);
  if (eligibleSignals.length > 0 || env.proof.maxStakePerSignalUsdc6 > 0) {
    return eligibleSignals;
  }

  return unclaimedProofSignals(baseProofSignalCandidates(state), state);
}

function mapProofEligibleSignal(signal: AgentSignal): ProofEligibleSignal {
  return {
    id: signal.id,
    agentName: signal.agentName,
    marketQuestion: signal.marketQuestion,
    confidence: signal.confidence,
    confidenceBps: signal.confidenceBps,
    edgeBps: signal.edgeBps,
    stakeMicroUsdc: signal.stakeMicroUsdc
  };
}

function findBlockingClaim(
  claims: CommitClaimRecord[],
  signalId: string
): CommitClaimRecord | null {
  return (
    [...claims]
      .filter((claim) => claim.signalId === signalId && claim.status !== 'failed')
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null
  );
}

function findBlockingProofClaim(
  claims: CommitClaimRecord[],
  signalId: string
): CommitClaimRecord | null {
  return findBlockingClaim(claims, signalId);
}

function findBlockingAutonomyClaim(
  claims: CommitClaimRecord[],
  signalId: string
): CommitClaimRecord | null {
  return findBlockingClaim(claims, signalId);
}

function buildProofClaimKey(env: ServerEnvConfig, signal: AgentSignal): string {
  const arenaKey = env.arc.signalBondArenaAddress ?? 'arena-unconfigured';
  return `proof:${env.arc.chainId}:${arenaKey}:${signal.id}`;
}

function proofClaimsToday(claims: CommitClaimRecord[], now: string): CommitClaimRecord[] {
  return claims.filter(
    (claim) => claim.status !== 'failed' && isSameUtcDay(claim.updatedAt, now)
  );
}

function mapExistingProofClaimOutcome(claim: CommitClaimRecord): ProofTransactionOutcome {
  if (claim.status === 'uncertain') {
    return {
      httpStatus: 409,
      body: {
        reason: 'uncertain_reconcile_required',
        claimStatus: claim.status,
        txHash: claim.txHash
      }
    };
  }

  return {
    httpStatus: 409,
    body: {
      reason: 'proof_claim_exists',
      claimStatus: claim.status,
      txHash: claim.txHash
    }
  };
}

function activeAutonomyLockBlocker(
  state: ArenaState,
  now: string
): ProofAutonomyBlocker | null {
  const lock = state.ops?.autonomous.lock ?? null;
  if (!isLockActive(lock, now)) {
    return null;
  }

  return {
    reasonCode: 'autonomy_lock_active',
    blockedBy: 'autonomy_lock',
    blockingFact:
      'An autonomous run lock is still active, so bounded proof transactions are temporarily blocked.',
    nextAction: 'Wait for the autonomy lock to expire or reconcile the active run before retrying.',
    expiresAt: lock?.expiresAt
  };
}

function autonomyClaimBlocker(
  state: ArenaState,
  signalId: string
): ProofAutonomyBlocker | null {
  const claim = findBlockingAutonomyClaim(
    state.ops?.autonomous.claims ?? [],
    signalId
  );
  if (!claim) {
    return null;
  }

  switch (claim.status) {
    case 'uncertain':
      return {
        reasonCode: 'autonomy_claim_uncertain_reconcile_required',
        blockedBy: 'autonomy_claim',
        blockingFact:
          'An autonomous claim for this signal is uncertain and may already map to a sent transaction.',
        nextAction: 'Reconcile the autonomy tx for this signal before attempting proof mode.',
        claimStatus: claim.status,
        txHash: claim.txHash
      };
    case 'pending':
      return {
        reasonCode: 'autonomy_claim_pending',
        blockedBy: 'autonomy_claim',
        blockingFact:
          'An autonomous claim for this signal is still pending and blocks a second bounded transaction.',
        nextAction: 'Wait for the autonomy claim to settle before attempting proof mode.',
        claimStatus: claim.status,
        txHash: claim.txHash
      };
    default:
      return {
        reasonCode: 'autonomy_claim_committed',
        blockedBy: 'autonomy_claim',
        blockingFact:
          'An autonomous claim already committed this signal, so proof mode must not submit it again.',
        nextAction: 'Refresh or reconcile the committed signal state before attempting proof mode.',
        claimStatus: claim.status,
        txHash: claim.txHash
      };
  }
}

function commitPreconditionsFromAutonomyBlocker(
  blocker: ProofAutonomyBlocker,
  eligibleSignalCount: number
): ProofSmokeView['commitPreconditions'] {
  return {
    commitAvailable: false,
    eligibleSignalCount,
    blockingReasonCode: blocker.reasonCode,
    blockingFact: blocker.blockingFact,
    nextAction: blocker.nextAction
  };
}

function proofTransactionOutcomeFromAutonomyBlocker(
  blocker: ProofAutonomyBlocker
): ProofTransactionOutcome {
  return {
    httpStatus: 409,
    body: {
      reason: blocker.reasonCode,
      blockedBy: blocker.blockedBy,
      claimStatus: blocker.claimStatus,
      txHash: blocker.txHash,
      expiresAt: blocker.expiresAt
    }
  };
}

function buildPreconditions(
  env: ServerEnvConfig,
  state: ArenaState,
  controlRoom: ArcControlRoomState,
  operatorHealth: OperatorHealthView
): ProofSmokeView['commitPreconditions'] {
  const candidateSignals = baseEligibleProofSignals(state, env);
  const eligibleSignals = eligibleProofSignals(state, env);
  const txBlocked = operatorHealth.items.some(
    (item) => item.impact === 'bounded_tx_blocked' && item.scope !== 'autonomy'
  );
  const autonomyLockBlocker = activeAutonomyLockBlocker(state, operatorHealth.generatedAt);

  if (!controlRoom.commitAvailable) {
    return {
      commitAvailable: false,
      eligibleSignalCount: eligibleSignals.length,
      blockingReasonCode: 'chain_degraded',
      blockingFact: 'Read-only proof is safe, but Arc commit readiness is degraded.',
      nextAction: 'Restore Arc readiness before attempting any bounded proof transaction.'
    };
  }

  if (
    !env.proof.secret ||
    env.proof.maxStakePerSignalUsdc6 <= 0 ||
    env.proof.maxDailySpendUsdc6 <= 0 ||
    env.proof.maxTransactionsPerDay <= 0
  ) {
    return {
      commitAvailable: false,
      eligibleSignalCount: eligibleSignals.length,
      blockingReasonCode: 'proof_tx_disabled',
      blockingFact: 'Proof transaction authorization or stake caps are not configured.',
      nextAction: 'Configure a proof secret and finite proof caps before enabling proof tx.'
    };
  }

  if (autonomyLockBlocker) {
    return commitPreconditionsFromAutonomyBlocker(
      autonomyLockBlocker,
      eligibleSignals.length
    );
  }

  if (txBlocked) {
    return {
      commitAvailable: false,
      eligibleSignalCount: eligibleSignals.length,
      blockingReasonCode: 'bounded_tx_blocked',
      blockingFact: 'A bounded proof transaction is currently blocked by budget, lock, or claim state.',
      nextAction: 'Resolve the blocking health items before attempting a proof tx.'
    };
  }

  if (eligibleSignals.length === 0) {
    const autonomyClaimedCandidate = candidateSignals.find(
      (signal) => autonomyClaimBlocker(state, signal.id) !== null
    );
    if (autonomyClaimedCandidate) {
      return commitPreconditionsFromAutonomyBlocker(
        autonomyClaimBlocker(state, autonomyClaimedCandidate.id)!,
        eligibleSignals.length
      );
    }

    return {
      commitAvailable: false,
      eligibleSignalCount: 0,
      blockingReasonCode: 'no_eligible_signal',
      blockingFact: 'No eligible uncommitted signal is available for a bounded proof transaction.',
      nextAction: 'Run agents or wait for a new eligible signal before attempting proof tx.'
    };
  }

  return {
    commitAvailable: true,
    eligibleSignalCount: eligibleSignals.length,
    blockingReasonCode: null,
    blockingFact: 'Read-only proof is healthy and a bounded proof transaction can be attempted.',
    nextAction: 'Select an eligible signal id and provide the proof secret to send one bounded tx.'
  };
}

async function getStateAndHealth(options: ProofServiceOptions): Promise<{
  env: ServerEnvConfig;
  store: PersistenceStore;
  state: ArenaState;
  controlRoom: ArcControlRoomState;
  operatorHealth: OperatorHealthView;
  now: string;
}> {
  const env = options.env ?? getServerEnv();
  const store = options.store ?? getRuntimeStore();
  const now = toIsoString(options.now);
  const [state, controlRoom] = await Promise.all([
    store.getArenaState(),
    options.controlRoom ? Promise.resolve(options.controlRoom) : getArcControlRoomState({ env, store })
  ]);
  const operatorHealth = buildOperatorHealthView({
    env,
    state,
    controlRoom,
    now
  });

  return {
    env,
    store,
    state,
    controlRoom,
    operatorHealth,
    now
  };
}

export async function getProofSmokeView(
  options: ProofServiceOptions = {}
): Promise<ProofSmokeView> {
  const { env, state, controlRoom, operatorHealth } = await getStateAndHealth(options);
  const eligibleSignals = proofAutofillSignals(state, env);

  return {
    mode: 'read_only',
    transactionAttempted: false,
    chainId: controlRoom.chainId,
    contract: {
      arenaAddress: controlRoom.arenaAddress,
      usdcAddress: controlRoom.usdcAddress,
      usdcDecimals: controlRoom.usdcDecimals
    },
    wallets: controlRoom.wallets,
    latestTxHash: controlRoom.latestTxHash,
    commitPreconditions: buildPreconditions(env, state, controlRoom, operatorHealth),
    eligibleSignals: eligibleSignals.map(mapProofEligibleSignal),
    proofLimits: {
      maxStakePerSignalUsdc6: env.proof.maxStakePerSignalUsdc6,
      maxDailySpendUsdc6: env.proof.maxDailySpendUsdc6,
      maxTransactionsPerDay: env.proof.maxTransactionsPerDay
    }
  };
}

export async function buildProofPackView(
  options: ProofServiceOptions = {}
): Promise<ProofPackView> {
  const { state, operatorHealth, now } = await getStateAndHealth(options);
  const smoke = await getProofSmokeView(options);
  const latestRun =
    [...state.autonomyRuns].sort((left, right) => right.triggeredAt.localeCompare(left.triggeredAt))[0] ??
    null;
  const script = buildResolutionDemoScript(state);
  const resolutionSummary = buildResolutionSummary(state);

  let nextDemoAction = smoke.commitPreconditions.nextAction;
  if (script.steps.some((step) => step.id === 'demo-settlement' && step.state === 'ready')) {
    nextDemoAction = 'Use the demo settlement script to walk judges through the resolution path.';
  } else if (latestRun) {
    nextDemoAction = 'Open the latest autonomous receipt to explain the most recent queue and policy decisions.';
  }

  return {
    generatedAt: now,
    persistenceMode: operatorHealth.persistenceMode,
    smoke,
    operatorHealth,
    latestReceipt: latestRun ? buildAutonomousRunReceipt(state, latestRun.runId) : null,
    bondedUsdcMicroUsdc: state.signals
      .filter((signal) => Boolean(signal.arcTxHash))
      .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0),
    latestTxHash: smoke.latestTxHash,
    topReputation: selectTopReputation(state),
    resolutionSummary,
    nextDemoAction
  };
}

export async function executeProofTransaction(
  options: ExecuteProofTransactionOptions
): Promise<ProofTransactionOutcome> {
  const { env, store, state, now, controlRoom } = await getStateAndHealth(options);

  if (!options.confirmTx) {
    return {
      httpStatus: 400,
      body: {
        reason: 'proof_intent_required'
      }
    };
  }

  if (!env.proof.secret) {
    return {
      httpStatus: 503,
      body: {
        reason: 'proof_mode_not_configured'
      }
    };
  }

  if (!options.proofSecret) {
    return {
      httpStatus: 401,
      body: {
        reason: 'missing_proof_authorization'
      }
    };
  }

  if (options.proofSecret !== env.proof.secret) {
    return {
      httpStatus: 403,
      body: {
        reason: 'invalid_proof_authorization'
      }
    };
  }

  if (
    env.proof.maxStakePerSignalUsdc6 <= 0 ||
    env.proof.maxDailySpendUsdc6 <= 0 ||
    env.proof.maxTransactionsPerDay <= 0
  ) {
    return {
      httpStatus: 409,
      body: {
        reason: 'proof_budget_not_configured'
      }
    };
  }

  const signal = await store.getSignal(options.signalId);
  if (!signal) {
    return {
      httpStatus: 404,
      body: {
        reason: 'signal_not_found'
      }
    };
  }

  if (signal.arcTxHash || signal.status === 'committed' || signal.resolution) {
    return {
      httpStatus: 409,
      body: {
        reason: 'signal_already_committed'
      }
    };
  }

  if (getSignalCommitEligibilityReason(signal) !== null) {
    return {
      httpStatus: 409,
      body: {
        reason: 'signal_not_eligible'
      }
    };
  }

  if (signal.stakeMicroUsdc > env.proof.maxStakePerSignalUsdc6) {
    return {
      httpStatus: 409,
      body: {
        reason: 'proof_max_stake_exceeded'
      }
    };
  }

  const ops = await store.getOperationsState();
  const existingClaim = findBlockingProofClaim(ops.proof.claims, signal.id);
  if (existingClaim) {
    return mapExistingProofClaimOutcome(existingClaim);
  }
  const autonomyState: ArenaState = {
    ...state,
    ops: {
      ...(state.ops ?? createEmptyOperationsState()),
      autonomous: {
        ...(state.ops?.autonomous ?? createEmptyOperationsState().autonomous),
        ...ops.autonomous
      },
      proof: {
        ...(state.ops?.proof ?? createEmptyOperationsState().proof),
        ...ops.proof
      }
    }
  };
  const autonomyLockBlocker = activeAutonomyLockBlocker(autonomyState, now);
  if (autonomyLockBlocker) {
    return proofTransactionOutcomeFromAutonomyBlocker(autonomyLockBlocker);
  }
  const autonomyClaimConflict = autonomyClaimBlocker(autonomyState, signal.id);
  if (autonomyClaimConflict) {
    return proofTransactionOutcomeFromAutonomyBlocker(autonomyClaimConflict);
  }
  const claimsToday = proofClaimsToday(ops.proof.claims, now);
  const dailySpend = claimsToday.reduce((sum, claim) => sum + claim.stakeMicroUsdc, 0);

  if (dailySpend >= env.proof.maxDailySpendUsdc6) {
    return {
      httpStatus: 409,
      body: {
        reason: 'proof_daily_budget_exhausted'
      }
    };
  }

  if (claimsToday.length >= env.proof.maxTransactionsPerDay) {
    return {
      httpStatus: 409,
      body: {
        reason: 'proof_transaction_cap_exhausted'
      }
    };
  }

  if (!controlRoom.commitAvailable) {
    return {
      httpStatus: 409,
      body: {
        reason: 'proof_commit_unavailable'
      }
    };
  }

  const lockResult = await store.acquireOperationLock({
    scope: 'proof',
    key: `proof:${signal.id}`,
    owner: 'proof-mode',
    acquiredAt: now,
    ttlMs: PROOF_OPERATION_LOCK_TTL_MS,
    signalId: signal.id
  });

  if (lockResult.status === 'locked') {
    return {
      httpStatus: 409,
      body: {
        reason: 'proof_lock_active',
        expiresAt: lockResult.lock.expiresAt
      }
    };
  }

  const claimKey = buildProofClaimKey(env, signal);
  const claimResult = await store.acquireCommitClaim({
    scope: 'proof',
    claimKey,
    signalId: signal.id,
    agentName: signal.agentName,
    stakeMicroUsdc: signal.stakeMicroUsdc,
    chainId: env.arc.chainId,
    arenaAddress: env.arc.signalBondArenaAddress,
    createdAt: now
  });

  if (claimResult.status === 'existing') {
    await store.releaseOperationLock('proof', lockResult.lock.token);
    return mapExistingProofClaimOutcome(claimResult.claim);
  }

  const commitSignal = options.commitSignal ?? defaultCommitSignalToArena;
  let txHash: `0x${string}` | null = null;
  let signalRecordId: number | null = null;

  try {
    const result = await commitSignal(store, signal);
    txHash = result.txHash;
    signalRecordId = result.signalRecordId;
    await store.markSignalCommitted(signal.id, result.txHash, result.signalRecordId);
    await store.updateCommitClaim({
      scope: 'proof',
      claimKey,
      status: 'committed',
      txHash: result.txHash,
      updatedAt: now
    });

    return {
      httpStatus: 200,
      body: {
        mode: 'transactional',
        transactionAttempted: true,
        signalId: signal.id,
        txHash: result.txHash,
        signalRecordId: result.signalRecordId
      }
    };
  } catch (error) {
    const possibleTxHash = txHash ?? getCommitTxHashFromError(error);
    if (possibleTxHash) {
      const reasonCode = safeReasonCode(
        error instanceof Error ? error.message : null,
        'commit_receipt_unconfirmed'
      );
      await store.updateCommitClaim({
        scope: 'proof',
        claimKey,
        status: 'uncertain',
        txHash: possibleTxHash,
        reasonCode,
        updatedAt: now
      });
      return {
        httpStatus: 409,
        body: {
          reason: 'uncertain_reconcile_required',
          txHash: possibleTxHash,
          signalRecordId
        }
      };
    }

    await store.updateCommitClaim({
      scope: 'proof',
      claimKey,
      status: 'failed',
      reasonCode: safeReasonCode(error instanceof Error ? error.message : null, 'proof_commit_failed'),
      updatedAt: now
    });

    return {
      httpStatus: 409,
      body: {
        reason: safeReasonCode(
          error instanceof Error ? error.message : null,
          'proof_commit_failed'
        )
      }
    };
  } finally {
    await store.releaseOperationLock('proof', lockResult.lock.token);
  }
}
