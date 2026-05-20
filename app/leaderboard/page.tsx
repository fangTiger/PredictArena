import { LeaderboardTable } from '@/components/LeaderboardTable';
import { MetricsStrip } from '@/components/MetricsStrip';
import { HeroPill, NavPill, PageHero, PageShell, SectionLabel } from '@/components/PageShell';
import { getRuntimeStore } from '@/lib/persistence/store';
import { formatBps, formatMicroUsdc } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

function formatAgentName(agentName: 'volatility' | 'momentum') {
  return agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';
}

export default async function LeaderboardPage() {
  const store = getRuntimeStore();
  const leaderboard = await store.getLeaderboard();
  const metrics = await store.getMetrics();
  const topAgent = leaderboard[0];
  const resolvedTotal = leaderboard.reduce((sum, entry) => sum + entry.resolvedSignals, 0);
  const correctWeightedTotal = leaderboard.reduce(
    (sum, entry) => sum + entry.resolvedSignals * entry.accuracyBps,
    0
  );
  const aggregateAccuracyBps =
    resolvedTotal === 0 ? 0 : Math.round(correctWeightedTotal / resolvedTotal);

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <>
            <HeroPill tone="mint">PredictArena Ledger</HeroPill>
            <HeroPill tone="sky">Auditable Track Record</HeroPill>
          </>
        }
        title="Leaderboard"
        description="Compare signal throughput, edge quality, resolved outcomes, bonded USDC, paper ROI, and Brier score across deterministic agents."
        actions={<NavPill href="/arena">Back to Arena</NavPill>}
        side={
          <div className="page-side-stack">
            <div className="detail-stat-grid">
              <div className="detail-stat">
                <p className="panel-kicker">Tracked Agents</p>
                <strong>{leaderboard.length}</strong>
                <p>volatility and momentum</p>
              </div>
              <div className="detail-stat">
                <p className="panel-kicker">Resolved Signals</p>
                <strong>{resolvedTotal}</strong>
                <p>{formatBps(aggregateAccuracyBps)} aggregate accuracy</p>
              </div>
            </div>
            <div className="detail-card">
              <SectionLabel>Current Leader</SectionLabel>
              <strong>{topAgent ? formatAgentName(topAgent.agentName) : 'pending'}</strong>
              <p>
                {topAgent
                  ? `${formatBps(topAgent.averageEdgeBps)} average edge, ${formatBps(topAgent.accuracyBps)} accuracy`
                  : 'Run agents to populate the table.'}
              </p>
            </div>
          </div>
        }
      />

      <MetricsStrip metrics={metrics} />
      <LeaderboardTable entries={leaderboard} />
    </PageShell>
  );
}
