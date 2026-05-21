import { createPublicClient, http } from 'viem';
import { arcTestnet } from '@/lib/arc/client';
import { signalBondArenaAbi } from '@/lib/arc/signalBondArena';
import { getServerEnv, type ServerEnvConfig } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';
import type { PersistenceStore } from '@/lib/persistence/store';

export interface ArcSyncResult {
  status: 'ready' | 'degraded';
  reason: string | null;
  chainId: number | null;
  scannedSignals: number;
  updatedSignals: number;
}

type ArcSyncPublicClient = {
  getChainId: () => Promise<number>;
  readContract: (...args: any[]) => Promise<unknown>;
};

function readBooleanField(value: unknown, fieldName: string, tupleIndex: number): boolean | null {
  if (Array.isArray(value)) {
    const tupleValue = value[tupleIndex];
    return typeof tupleValue === 'boolean' ? tupleValue : null;
  }

  if (value && typeof value === 'object' && fieldName in value) {
    const fieldValue = (value as Record<string, unknown>)[fieldName];
    return typeof fieldValue === 'boolean' ? fieldValue : null;
  }

  return null;
}

export async function syncArcLeaderboard(options: {
  env?: ServerEnvConfig;
  store?: PersistenceStore;
  publicClient?: ArcSyncPublicClient;
} = {}): Promise<ArcSyncResult> {
  const env = options.env ?? getServerEnv();
  const store = options.store ?? getRuntimeStore();
  const committedSignals = (await store.listSignals()).filter((signal) => Boolean(signal.arcTxHash));

  if (!env.arc.signalBondArenaAddress) {
    return {
      status: 'degraded',
      reason: 'missing_signal_bond_arena_address',
      chainId: null,
      scannedSignals: committedSignals.length,
      updatedSignals: 0
    };
  }

  try {
    const publicClient =
      options.publicClient ??
      createPublicClient({
        chain: arcTestnet,
        transport: http(env.arc.rpcUrl)
      });
    const chainId = await publicClient.getChainId();

    if (chainId !== env.arc.chainId) {
      return {
        status: 'degraded',
        reason: 'arc_chain_mismatch',
        chainId,
        scannedSignals: committedSignals.length,
        updatedSignals: 0
      };
    }

    let updatedSignals = 0;
    for (const signal of committedSignals) {
      if (!signal.arcSignalRecordId || signal.resolution) {
        continue;
      }

      const onchainSignal = await publicClient.readContract({
        address: env.arc.signalBondArenaAddress,
        abi: signalBondArenaAbi,
        functionName: 'signals',
        args: [BigInt(signal.arcSignalRecordId)]
      });
      const resolved = readBooleanField(onchainSignal, 'resolved', 14);
      const outcomeCorrect = readBooleanField(onchainSignal, 'outcomeCorrect', 15);

      if (resolved !== true || outcomeCorrect === null) {
        continue;
      }

      await store.resolveSignal(signal.id, outcomeCorrect, new Date().toISOString(), {
        source: 'automatic',
        onchainTxHash: signal.arcTxHash
      });
      updatedSignals += 1;
    }

    return {
      status: 'ready',
      reason: committedSignals.length === 0 ? 'no_committed_signals' : null,
      chainId,
      scannedSignals: committedSignals.length,
      updatedSignals
    };
  } catch (error) {
    return {
      status: 'degraded',
      reason: error instanceof Error ? error.message : 'arc_sync_unavailable',
      chainId: null,
      scannedSignals: committedSignals.length,
      updatedSignals: 0
    };
  }
}
