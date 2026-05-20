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

function computePaperRoiBps(signal: AgentSignal): number {
  if (!signal.resolution) {
    return 0;
  }

  const marketPriceBps = signal.marketPriceBps;
  return signal.resolution.outcomeCorrect ? 10_000 - marketPriceBps : -marketPriceBps;
}

function computeBrierScoreBps(signal: AgentSignal): number | null {
  if (!signal.resolution) {
    return null;
  }

  const actualYes =
    signal.side === 'YES'
      ? signal.resolution.outcomeCorrect
        ? 1
        : 0
      : signal.side === 'NO'
        ? signal.resolution.outcomeCorrect
          ? 0
          : 1
        : 0;

  const pYes = signal.pYesBps / 10_000;
  return Math.round(((pYes - actualYes) ** 2) * 10_000);
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
          existingById.set(signal.id, existing ? { ...signal, arcTxHash: existing.arcTxHash ?? signal.arcTxHash, resolution: existing.resolution ?? signal.resolution, status: existing.status === 'committed' ? existing.status : signal.status } : signal);
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

    async markSignalCommitted(signalId: string, txHash: `0x${string}`) {
      return mutate(async (state) => {
        const signal = state.signals.find((entry) => entry.id === signalId);
        if (!signal) {
          throw new Error(`unknown_signal:${signalId}`);
        }

        signal.arcTxHash = txHash;
        signal.status = 'committed';
        signal.updatedAt = new Date().toISOString();
        return signal;
      });
    },

    async resolveSignal(signalId: string, outcomeCorrect: boolean, resolvedAt = new Date().toISOString()) {
      return mutate(async (state) => {
        const signal = state.signals.find((entry) => entry.id === signalId);
        if (!signal) {
          throw new Error(`unknown_signal:${signalId}`);
        }

        signal.resolution = {
          outcomeCorrect,
          resolvedAt
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
          const refundedMicroUsdc = resolvedSignals
            .filter((signal) => signal.resolution?.outcomeCorrect)
            .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0);
          const slashedMicroUsdc = resolvedSignals
            .filter((signal) => !signal.resolution?.outcomeCorrect)
            .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0);
          const brierScores = resolvedSignals
            .map((signal) => computeBrierScoreBps(signal))
            .filter((value): value is number => value !== null);

          return {
            rank: 0,
            agentName,
            generatedSignals: signals.length,
            committedSignals: committedSignals.length,
            averageEdgeBps: average(signals.map((signal) => signal.edgeBps)),
            totalBondedMicroUsdc: committedSignals.reduce(
              (sum, signal) => sum + signal.stakeMicroUsdc,
              0
            ),
            refundedMicroUsdc,
            slashedMicroUsdc,
            paperRoiBps: average(resolvedSignals.map((signal) => computePaperRoiBps(signal))),
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

      return {
        generatedSignals: state.signals.length,
        committedSignals: committedSignals.length,
        averageEdgeBps: average(state.signals.map((signal) => signal.edgeBps)),
        totalBondedMicroUsdc: committedSignals.reduce(
          (sum, signal) => sum + signal.stakeMicroUsdc,
          0
        )
      } satisfies ArenaMetrics;
    }
  };
}
