import { createPersistenceStore } from '@/lib/persistence/store';
import { fetchCandidateMarkets } from '@/lib/polymarket/fetchMarkets';
import { fetchPriceSnapshots } from '@/lib/prices/fetchCandles';
import { runAgents } from '@/lib/agents/runAgents';

async function main() {
  const store = createPersistenceStore();
  const marketResult = await fetchCandidateMarkets();
  await store.saveMarketScan(marketResult);

  const assets = [...new Set(marketResult.markets.map((market) => market.asset))];
  const snapshots = await fetchPriceSnapshots(assets);
  const now = new Date().toISOString();
  const signals = runAgents(marketResult.markets, snapshots, { now });

  await store.saveAgentRun({
    runId: `seed:${now}`,
    source: marketResult.source,
    generatedAt: now,
    signals
  });

  console.log(`Seeded ${marketResult.markets.length} markets and ${signals.length} signals.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
