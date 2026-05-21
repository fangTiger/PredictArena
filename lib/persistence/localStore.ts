import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentSignal } from '@/lib/polymarket/types';
import type {
  AcquireAutonomousRunInput,
  AcquireAutonomousRunResult,
  AcquireCommitClaimInput,
  AcquireCommitClaimResult,
  AcquireOperationLockInput,
  AcquireOperationLockResult,
  AgentRunRecord,
  ArenaMetrics,
  ArenaState,
  AutonomousFailureRecord,
  LatestScanState,
  LeaderboardEntry,
  MarketScanRecord,
  OperationLockRecord,
  AutonomousRunRecord,
  CommitClaimRecord,
  UpdateCommitClaimInput,
  PersistenceStore
} from '@/lib/persistence/store';
import { createEmptyOperationsState } from '@/lib/persistence/store';
import { computeBrierScoreBps, computePaperRoiBps } from '@/lib/resolution/scoring';

interface PersistedState extends ArenaState {
  latestScan?: LatestScanState;
}

interface LocalStoreOptions {
  storagePath: string;
}

function emptyState(): PersistedState {
  return {
    markets: [],
    signals: [],
    autonomyRuns: [],
    ops: createEmptyOperationsState()
  };
}

function normalizeState(state: Partial<PersistedState> | null | undefined): PersistedState {
  const next = {
    ...emptyState(),
    ...state
  } satisfies PersistedState;

  next.ops = {
    ...createEmptyOperationsState(),
    ...state?.ops,
    autonomous: {
      ...createEmptyOperationsState().autonomous,
      ...state?.ops?.autonomous,
      claims: [...(state?.ops?.autonomous?.claims ?? [])],
      lastFailure: state?.ops?.autonomous?.lastFailure ?? null
    },
    proof: {
      ...createEmptyOperationsState().proof,
      ...state?.ops?.proof,
      claims: [...(state?.ops?.proof?.claims ?? [])]
    }
  };

  return next;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function yesOutcomeFromCorrectness(signal: AgentSignal, outcomeCorrect: boolean): boolean {
  if (signal.side === 'YES') {
    return outcomeCorrect;
  }

  if (signal.side === 'NO') {
    return !outcomeCorrect;
  }

  return false;
}

async function ensureParentDirectory(storagePath: string): Promise<void> {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
}

export function createLocalStore(options: LocalStoreOptions): PersistenceStore {
  let memoryState = emptyState();
  let queue = Promise.resolve();

  async function readState(): Promise<PersistedState> {
    try {
      const content = await fs.readFile(options.storagePath, 'utf8');
      memoryState = normalizeState(JSON.parse(content) as PersistedState);
      return memoryState;
    } catch {
      return memoryState;
    }
  }

  async function writeState(state: PersistedState): Promise<void> {
    try {
      await ensureParentDirectory(options.storagePath);
      await fs.writeFile(options.storagePath, JSON.stringify(state, null, 2), 'utf8');
    } catch {
      memoryState = state;
    }
  }

  async function mutate<T>(updater: (state: PersistedState) => T | Promise<T>): Promise<T> {
    const next = queue.then(async () => {
      const state = await readState();
      const result = await updater(state);
      memoryState = state;
      await writeState(state);
      return result;
    });

    queue = next.then(
      () => undefined,
      () => undefined
    );

    return next;
  }

  function replaceState(target: PersistedState, nextState: PersistedState): void {
    for (const key of Object.keys(target) as Array<keyof PersistedState>) {
      delete target[key];
    }

    Object.assign(target, nextState);
  }

  function upsertAutonomousRun(
    state: PersistedState,
    record: AutonomousRunRecord
  ): AutonomousRunRecord {
    const existingById = new Map(state.autonomyRuns.map((run) => [run.runId, run] as const));
    const existing = existingById.get(record.runId);
    const merged: AutonomousRunRecord = {
      ...existing,
      ...record,
      idempotencyKey: record.idempotencyKey ?? existing?.idempotencyKey ?? null,
      scheduleWindowId: record.scheduleWindowId ?? existing?.scheduleWindowId ?? null,
      status: record.status ?? existing?.status ?? 'completed',
      failureReasonCode: record.failureReasonCode ?? existing?.failureReasonCode ?? null,
      lockExpiresAt: record.lockExpiresAt ?? existing?.lockExpiresAt ?? null
    };

    existingById.set(record.runId, merged);
    state.autonomyRuns = [...existingById.values()].sort((left, right) =>
      right.triggeredAt.localeCompare(left.triggeredAt)
    );

    return merged;
  }

  function activeLockFor(
    lock: OperationLockRecord | null,
    now: string
  ): OperationLockRecord | null {
    if (!lock) {
      return null;
    }

    return new Date(lock.expiresAt).getTime() > new Date(now).getTime() ? lock : null;
  }

  function claimListFor(state: PersistedState, scope: 'autonomy' | 'proof'): CommitClaimRecord[] {
    return scope === 'autonomy' ? state.ops!.autonomous.claims : state.ops!.proof.claims;
  }

  function sortClaims(claims: CommitClaimRecord[]): CommitClaimRecord[] {
    return [...claims].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  return {
    async saveMarketScan(record: MarketScanRecord) {
      await mutate(async (state) => {
        state.latestScan = {
          source: record.source,
          fallbackReason: record.fallbackReason,
          scannedAt: new Date().toISOString(),
          marketCount: record.markets.length
        };
        state.markets = [...record.markets];
      });
    },

    async saveAgentRun(record: AgentRunRecord) {
      await mutate(async (state) => {
        const existingById = new Map(state.signals.map((signal) => [signal.id, signal]));
        for (const signal of record.signals) {
          const existing = existingById.get(signal.id);
          existingById.set(
            signal.id,
            existing
              ? {
                  ...signal,
                  arcTxHash: existing.arcTxHash ?? signal.arcTxHash,
                  arcSignalRecordId: existing.arcSignalRecordId ?? signal.arcSignalRecordId,
                  resolution: existing.resolution ?? signal.resolution,
                  status: existing.status === 'generated' ? signal.status : existing.status
                }
              : signal
          );
        }

        state.signals = [...existingById.values()].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt)
        );
        state.lastRun = {
          runId: record.runId,
          source: record.source,
          generatedAt: record.generatedAt
        };
      });
    },

    async saveAutonomousRun(record: AutonomousRunRecord) {
      await mutate(async (state) => {
        upsertAutonomousRun(state, {
          ...record,
          status: record.status ?? 'completed'
        });
        if (state.ops?.autonomous.lock?.runId === record.runId) {
          state.ops.autonomous.lock = null;
        }
      });
    },

    async replaceArenaState(nextState: ArenaState) {
      await mutate(async (state) => {
        replaceState(state, normalizeState(nextState));
      });
    },

    async getArenaState() {
      return readState();
    },

    async getOperationsState() {
      return (await readState()).ops ?? createEmptyOperationsState();
    },

    async listSignals() {
      const state = await readState();
      return state.signals;
    },

    async getSignal(signalId: string) {
      const state = await readState();
      return state.signals.find((signal) => signal.id === signalId);
    },

    async markSignalCommitted(signalId: string, txHash: `0x${string}`, signalRecordId = null) {
      return mutate(async (state) => {
        const signal = state.signals.find((entry) => entry.id === signalId);
        if (!signal) {
          throw new Error(`unknown_signal:${signalId}`);
        }

        signal.arcTxHash = txHash;
        signal.arcSignalRecordId = signalRecordId;
        signal.status = 'committed';
        signal.updatedAt = new Date().toISOString();
        return signal;
      });
    },

    async resolveSignal(
      signalId: string,
      outcomeCorrect: boolean,
      resolvedAt = new Date().toISOString(),
      details = {}
    ) {
      return mutate(async (state) => {
        const signal = state.signals.find((entry) => entry.id === signalId);
        if (!signal) {
          throw new Error(`unknown_signal:${signalId}`);
        }

        if (signal.resolution) {
          throw new Error('signal_already_resolved');
        }

        if (signal.status !== 'committed') {
          throw new Error('signal_not_committed');
        }

        signal.resolution = {
          outcomeCorrect,
          yesOutcome: details.yesOutcome ?? yesOutcomeFromCorrectness(signal, outcomeCorrect),
          resolvedAt,
          source: details.source,
          settlementPrice: details.settlementPrice,
          observedAt: details.observedAt,
          onchainTxHash: details.onchainTxHash ?? null
        };
        signal.status = outcomeCorrect ? 'resolved_correct' : 'resolved_incorrect';
        signal.updatedAt = resolvedAt;
        return signal;
      });
    },

    async acquireAutonomousRun(input: AcquireAutonomousRunInput): Promise<AcquireAutonomousRunResult> {
      return mutate(async (state) => {
        const duplicateByKey = state.autonomyRuns.find(
          (run) => run.idempotencyKey && run.idempotencyKey === input.idempotencyKey
        );
        if (duplicateByKey) {
          return {
            status: 'duplicate',
            duplicateBy: 'idempotency_key',
            run: duplicateByKey
          } satisfies AcquireAutonomousRunResult;
        }

        const duplicateByWindow = state.autonomyRuns.find(
          (run) => run.scheduleWindowId && run.scheduleWindowId === input.scheduleWindowId
        );
        if (duplicateByWindow) {
          return {
            status: 'duplicate',
            duplicateBy: 'schedule_window',
            run: duplicateByWindow
          } satisfies AcquireAutonomousRunResult;
        }

        const activeLock = activeLockFor(state.ops?.autonomous.lock ?? null, input.triggeredAt);
        if (activeLock) {
          return {
            status: 'locked',
            lock: activeLock
          } satisfies AcquireAutonomousRunResult;
        }

        const lockExpiresAt = new Date(
          new Date(input.triggeredAt).getTime() + input.lockTtlMs
        ).toISOString();
        const run = upsertAutonomousRun(state, {
          runId: input.runId,
          idempotencyKey: input.idempotencyKey,
          scheduleWindowId: input.scheduleWindowId,
          status: 'started',
          source: input.source,
          triggeredAt: input.triggeredAt,
          completedAt: input.triggeredAt,
          marketCount: 0,
          generatedSignalCount: 0,
          modeByAgent: {
            volatility: 'OFF',
            momentum: 'OFF'
          },
          queue: [],
          committedCount: 0,
          dryRunCount: 0,
          skippedCount: 0,
          budgetSnapshots: [],
          failureReasonCode: null,
          lockExpiresAt
        });
        state.ops!.autonomous.lock = {
          scope: 'autonomy',
          token: randomUUID(),
          key: input.idempotencyKey,
          owner: input.owner ?? null,
          runId: input.runId,
          acquiredAt: input.triggeredAt,
          expiresAt: lockExpiresAt
        };

        return {
          status: 'acquired',
          run
        } satisfies AcquireAutonomousRunResult;
      });
    },

    async finalizeAutonomousRun(
      record: AutonomousRunRecord,
      options: { rawDiagnostic?: string | null } = {}
    ) {
      return mutate(async (state) => {
        const nextRecord = upsertAutonomousRun(state, {
          ...record,
          status: record.status ?? 'completed'
        });

        if (state.ops?.autonomous.lock?.runId === record.runId) {
          state.ops.autonomous.lock = null;
        }

        if (nextRecord.status === 'failed' || nextRecord.failureReasonCode) {
          state.ops!.autonomous.lastFailure = {
            runId: nextRecord.runId,
            reasonCode: nextRecord.failureReasonCode ?? 'autonomous_run_failed',
            rawDiagnostic: options.rawDiagnostic ?? null,
            occurredAt: nextRecord.completedAt
          } satisfies AutonomousFailureRecord;
        }

        return nextRecord;
      });
    },

    async acquireCommitClaim(input: AcquireCommitClaimInput): Promise<AcquireCommitClaimResult> {
      return mutate(async (state) => {
        const claims = claimListFor(state, input.scope);
        const existing = claims.find((claim) => claim.claimKey === input.claimKey);
        if (existing) {
          return {
            status: 'existing',
            claim: existing
          } satisfies AcquireCommitClaimResult;
        }

        const claim: CommitClaimRecord = {
          scope: input.scope,
          claimKey: input.claimKey,
          signalId: input.signalId,
          agentName: input.agentName,
          stakeMicroUsdc: input.stakeMicroUsdc,
          chainId: input.chainId,
          arenaAddress: input.arenaAddress,
          runId: input.runId ?? null,
          status: 'pending',
          reasonCode: null,
          txHash: null,
          createdAt: input.createdAt,
          updatedAt: input.createdAt
        };
        if (input.scope === 'autonomy') {
          state.ops!.autonomous.claims = sortClaims([...claims, claim]);
        } else {
          state.ops!.proof.claims = sortClaims([...claims, claim]);
        }

        return {
          status: 'acquired',
          claim
        } satisfies AcquireCommitClaimResult;
      });
    },

    async updateCommitClaim(input: UpdateCommitClaimInput) {
      return mutate(async (state) => {
        const claims = claimListFor(state, input.scope);
        const claim = claims.find((entry) => entry.claimKey === input.claimKey);
        if (!claim) {
          throw new Error(`unknown_commit_claim:${input.scope}:${input.claimKey}`);
        }

        claim.status = input.status;
        claim.updatedAt = input.updatedAt;
        claim.reasonCode = input.reasonCode ?? null;
        claim.txHash = input.txHash === undefined ? claim.txHash : input.txHash;
        if (input.scope === 'autonomy') {
          state.ops!.autonomous.claims = sortClaims(claims);
        } else {
          state.ops!.proof.claims = sortClaims(claims);
        }

        return claim;
      });
    },

    async acquireOperationLock(input: AcquireOperationLockInput): Promise<AcquireOperationLockResult> {
      return mutate(async (state) => {
        const activeLock = activeLockFor(state.ops?.proof.lock ?? null, input.acquiredAt);
        if (activeLock) {
          return {
            status: 'locked',
            lock: activeLock
          } satisfies AcquireOperationLockResult;
        }

        const lock: OperationLockRecord = {
          scope: input.scope,
          token: randomUUID(),
          key: input.key,
          owner: input.owner ?? null,
          signalId: input.signalId ?? null,
          acquiredAt: input.acquiredAt,
          expiresAt: new Date(new Date(input.acquiredAt).getTime() + input.ttlMs).toISOString()
        };
        state.ops!.proof.lock = lock;
        return {
          status: 'acquired',
          lock
        } satisfies AcquireOperationLockResult;
      });
    },

    async releaseOperationLock(scope: 'proof', token: string) {
      await mutate(async (state) => {
        if (scope === 'proof' && state.ops?.proof.lock?.token === token) {
          state.ops.proof.lock = null;
        }
      });
    },

    async getLeaderboard() {
      const state = await readState();
      const grouped = new Map<'volatility' | 'momentum', AgentSignal[]>();

      for (const signal of state.signals) {
        const list = grouped.get(signal.agentName) ?? [];
        list.push(signal);
        grouped.set(signal.agentName, list);
      }

      return [...grouped.entries()]
        .map(([agentName, signals]): LeaderboardEntry => {
          const committedSignals = signals.filter((signal) => Boolean(signal.arcTxHash));
          const resolvedSignals = signals.filter((signal) => signal.resolution);
          const correctSignals = resolvedSignals.filter((signal) => signal.resolution?.outcomeCorrect);
          const refundedMicroUsdc = resolvedSignals
            .filter((signal) => signal.resolution?.outcomeCorrect)
            .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0);
          const slashedMicroUsdc = resolvedSignals
            .filter((signal) => !signal.resolution?.outcomeCorrect)
            .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0);
          const brierScores = resolvedSignals
            .map((signal) =>
              computeBrierScoreBps(
                signal,
                signal.resolution?.yesOutcome ??
                  yesOutcomeFromCorrectness(signal, Boolean(signal.resolution?.outcomeCorrect))
              )
            );

          return {
            rank: 0,
            agentName,
            generatedSignals: signals.length,
            committedSignals: committedSignals.length,
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
            refundedMicroUsdc,
            slashedMicroUsdc,
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
            }
          };
        })
        .sort((left, right) => right.averageEdgeBps - left.averageEdgeBps)
        .map((entry, index) => ({
          ...entry,
          rank: index + 1
        }));
    },

    async getMetrics() {
      const state = await readState();
      const committedSignals = state.signals.filter((signal) => Boolean(signal.arcTxHash));
      const resolvedSignals = state.signals.filter((signal) => signal.resolution);

      return {
        generatedSignals: state.signals.length,
        committedSignals: committedSignals.length,
        resolvedSignals: resolvedSignals.length,
        openSignals: committedSignals.filter((signal) => !signal.resolution).length,
        averageEdgeBps: average(state.signals.map((signal) => signal.edgeBps)),
        totalBondedMicroUsdc: committedSignals.reduce(
          (sum, signal) => sum + signal.stakeMicroUsdc,
          0
        )
      } satisfies ArenaMetrics;
    }
  };
}
