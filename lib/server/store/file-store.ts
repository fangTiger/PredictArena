import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  ArenaRunResult,
  ArenaSignal,
  CommitmentRecord,
  DashboardStats,
  LeaderboardEntry,
  ParsedMarket,
  ScanRecord,
  SkippedMarket,
  SupportedAsset
} from '@/types/predictarena';
import type { PredictArenaStore, SaveScanInput } from '@/lib/server/store/types';

interface PersistedArenaState {
  latestScan?: ScanRecord;
  markets: ParsedMarket[];
  skips: SkippedMarket[];
  signals: ArenaSignal[];
  commitments: CommitmentRecord[];
  activeMarketIds: string[];
}

function emptyState(): PersistedArenaState {
  return {
    markets: [],
    skips: [],
    signals: [],
    commitments: [],
    activeMarketIds: []
  };
}

function resolveStateFilePath() {
  return path.join(process.cwd(), 'data', 'runtime', 'arena-state.json');
}

function resolveScannedMarketCount(scan: ScanRecord): number {
  return Math.max(scan.liveMarketCount, scan.parsedMarketCount + scan.skippedMarketCount);
}

function buildLeaderboard(signals: ArenaSignal[], markets: ParsedMarket[]): LeaderboardEntry[] {
  const marketById = new Map(markets.map((market) => [market.id, market]));
  const grouped = new Map<SupportedAsset, LeaderboardEntry>();

  for (const signal of signals) {
    const market = marketById.get(signal.marketId);
    if (!market) {
      continue;
    }

    const current = grouped.get(market.asset) ?? {
      asset: market.asset,
      scoreBps: 0,
      signalCount: 0,
      committedCount: 0
    };

    current.scoreBps += signal.agentScoreBps;
    current.signalCount += 1;
    if (signal.committedTxHash) {
      current.committedCount += 1;
    }

    grouped.set(market.asset, current);
  }

  return [...grouped.values()]
    .map((entry) => ({
      ...entry,
      scoreBps: entry.signalCount === 0 ? 0 : Math.round(entry.scoreBps / entry.signalCount)
    }))
    .sort((left, right) => right.scoreBps - left.scoreBps);
}

function hasCommittedState(signal: Pick<ArenaSignal, 'committedTxHash' | 'commitmentStatus'>): boolean {
  return Boolean(signal.committedTxHash) || signal.commitmentStatus === 'committed';
}

function mergeCommittedState(
  signal: ArenaSignal,
  commitment?: CommitmentRecord
): ArenaSignal {
  if (!hasCommittedState(signal) && !commitment) {
    return signal;
  }

  return {
    ...signal,
    committedTxHash: signal.committedTxHash ?? commitment?.txHash,
    commitmentStatus: 'committed'
  };
}

function getActiveMarketIds(state: PersistedArenaState): string[] {
  if (state.activeMarketIds.length > 0) {
    return [...state.activeMarketIds];
  }

  return state.markets.map((market) => market.id);
}

function getActiveMarkets(state: PersistedArenaState): ParsedMarket[] {
  const marketById = new Map(state.markets.map((market) => [market.id, market]));
  return getActiveMarketIds(state)
    .map((marketId) => marketById.get(marketId))
    .filter((market): market is ParsedMarket => Boolean(market));
}

function getActiveSignals(state: PersistedArenaState): ArenaSignal[] {
  const activeMarketIds = new Set(getActiveMarketIds(state));
  return state.signals.filter((signal) => activeMarketIds.has(signal.marketId));
}

async function ensureStateFile() {
  const filePath = resolveStateFilePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(emptyState(), null, 2), 'utf8');
  }
}

export function createFileStore(): PredictArenaStore {
  let queue = Promise.resolve();

  async function readState(): Promise<PersistedArenaState> {
    await ensureStateFile();
    const contents = await fs.readFile(resolveStateFilePath(), 'utf8');
    return JSON.parse(contents) as PersistedArenaState;
  }

  async function writeState(state: PersistedArenaState) {
    await ensureStateFile();
    await fs.writeFile(resolveStateFilePath(), JSON.stringify(state, null, 2), 'utf8');
  }

  async function mutate<T>(updater: (state: PersistedArenaState) => T | Promise<T>): Promise<T> {
    const next = queue.then(async () => {
      const state = await readState();
      const result = await updater(state);
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
    async saveScan(input: SaveScanInput) {
      await mutate(async (state) => {
        state.activeMarketIds ??= [];
        const commitmentBySignalId = new Map(
          state.commitments.map((commitment) => [commitment.signalId, commitment])
        );
        const retainedSignals = state.signals
          .filter((signal) => hasCommittedState(signal) || commitmentBySignalId.has(signal.id))
          .map((signal) => mergeCommittedState(signal, commitmentBySignalId.get(signal.id)));
        const retainedMarketIds = new Set([
          ...input.markets.map((market) => market.id),
          ...retainedSignals.map((signal) => signal.marketId)
        ]);
        const marketById = new Map(state.markets.map((market) => [market.id, market]));
        for (const market of input.markets) {
          marketById.set(market.id, market);
        }

        state.latestScan = input.scan;
        state.activeMarketIds = input.markets.map((market) => market.id);
        state.markets = [...marketById.values()].filter((market) => retainedMarketIds.has(market.id));
        state.skips = [...input.skips];
        state.signals = retainedSignals;
      });
    },

    async getLatestScan() {
      const state = await readState();
      return state.latestScan;
    },

    async getMarkets() {
      const state = await readState();
      state.activeMarketIds ??= [];
      return getActiveMarkets(state);
    },

    async getSkips() {
      const state = await readState();
      return state.skips;
    },

    async getMarket(id: string) {
      const state = await readState();
      return state.markets.find((market) => market.id === id);
    },

    async saveArenaRuns(runs: ArenaRunResult[]) {
      await mutate(async (state) => {
        state.activeMarketIds ??= [];
        const commitmentBySignalId = new Map(
          state.commitments.map((commitment) => [commitment.signalId, commitment])
        );
        const existingSignalById = new Map(state.signals.map((signal) => [signal.id, signal]));
        const nextSignals = new Map(
          state.signals
            .filter((signal) => hasCommittedState(signal) || commitmentBySignalId.has(signal.id))
            .map((signal) => [
              signal.id,
              mergeCommittedState(signal, commitmentBySignalId.get(signal.id))
            ])
        );

        for (const run of runs) {
          const existingSignal = existingSignalById.get(run.signal.id) ?? nextSignals.get(run.signal.id);
          const commitment = commitmentBySignalId.get(run.signal.id);
          nextSignals.set(
            run.signal.id,
            mergeCommittedState(
              {
                ...run.signal,
                committedTxHash:
                  existingSignal?.committedTxHash ?? commitment?.txHash ?? run.signal.committedTxHash,
                commitmentStatus:
                  hasCommittedState(existingSignal ?? run.signal) || commitment
                    ? 'committed'
                    : run.signal.commitmentStatus
              },
              commitment
            )
          );
        }

        state.signals = [...nextSignals.values()];
        const retainedMarketIds = new Set([
          ...getActiveMarketIds(state),
          ...state.signals.map((signal) => signal.marketId)
        ]);
        state.markets = state.markets.filter((market) => retainedMarketIds.has(market.id));
      });
    },

    async getSignals() {
      const state = await readState();
      state.activeMarketIds ??= [];
      return getActiveSignals(state);
    },

    async getSignal(id: string) {
      const state = await readState();
      return state.signals.find((signal) => signal.id === id);
    },

    async saveCommitment(commitment: CommitmentRecord) {
      await mutate(async (state) => {
        if (state.commitments.some((existing) => existing.signalId === commitment.signalId)) {
          return;
        }

        state.commitments.push(commitment);
        state.signals = state.signals.map((signal) =>
          signal.id === commitment.signalId
            ? {
                ...signal,
                committedTxHash: commitment.txHash,
                commitmentStatus: 'committed'
              }
            : signal
        );
      });
    },

    async getDashboardStats() {
      const state = await readState();
      state.activeMarketIds ??= [];
      if (!state.latestScan) {
        return {
          totalScannedMarkets: 0,
          parsedMarkets: 0,
          skippedMarkets: 0,
          generatedSignals: 0,
          committedSignals: 0,
          usdcBondedMicro: 0,
          averageAgentScoreBps: 0
        } satisfies DashboardStats;
      }

      const activeSignals = getActiveSignals(state);
      const totalScore = activeSignals.reduce((sum, signal) => sum + signal.agentScoreBps, 0);
      const totalBonded = state.commitments.reduce(
        (sum, commitment) => sum + commitment.bondAmountMicroUsdc,
        0
      );

      return {
        totalScannedMarkets: resolveScannedMarketCount(state.latestScan),
        parsedMarkets: state.latestScan.parsedMarketCount,
        skippedMarkets: state.latestScan.skippedMarketCount,
        generatedSignals: activeSignals.length,
        committedSignals: state.commitments.length,
        usdcBondedMicro: totalBonded,
        averageAgentScoreBps:
          activeSignals.length === 0 ? 0 : Math.round(totalScore / activeSignals.length)
      };
    },

    async getLeaderboard() {
      const state = await readState();
      return buildLeaderboard(state.signals, state.markets);
    }
  };
}
