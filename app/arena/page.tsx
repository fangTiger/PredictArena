import { ArenaDashboard } from '@/components/arena-dashboard';
import { fetchCandidateMarkets } from '@/lib/polymarket/fetchMarkets';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

export default async function ArenaPage() {
  const store = getRuntimeStore();
  const state = await store.getArenaState();

  if (!state.latestScan) {
    const marketResult = await fetchCandidateMarkets();
    await store.saveMarketScan(marketResult);
  }

  return (
    <ArenaDashboard
      initialState={await store.getArenaState()}
      initialMetrics={await store.getMetrics()}
    />
  );
}
