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

interface MemoryState {
  latestScan?: ScanRecord;
  markets: ParsedMarket[];
  skips: SkippedMarket[];
  signals: ArenaSignal[];
  commitments: CommitmentRecord[];
  activeMarketIds: string[];
}

function emptyStats(): DashboardStats {
  return {
    totalScannedMarkets: 0,
    parsedMarkets: 0,
    skippedMarkets: 0,
    generatedSignals: 0,
    committedSignals: 0,
    usdcBondedMicro: 0,
    averageAgentScoreBps: 0
  };
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

function getActiveMarketIds(state: MemoryState): string[] {
  if (state.activeMarketIds.length > 0) {
    return [...state.activeMarketIds];
  }

  return state.markets.map((market) => market.id);
}

function getActiveMarkets(state: MemoryState): ParsedMarket[] {
  const marketById = new Map(state.markets.map((market) => [market.id, market]));
  return getActiveMarketIds(state)
    .map((marketId) => marketById.get(marketId))
    .filter((market): market is ParsedMarket => Boolean(market));
}

function getActiveSignals(state: MemoryState): ArenaSignal[] {
  const activeMarketIds = new Set(getActiveMarketIds(state));
  return state.signals.filter((signal) => activeMarketIds.has(signal.marketId));
}

export function createInMemoryStore(initialState?: Partial<MemoryState>): PredictArenaStore {
  const state: MemoryState = {
    latestScan: initialState?.latestScan,
    markets: initialState?.markets ? [...initialState.markets] : [],
    skips: initialState?.skips ? [...initialState.skips] : [],
    signals: initialState?.signals ? [...initialState.signals] : [],
    commitments: initialState?.commitments ? [...initialState.commitments] : [],
    activeMarketIds: initialState?.activeMarketIds
      ? [...initialState.activeMarketIds]
      : initialState?.markets?.map((market) => market.id) ?? []
  };

  return {
    async saveScan(input: SaveScanInput) {
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
    },

    async getLatestScan() {
      return state.latestScan;
    },

    async getMarkets() {
      return getActiveMarkets(state);
    },

    async getSkips() {
      return [...state.skips];
    },

    async getMarket(id: string) {
      return state.markets.find((market) => market.id === id);
    },

    async saveArenaRuns(runs: ArenaRunResult[]) {
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
    },

    async getSignals() {
      return getActiveSignals(state);
    },

    async getSignal(id: string) {
      return state.signals.find((signal) => signal.id === id);
    },

    async saveCommitment(commitment: CommitmentRecord) {
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
    },

    async getDashboardStats() {
      if (!state.latestScan) {
        return emptyStats();
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
      return buildLeaderboard(state.signals, state.markets);
    }
  };
}
