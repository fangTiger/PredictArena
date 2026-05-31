import { IntelligenceWorkspace } from '@/app/intelligence/IntelligenceWorkspace';
import { PageShell } from '@/components/PageShell';
import {
  buildMarketIntelligenceCatalog,
  buildPaperFollowResult,
  buildSegmentedAgentReputation,
  buildSignalResearchView,
  type AgentReputationFilters,
  type MarketCatalogFilters,
  type PaperFollowFilters
} from '@/lib/intelligence/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

const defaultMarketFilters: MarketCatalogFilters = {
  asset: 'all',
  conditionType: 'all',
  confidence: 'all',
  source: 'all',
  sort: 'opportunity_desc',
  minEdgeBps: 0,
  maxExpiryDays: 21,
  minLiquidity: 0,
  limit: 20
};

const defaultAgentFilters: AgentReputationFilters = {
  groupBy: 'agent',
  asset: 'all',
  conditionType: 'all',
  confidence: 'all',
  minResolved: 3
};

const defaultPaperFilters: PaperFollowFilters = {
  agentName: 'all',
  minEdgeBps: 700,
  confidence: 'all',
  asset: 'all',
  conditionType: 'all',
  from: null,
  to: null,
  stakeModel: 'signal_stake'
};

export default async function IntelligencePage() {
  const store = getRuntimeStore();
  const state = await store.getArenaState();

  const now = new Date().toISOString();
  const marketCatalog = buildMarketIntelligenceCatalog(state, defaultMarketFilters, now);
  const selectedMarketId = marketCatalog.items[0]?.marketId ?? null;
  const initialResearch = selectedMarketId
    ? buildSignalResearchView(state, { marketId: selectedMarketId }, now)
    : null;

  return (
    <PageShell>
      <IntelligenceWorkspace
        initialAgentFilters={defaultAgentFilters}
        initialAgentRows={buildSegmentedAgentReputation(state, defaultAgentFilters)}
        initialMarketCatalog={marketCatalog}
        initialMarketFilters={defaultMarketFilters}
        initialPaperFilters={defaultPaperFilters}
        initialPaperResult={buildPaperFollowResult(state, defaultPaperFilters, now)}
        initialResearch={initialResearch}
      />
    </PageShell>
  );
}
