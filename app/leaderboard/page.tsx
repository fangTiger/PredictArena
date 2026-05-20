import { LeaderboardTable } from '@/components/LeaderboardTable';
import { MetricsStrip } from '@/components/MetricsStrip';
import { HeroPill, NavPill, PageHero, PageShell, SectionLabel } from '@/components/PageShell';
import { getRuntimeStore } from '@/lib/persistence/store';
import { formatBps, formatMicroUsdc } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

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
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Tracked Agents</p>
                <strong className="mt-2 block font-display text-2xl text-white">
                  {leaderboard.length}
                </strong>
                <p className="mt-2 text-sm text-slate-400">volatility and momentum</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Total Bonded</p>
                <strong className="mt-2 block font-display text-2xl text-white">
                  {formatMicroUsdc(metrics.totalBondedMicroUsdc)}
                </strong>
                <p className="mt-2 text-sm text-slate-400">Arc Testnet signal bonds</p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <SectionLabel>Current Leader</SectionLabel>
              <strong className="mt-2 block font-display text-2xl text-white">
                {topAgent?.agentName ?? 'pending'}
              </strong>
              <p className="mt-2 text-sm text-slate-400">
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
