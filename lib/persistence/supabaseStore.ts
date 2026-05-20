import type {
  AgentRunRecord,
  ArenaMetrics,
  ArenaState,
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
    await fallback.saveMarketScan({
      source: remoteState.latestScan?.source ?? 'demo_snapshot',
      fallbackReason: remoteState.latestScan?.fallbackReason,
      markets: remoteState.markets
    });
    if (remoteState.lastRun) {
      await fallback.saveAgentRun({
        runId: remoteState.lastRun.runId,
        source: remoteState.lastRun.source,
        generatedAt: remoteState.lastRun.generatedAt,
        signals: remoteState.signals
      });
    }
  }

  async function syncFromRemoteToFallback(): Promise<ArenaState> {
    const remoteState = await syncFromRemote();
    await hydrateFallback(remoteState);
    return remoteState;
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
    async getArenaState() {
      return syncFromRemoteToFallback();
    },
    async listSignals() {
      return (await this.getArenaState()).signals;
    },
    async getSignal(signalId: string) {
      return (await this.listSignals()).find((signal) => signal.id === signalId);
    },
    async markSignalCommitted(signalId: string, txHash: `0x${string}`, signalRecordId?: number | null) {
      const signal = await fallback.markSignalCommitted(signalId, txHash, signalRecordId);
      await syncToRemote();
      return signal;
    },
    async resolveSignal(signalId: string, outcomeCorrect: boolean, resolvedAt?: string, details = {}) {
      const signal = await fallback.resolveSignal(signalId, outcomeCorrect, resolvedAt, details);
      await syncToRemote();
      return signal;
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
