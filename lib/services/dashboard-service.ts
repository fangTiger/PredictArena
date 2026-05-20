import { getRuntimeStore } from '@/lib/server/store/runtime-store';
import { loadDashboardState, runArena } from '@/lib/services/arena-service';
import { scanMarkets } from '@/lib/services/scan-service';
import type { DashboardState } from '@/types/predictarena';

export async function ensureDashboardState(): Promise<DashboardState> {
  const store = getRuntimeStore();
  const latestScan = await store.getLatestScan();

  if (!latestScan) {
    await scanMarkets({ store });
  }

  return loadDashboardState(store);
}

export async function scanAndLoadDashboardState(): Promise<DashboardState> {
  const store = getRuntimeStore();
  await scanMarkets({ store });
  return loadDashboardState(store);
}

export async function runArenaAndLoadDashboardState(): Promise<DashboardState> {
  const store = getRuntimeStore();
  const latestScan = await store.getLatestScan();

  if (!latestScan) {
    await scanMarkets({ store });
  }

  await runArena(store);
  return loadDashboardState(store);
}
