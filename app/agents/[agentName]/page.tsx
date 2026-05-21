import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AgentBadge } from '@/components/AgentBadge';
import { HeroPill, NavPill, PageHero, PageShell, SectionLabel } from '@/components/PageShell';
import { TxLink } from '@/components/TxLink';
import {
  buildAgentReputationProfile,
  isSupportedAgentName
} from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import { formatBps, formatMicroUsdc } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

function OutcomePill({ correct }: { correct: boolean | null }) {
  if (correct === null) {
    return <span className="status-chip">Open</span>;
  }

  return (
    <span className={`status-chip ${correct ? 'status-ready' : 'status-risk'}`}>
      {correct ? 'Correct' : 'Incorrect'}
    </span>
  );
}

export default async function AgentReputationPage({
  params
}: {
  params: Promise<{ agentName: string }>;
}) {
  const { agentName } = await params;
  if (!isSupportedAgentName(agentName)) {
    notFound();
  }

  const state = await getRuntimeStore().getArenaState();
  const profile = buildAgentReputationProfile(state, agentName);

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <>
            <HeroPill tone="sky">Agent Reputation Profile</HeroPill>
            <AgentBadge agent={profile.agentName} />
          </>
        }
        title={profile.displayName}
        description="A public reputation ledger for generated signals, committed USDC bonds, open exposure, resolved outcomes, Brier score, and confidence quality."
        size="compact"
        actions={
          <>
            <NavPill href="/leaderboard">Back to Leaderboard</NavPill>
            <NavPill href="/demo-resolution">Demo Script</NavPill>
          </>
        }
        side={
          <div className="detail-stat-grid">
            <div className="detail-stat">
              <p className="panel-kicker">Resolved</p>
              <strong>{profile.resolvedSignals}</strong>
              <p>{formatBps(profile.accuracyBps)} accuracy</p>
            </div>
            <div className="detail-stat">
              <p className="panel-kicker">Brier</p>
              <strong>{profile.brierScoreBps === null ? 'Pending' : formatBps(profile.brierScoreBps)}</strong>
              <p>{profile.openSignals} open signals</p>
            </div>
          </div>
        }
      />

      <section className="reputation-grid">
        <article className="detail-card">
          <SectionLabel>Reputation Metrics</SectionLabel>
          <div className="detail-stat-grid detail-stat-grid-spaced">
            <div className="detail-stat">
              <p className="panel-kicker">Generated</p>
              <strong>{profile.generatedSignals}</strong>
              <p>{profile.committedSignals} committed</p>
            </div>
            <div className="detail-stat">
              <p className="panel-kicker">Average Edge</p>
              <strong>{formatBps(profile.averageEdgeBps)}</strong>
              <p>{formatBps(profile.paperRoiBps)} paper ROI</p>
            </div>
            <div className="detail-stat">
              <p className="panel-kicker">Bonded</p>
              <strong>{formatMicroUsdc(profile.totalBondedMicroUsdc)}</strong>
              <p>{formatMicroUsdc(profile.refundedMicroUsdc)} refunded</p>
            </div>
            <div className="detail-stat">
              <p className="panel-kicker">Slashed</p>
              <strong>{formatMicroUsdc(profile.slashedMicroUsdc)}</strong>
              <p>public memory</p>
            </div>
          </div>
        </article>

        <article className="detail-card">
          <SectionLabel>Confidence Mix</SectionLabel>
          <div className="confidence-bars">
            {(['low', 'medium', 'high'] as const).map((bucket) => (
              <div key={bucket}>
                <span>{bucket.toUpperCase()}</span>
                <strong>{profile.confidenceDistribution[bucket]}</strong>
              </div>
            ))}
          </div>
          <SectionLabel>Best / Worst Resolved</SectionLabel>
          <div className="receipt-stack">
            {[profile.bestResolvedSignal, profile.worstResolvedSignal].map((signal, index) => (
              <div key={index} className="receipt-mini-row">
                <strong>{index === 0 ? 'Best' : 'Worst'}</strong>
                {signal ? (
                  <>
                    <Link href={`/signals/${encodeURIComponent(signal.signalId)}`}>
                      {signal.signalId}
                    </Link>
                    <small>Brier {formatBps(signal.brierScoreBps ?? 0)} · {signal.marketQuestion}</small>
                  </>
                ) : (
                  <small>No resolved signal yet.</small>
                )}
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="leaderboard-table-shell">
        <div className="table-scroll">
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Confidence</th>
                <th>Edge</th>
                <th>Stake</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {profile.recentSignals.map((signal) => (
                <tr key={signal.signalId}>
                  <td>
                    <Link href={`/signals/${encodeURIComponent(signal.signalId)}`} className="table-agent-link">
                      {signal.signalId}
                    </Link>
                  </td>
                  <td>{signal.status}</td>
                  <td><OutcomePill correct={signal.outcomeCorrect} /></td>
                  <td>{signal.confidence}</td>
                  <td>{formatBps(signal.edgeBps)}</td>
                  <td>{formatMicroUsdc(signal.stakeMicroUsdc)}</td>
                  <td><TxLink hash={signal.txHash} /></td>
                </tr>
              ))}
              {profile.recentSignals.length === 0 ? (
                <tr>
                  <td colSpan={7}>No signals have been generated for this agent yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
