import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AgentSignal } from '@/lib/polymarket/types';
import type {
  AgentRunRecord,
  ArenaMetrics,
  ArenaState,
  LatestScanState,
  LeaderboardEntry,
  MarketScanRecord,
  PersistenceStore
} from '@/lib/persistence/store';
import {
  computeBrierScoreBps,
  computePaperRoiBps
} from '@/lib/resolution/scoring';

interface PersistedState extends ArenaState {
  latestScan?: LatestScanState;
}

interface LocalStoreOptions {
  storagePath: string;
}

function emptyState(): PersistedState {
  return {
    markets: [],
    signals: []
  };
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
      const parsed = JSON.parse(content) as PersistedState;
      memoryState = {
        ...emptyState(),
        ...parsed
      };
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

    async getArenaState() {
      return readState();
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
        averageEdgeBps: average(state.signals.map((signal) => signal.edgeBps)),
        totalBondedMicroUsdc: committedSignals.reduce(
          (sum, signal) => sum + signal.stakeMicroUsdc,
          0
        )
      } satisfies ArenaMetrics;
    }
  };
}
