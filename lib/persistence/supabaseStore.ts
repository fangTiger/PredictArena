import type {
  AcquireAutonomousRunInput,
  AcquireCommitClaimInput,
  AcquireOperationLockInput,
  AgentRunRecord,
  ArenaMetrics,
  ArenaState,
  AutonomousRunRecord,
  LeaderboardEntry,
  MarketScanRecord,
  PersistenceStore
} from '@/lib/persistence/store';
import { createLocalStore } from '@/lib/persistence/localStore';

interface SupabaseStoreOptions {
  url: string;
  serviceRoleKey: string;
  stateTable: string;
}

async function loadRemoteState(options: SupabaseStoreOptions): Promise<ArenaState | null> {
  const response = await fetch(
    `${options.url}/rest/v1/${options.stateTable}?id=eq.predictarena&select=payload`,
    {
      headers: {
        apikey: options.serviceRoleKey,
        authorization: `Bearer ${options.serviceRoleKey}`,
        accept: 'application/json'
      },
      cache: 'no-store'
    }
  );

  if (!response.ok) {
    throw new Error(`supabase_load_${response.status}`);
  }

  const payload = (await response.json()) as Array<{ payload: ArenaState }>;
  return payload[0]?.payload ?? null;
}

async function saveRemoteState(options: SupabaseStoreOptions, state: ArenaState): Promise<void> {
  const response = await fetch(`${options.url}/rest/v1/${options.stateTable}`, {
    method: 'POST',
    headers: {
      apikey: options.serviceRoleKey,
      authorization: `Bearer ${options.serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify([{ id: 'predictarena', payload: state }])
  });

  if (!response.ok) {
    throw new Error(`supabase_save_${response.status}`);
  }
}

export function createSupabaseStore(options: SupabaseStoreOptions): PersistenceStore {
  const fallback = createLocalStore({
    storagePath: '/tmp/predictarena-supabase-fallback.json'
  });

  async function syncFromRemote(): Promise<ArenaState> {
    const remoteState = await loadRemoteState(options);
    if (remoteState) {
      return remoteState;
    }

    const localState = await fallback.getArenaState();
    await saveRemoteState(options, localState);
    return localState;
  }

  async function syncToRemote(): Promise<void> {
    await saveRemoteState(options, await fallback.getArenaState());
  }

  async function hydrateFallback(remoteState: ArenaState): Promise<void> {
    await fallback.replaceArenaState(remoteState);
  }

  async function syncFromRemoteToFallback(): Promise<ArenaState> {
    const remoteState = await syncFromRemote();
    await hydrateFallback(remoteState);
    return remoteState;
  }

  async function syncMutation<T>(action: () => Promise<T>): Promise<T> {
    // This remains best-effort only: the state table stores one JSON payload, so cross-instance
    // compare-and-swap semantics are not guaranteed. We still hydrate from remote before each
    // lock/claim mutation to avoid pretending local fallback alone is distributed-safe.
    await syncFromRemoteToFallback();
    const result = await action();
    await syncToRemote();
    return result;
  }

  return {
    async saveMarketScan(record: MarketScanRecord) {
      await fallback.saveMarketScan(record);
      await syncToRemote();
    },
    async saveAgentRun(record: AgentRunRecord) {
      await fallback.saveAgentRun(record);
      await syncToRemote();
    },
    async saveAutonomousRun(record: AutonomousRunRecord) {
      await fallback.saveAutonomousRun(record);
      await syncToRemote();
    },
    async replaceArenaState(state: ArenaState) {
      await fallback.replaceArenaState(state);
      await syncToRemote();
    },
    async getArenaState() {
      return syncFromRemoteToFallback();
    },
    async getOperationsState() {
      await syncFromRemoteToFallback();
      return fallback.getOperationsState();
    },
    async listSignals() {
      return (await this.getArenaState()).signals;
    },
    async getSignal(signalId: string) {
      return (await this.listSignals()).find((signal) => signal.id === signalId);
    },
    async markSignalCommitted(signalId: string, txHash: `0x${string}`, signalRecordId?: number | null) {
      return syncMutation(() => fallback.markSignalCommitted(signalId, txHash, signalRecordId));
    },
    async resolveSignal(signalId: string, outcomeCorrect: boolean, resolvedAt?: string, details = {}) {
      return syncMutation(() => fallback.resolveSignal(signalId, outcomeCorrect, resolvedAt, details));
    },
    async acquireAutonomousRun(input: AcquireAutonomousRunInput) {
      return syncMutation(() => fallback.acquireAutonomousRun(input));
    },
    async finalizeAutonomousRun(record: AutonomousRunRecord, options?: { rawDiagnostic?: string | null }) {
      return syncMutation(() => fallback.finalizeAutonomousRun(record, options));
    },
    async acquireCommitClaim(input: AcquireCommitClaimInput) {
      return syncMutation(() => fallback.acquireCommitClaim(input));
    },
    async updateCommitClaim(input) {
      return syncMutation(() => fallback.updateCommitClaim(input));
    },
    async acquireOperationLock(input: AcquireOperationLockInput) {
      return syncMutation(() => fallback.acquireOperationLock(input));
    },
    async releaseOperationLock(scope: 'proof', token: string) {
      await syncMutation(() => fallback.releaseOperationLock(scope, token));
    },
    async getLeaderboard() {
      await syncFromRemoteToFallback();
      return fallback.getLeaderboard();
    },
    async getMetrics() {
      await syncFromRemoteToFallback();
      return fallback.getMetrics() as Promise<ArenaMetrics>;
    }
  };
}
