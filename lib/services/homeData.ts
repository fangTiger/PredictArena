import { readArcLatestBlock } from '@/lib/arc/blockNumber';
import type { ArenaMetrics } from '@/lib/persistence/store';
import { getRuntimeStore } from '@/lib/persistence/store';
import type { AgentSignal } from '@/lib/polymarket/types';

export interface HomeDataReaders {
  listSignals(): Promise<AgentSignal[]>;
  getMetrics(): Promise<ArenaMetrics>;
  readBlockNumber(): Promise<number>;
  nowMs(): number;
}

const EMPTY_METRICS: ArenaMetrics = {
  generatedSignals: 0,
  committedSignals: 0,
  resolvedSignals: 0,
  openSignals: 0,
  averageEdgeBps: 0,
  totalBondedMicroUsdc: 0
};

export const defaultHomeDataReaders: HomeDataReaders = {
  listSignals: () => getRuntimeStore().listSignals(),
  getMetrics: () => getRuntimeStore().getMetrics(),
  readBlockNumber: () => readArcLatestBlock(),
  nowMs: () => Date.now()
};

export interface HomeStripData {
  activeSignals: number;
  activeSignalsDelta: number;
  usdcBondedMicro: bigint;
  usdcBondedDelta24hMicro: bigint;
  accuracyBps: number;
  accuracyDeltaPp: number;
  showdownsWon: number;
  showdownsLeaderName: string;
  blockNumber: number | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

export async function getHomeStripData(
  readers: HomeDataReaders = defaultHomeDataReaders
): Promise<HomeStripData> {
  const [signals, metrics, blockNumber] = await Promise.all([
    readers.listSignals().catch(() => []),
    readers.getMetrics().catch(() => EMPTY_METRICS),
    readers.readBlockNumber().catch(() => null)
  ]);

  const nowMs = readers.nowMs();
  const activeSignalsDelta = signals.filter((signal) => {
    return Date.parse(signal.createdAt) >= nowMs - ONE_HOUR_MS;
  }).length;

  const usdcBondedDelta24hMicro = signals.reduce((sum, signal) => {
    if (
      Date.parse(signal.createdAt) < nowMs - ONE_DAY_MS ||
      !isBondedSignal(signal)
    ) {
      return sum;
    }

    return sum + BigInt(signal.stakeMicroUsdc);
  }, 0n);

  const resolvedSignals = signals.filter((signal) => signal.resolution !== null);
  const correctSignals = resolvedSignals.filter((signal) => signal.resolution?.outcomeCorrect === true);
  const accuracyBps =
    resolvedSignals.length === 0 ? 0 : Math.round((correctSignals.length / resolvedSignals.length) * 10_000);

  const thisWeekSignals = resolvedSignals.filter((signal) => {
    const resolvedAtMs = Date.parse(signal.resolution!.resolvedAt);
    return resolvedAtMs >= nowMs - ONE_WEEK_MS;
  });
  const priorWeekSignals = resolvedSignals.filter((signal) => {
    const resolvedAtMs = Date.parse(signal.resolution!.resolvedAt);
    return resolvedAtMs < nowMs - ONE_WEEK_MS && resolvedAtMs >= nowMs - 2 * ONE_WEEK_MS;
  });
  const accuracyDeltaPp =
    thisWeekSignals.length === 0 || priorWeekSignals.length === 0
      ? 0
      : calculateAccuracyBps(thisWeekSignals) / 100 - calculateAccuracyBps(priorWeekSignals) / 100;

  return {
    activeSignals: metrics.openSignals,
    activeSignalsDelta,
    usdcBondedMicro: BigInt(metrics.totalBondedMicroUsdc),
    usdcBondedDelta24hMicro,
    accuracyBps,
    accuracyDeltaPp,
    showdownsWon: 0,
    showdownsLeaderName: '—',
    blockNumber
  };
}

function calculateAccuracyBps(signals: AgentSignal[]): number {
  if (signals.length === 0) {
    return 0;
  }

  const correctSignals = signals.filter((signal) => signal.resolution?.outcomeCorrect === true).length;
  return Math.round((correctSignals / signals.length) * 10_000);
}

function isBondedSignal(signal: AgentSignal): boolean {
  return Boolean(signal.arcTxHash);
}
