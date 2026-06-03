import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createEmptySavedIntelligenceWorkspaceState,
  normalizeSavedIntelligenceStateMap,
  normalizeSavedIntelligenceWorkspaceState,
  type IntelligenceAlert,
  type SavedIntelligenceFilter,
  type SavedIntelligenceWorkspaceMap,
  type SavedIntelligenceWorkspaceState,
  type WatchedMarketEntry
} from '@/lib/intelligence/savedState';
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
  WalletFollowRecord,
  PersistenceStore
} from '@/lib/persistence/store';
import { createEmptyOperationsState } from '@/lib/persistence/store';
import { computeBrierScoreBps, computePaperRoiBps } from '@/lib/resolution/scoring';

interface PersistedState extends ArenaState {
  latestScan?: LatestScanState;
  walletFollows: WalletFollowRecord[];
  savedIntelligence: SavedIntelligenceWorkspaceMap;
}

interface LocalStoreOptions {
  storagePath: string;
}

const WORKSPACE_MERGE_BASE_KEY = '__predictarenaMergeBase';

interface WorkspaceMergeBase {
  savedFilterIds: string[];
  watchIds: string[];
}

type WorkspaceStateWithMergeBase = SavedIntelligenceWorkspaceState & {
  [WORKSPACE_MERGE_BASE_KEY]?: WorkspaceMergeBase;
};

function emptyState(): PersistedState {
  return {
    markets: [],
    signals: [],
    walletFollows: [],
    autonomyRuns: [],
    ops: createEmptyOperationsState(),
    savedIntelligence: {}
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
  next.savedIntelligence = normalizeSavedIntelligenceStateMap(
    (state as Partial<PersistedState> | undefined)?.savedIntelligence
  );
  next.walletFollows = [...((state as Partial<PersistedState> | undefined)?.walletFollows ?? [])];

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireFileLock(storagePath: string): Promise<() => Promise<void>> {
  const lockPath = `${storagePath}.lock`;
  await ensureParentDirectory(storagePath);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(`${process.pid}:${Date.now()}`);
      return async () => {
        await handle.close();
        await fs.unlink(lockPath).catch(() => undefined);
      };
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== 'EEXIST') {
        return async () => undefined;
      }

      const stat = await fs.stat(lockPath).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > 10_000) {
        await fs.unlink(lockPath).catch(() => undefined);
      } else {
        await delay(25);
      }
    }
  }

  return async () => undefined;
}

function timestampMs(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function maxTimestamp(values: Array<string | null | undefined>): number {
  return values.reduce((max, value) => Math.max(max, timestampMs(value)), 0);
}

function workspaceTimestamp(workspace: SavedIntelligenceWorkspaceState): number {
  return Math.max(
    maxTimestamp([workspace.lastEvaluatedAt, workspace.lastSuccessfulEvaluatedAt]),
    ...workspace.savedFilters.map((filter) =>
      maxTimestamp([filter.createdAt, filter.updatedAt, filter.latestEvaluation?.evaluatedAt])
    ),
    ...workspace.watchlist.map((watch) =>
      maxTimestamp([watch.createdAt, watch.updatedAt, watch.latestSnapshot?.evaluatedAt])
    ),
    ...workspace.alerts.map((alert) => maxTimestamp([alert.createdAt, alert.updatedAt]))
  );
}

function newerFilterSnapshot(
  existing: SavedIntelligenceFilter | undefined,
  incoming: SavedIntelligenceFilter
): SavedIntelligenceFilter {
  if (
    existing?.latestEvaluation &&
    timestampMs(existing.latestEvaluation.evaluatedAt) >
      timestampMs(incoming.latestEvaluation?.evaluatedAt)
  ) {
    return {
      ...incoming,
      latestEvaluation: existing.latestEvaluation,
      updatedAt:
        timestampMs(existing.updatedAt) > timestampMs(incoming.updatedAt)
          ? existing.updatedAt
          : incoming.updatedAt
    };
  }

  return incoming;
}

function newerWatchSnapshot(
  existing: WatchedMarketEntry | undefined,
  incoming: WatchedMarketEntry
): WatchedMarketEntry {
  if (
    existing?.latestSnapshot &&
    timestampMs(existing.latestSnapshot.evaluatedAt) >
      timestampMs(incoming.latestSnapshot?.evaluatedAt)
  ) {
    return {
      ...incoming,
      supportStatus: existing.supportStatus,
      degradedReason: existing.degradedReason,
      latestSnapshot: existing.latestSnapshot,
      updatedAt:
        timestampMs(existing.updatedAt) > timestampMs(incoming.updatedAt)
          ? existing.updatedAt
          : incoming.updatedAt
    };
  }

  return incoming;
}

function newerAlert(existing: IntelligenceAlert | undefined, incoming: IntelligenceAlert): IntelligenceAlert {
  if (!existing) {
    return incoming;
  }

  return timestampMs(existing.updatedAt) > timestampMs(incoming.updatedAt) ? existing : incoming;
}

function readWorkspaceMergeBase(input: SavedIntelligenceWorkspaceState): WorkspaceMergeBase | null {
  const candidate = (input as WorkspaceStateWithMergeBase)[WORKSPACE_MERGE_BASE_KEY];
  if (!candidate) {
    return null;
  }

  if (!Array.isArray(candidate.savedFilterIds) || !Array.isArray(candidate.watchIds)) {
    return null;
  }

  return {
    savedFilterIds: candidate.savedFilterIds.filter((value): value is string => typeof value === 'string'),
    watchIds: candidate.watchIds.filter((value): value is string => typeof value === 'string')
  };
}

function stripWorkspaceMergeBase(
  input: SavedIntelligenceWorkspaceState
): SavedIntelligenceWorkspaceState {
  if (!(WORKSPACE_MERGE_BASE_KEY in input)) {
    return input;
  }

  const { [WORKSPACE_MERGE_BASE_KEY]: _ignored, ...workspace } = input as WorkspaceStateWithMergeBase;
  return workspace;
}

function attachWorkspaceMergeBase(
  workspace: SavedIntelligenceWorkspaceState
): SavedIntelligenceWorkspaceState {
  return {
    ...workspace,
    [WORKSPACE_MERGE_BASE_KEY]: {
      savedFilterIds: workspace.savedFilters.map((filter) => filter.id),
      watchIds: workspace.watchlist.map((watch) => watch.id)
    }
  } as WorkspaceStateWithMergeBase;
}

function orphanAlertFromDeletedSource(
  alert: IntelligenceAlert,
  sourceType: IntelligenceAlert['sourceType'],
  sourceId: string,
  fallbackSourceLabel: string
): IntelligenceAlert {
  if (alert.sourceType !== sourceType || alert.sourceId !== sourceId) {
    return alert;
  }

  return {
    ...alert,
    orphaned: true,
    sourceLabel: alert.sourceLabel ?? fallbackSourceLabel
  };
}

function mergeSavedIntelligenceWorkspace(
  workspaceId: string,
  existingInput: SavedIntelligenceWorkspaceState | null | undefined,
  incomingInput: SavedIntelligenceWorkspaceState
): SavedIntelligenceWorkspaceState {
  const incomingBase = readWorkspaceMergeBase(incomingInput);
  const existing = normalizeSavedIntelligenceWorkspaceState(workspaceId, existingInput);
  const incoming = normalizeSavedIntelligenceWorkspaceState(
    workspaceId,
    stripWorkspaceMergeBase(incomingInput)
  );
  const incomingTimestamp = workspaceTimestamp(incoming);
  const existingFilters = new Map(existing.savedFilters.map((filter) => [filter.id, filter]));
  const existingWatches = new Map(existing.watchlist.map((watch) => [watch.id, watch]));
  const incomingFilterIds = new Set(incoming.savedFilters.map((filter) => filter.id));
  const incomingWatchIds = new Set(incoming.watchlist.map((watch) => watch.id));
  const mergeBaseFilterIds = new Set(incomingBase?.savedFilterIds ?? []);
  const mergeBaseWatchIds = new Set(incomingBase?.watchIds ?? []);
  const deletedFilterIds = new Set<string>();
  const deletedWatchIds = new Set<string>();
  const alertById = new Map(existing.alerts.map((alert) => [alert.id, alert]));

  for (const alert of incoming.alerts) {
    alertById.set(alert.id, newerAlert(alertById.get(alert.id), alert));
  }

  const savedFilters = incoming.savedFilters.map((filter) =>
    newerFilterSnapshot(existingFilters.get(filter.id), filter)
  );
  for (const filter of existing.savedFilters) {
    if (incomingFilterIds.has(filter.id)) {
      continue;
    }

    if (mergeBaseFilterIds.has(filter.id)) {
      deletedFilterIds.add(filter.id);
      continue;
    }

    if (timestampMs(filter.updatedAt) > incomingTimestamp) {
      savedFilters.push(filter);
    }
  }

  const watchlist = incoming.watchlist.map((watch) => newerWatchSnapshot(existingWatches.get(watch.id), watch));
  for (const watch of existing.watchlist) {
    if (incomingWatchIds.has(watch.id)) {
      continue;
    }

    if (mergeBaseWatchIds.has(watch.id)) {
      deletedWatchIds.add(watch.id);
      continue;
    }

    if (timestampMs(watch.updatedAt) > incomingTimestamp) {
      watchlist.push(watch);
    }
  }

  for (const filterId of deletedFilterIds) {
    const existingFilter = existingFilters.get(filterId);
    if (!existingFilter) {
      continue;
    }

    for (const [alertId, alert] of alertById.entries()) {
      alertById.set(
        alertId,
        orphanAlertFromDeletedSource(alert, 'saved_filter', filterId, existingFilter.name)
      );
    }
  }

  for (const watchId of deletedWatchIds) {
    const existingWatch = existingWatches.get(watchId);
    if (!existingWatch) {
      continue;
    }

    for (const [alertId, alert] of alertById.entries()) {
      alertById.set(
        alertId,
        orphanAlertFromDeletedSource(
          alert,
          'watchlist',
          watchId,
          existingWatch.label ?? existingWatch.question
        )
      );
    }
  }

  const existingEvaluationMs = timestampMs(existing.lastEvaluatedAt);
  const incomingEvaluationMs = timestampMs(incoming.lastEvaluatedAt);
  const newestEvaluation = existingEvaluationMs > incomingEvaluationMs ? existing : incoming;

  return normalizeSavedIntelligenceWorkspaceState(workspaceId, {
    ...incoming,
    savedFilters,
    watchlist,
    alerts: [...alertById.values()],
    freshness: newestEvaluation.freshness,
    lastEvaluatedAt: newestEvaluation.lastEvaluatedAt,
    lastSuccessfulEvaluatedAt: newestEvaluation.lastSuccessfulEvaluatedAt,
    failureReason: newestEvaluation.failureReason
  });
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
      const tempPath = `${options.storagePath}.${process.pid}.${randomUUID()}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(state, null, 2), 'utf8');
      await fs.rename(tempPath, options.storagePath);
    } catch {
      memoryState = state;
    }
  }

  async function mutate<T>(updater: (state: PersistedState) => T | Promise<T>): Promise<T> {
    const next = queue.then(async () => {
      const release = await acquireFileLock(options.storagePath);
      try {
        const state = await readState();
        const result = await updater(state);
        memoryState = state;
        await writeState(state);
        return result;
      } finally {
        await release();
      }
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

  function toArenaState(state: PersistedState): ArenaState {
    const arenaState: ArenaState = {
      markets: [...state.markets],
      signals: state.signals.map((signal) => ({
        ...signal,
        arcSignalRecordId: signal.arcSignalRecordId
      })),
      autonomyRuns: [...state.autonomyRuns],
      ops: state.ops
    };

    if (state.walletFollows.length > 0) {
      arenaState.walletFollows = [...state.walletFollows];
    }

    if (state.latestScan) {
      arenaState.latestScan = { ...state.latestScan };
    }

    if (state.lastRun) {
      arenaState.lastRun = { ...state.lastRun };
    }

    return arenaState;
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
        replaceState(
          state,
          normalizeState({
            ...nextState,
            savedIntelligence:
              (nextState as PersistedState).savedIntelligence ?? state.savedIntelligence
          })
        );
      });
    },

    async getSavedIntelligenceState() {
      return normalizeSavedIntelligenceStateMap((await readState()).savedIntelligence);
    },

    async replaceSavedIntelligenceState(nextState: SavedIntelligenceWorkspaceMap) {
      await mutate(async (state) => {
        state.savedIntelligence = normalizeSavedIntelligenceStateMap(nextState);
      });
    },

    async getSavedIntelligenceWorkspace(workspaceId: string) {
      const state = await readState();
      return attachWorkspaceMergeBase(
        normalizeSavedIntelligenceWorkspaceState(
        workspaceId,
        state.savedIntelligence[workspaceId] ?? createEmptySavedIntelligenceWorkspaceState()
        )
      );
    },

    async putSavedIntelligenceWorkspace(
      workspaceId: string,
      nextWorkspaceState: SavedIntelligenceWorkspaceState
    ) {
      return mutate(async (state) => {
        const normalizedWorkspace = mergeSavedIntelligenceWorkspace(
          workspaceId,
          state.savedIntelligence[workspaceId] ?? createEmptySavedIntelligenceWorkspaceState(),
          nextWorkspaceState
        );
        state.savedIntelligence[workspaceId] = normalizedWorkspace;
        return normalizedWorkspace;
      });
    },

    async getArenaState() {
      return toArenaState(await readState());
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

    async saveWalletFollow(record: WalletFollowRecord) {
      return mutate(async (state) => {
        const signal = state.signals.find((entry) => entry.id === record.signalId);
        if (!signal) {
          throw new Error(`unknown_signal:${record.signalId}`);
        }

        const existing = state.walletFollows.find(
          (follow) => follow.txHash.toLowerCase() === record.txHash.toLowerCase()
        );
        if (existing) {
          return existing;
        }

        state.walletFollows = [record, ...state.walletFollows].sort((left, right) =>
          right.followedAt.localeCompare(left.followedAt)
        );
        return record;
      });
    },

    async listWalletFollows(signalId?: string) {
      const state = await readState();
      const follows = signalId
        ? state.walletFollows.filter((follow) => follow.signalId === signalId)
        : state.walletFollows;
      return [...follows].sort((left, right) => right.followedAt.localeCompare(left.followedAt));
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
