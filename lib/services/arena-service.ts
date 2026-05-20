import { getCommitDisabledReason } from '@/lib/config/predictarena';
import { runArenaForMarket } from '@/lib/agents/run-arena';
import { buildPriceFeatureSet } from '@/lib/prices/feature-service';
import type { PredictArenaStore } from '@/lib/server/store/types';
import type { ArenaRunResult, DashboardState } from '@/types/predictarena';

export async function runArena(store: PredictArenaStore): Promise<ArenaRunResult[]> {
  const markets = await store.getMarkets();
  const runs = markets.map((market) => runArenaForMarket(market, buildPriceFeatureSet(market)));
  await store.saveArenaRuns(runs);
  return runs;
}

export async function loadDashboardState(store: PredictArenaStore): Promise<DashboardState> {
  const [scan, markets, skips, signals, stats, leaderboard] = await Promise.all([
    store.getLatestScan(),
    store.getMarkets(),
    store.getSkips(),
    store.getSignals(),
    store.getDashboardStats(),
    store.getLeaderboard()
  ]);

  return {
    scan,
    markets,
    skips,
    signals,
    stats,
    leaderboard,
    commitDisabledReason: getCommitDisabledReason()
  };
}
