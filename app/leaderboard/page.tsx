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
        description="Compare signal throughput, edge quality, bonded USDC, paper ROI, and demo Brier score across deterministic agents."
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
                <p className="panel-kicker">Total Bonded</p>
                <strong>{formatMicroUsdc(metrics.totalBondedMicroUsdc)}</strong>
                <p>Arc Testnet signal bonds</p>
              </div>
            </div>
            <div className="detail-card">
              <SectionLabel>Current Leader</SectionLabel>
              <strong>{topAgent ? formatAgentName(topAgent.agentName) : 'pending'}</strong>
              <p>
                {topAgent ? `${formatBps(topAgent.averageEdgeBps)} average edge` : 'Run agents to populate the table.'}
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
