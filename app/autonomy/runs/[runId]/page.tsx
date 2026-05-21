import Link from 'next/link';
import { notFound } from 'next/navigation';
import { HeroPill, NavPill, PageHero, PageShell, SectionLabel } from '@/components/PageShell';
import { TxLink } from '@/components/TxLink';
import { buildAutonomousRunReceipt } from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import { formatBps, formatIsoDateTime, formatMicroUsdc } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

function formatAgentName(agentName: 'volatility' | 'momentum') {
  return agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';
}

export default async function AutonomousRunReceiptPage({
  params
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const state = await getRuntimeStore().getArenaState();
  const receipt = buildAutonomousRunReceipt(state, decodeURIComponent(runId));

  if (!receipt) {
    notFound();
  }

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <>
            <HeroPill tone="sky">Autonomous Run Receipt</HeroPill>
            <HeroPill tone={receipt.source === 'live' ? 'mint' : 'neutral'}>
              {receipt.source}
            </HeroPill>
          </>
        }
        title="Run Receipt"
        description="A deterministic audit receipt for one scheduled agent run: inputs, policy outcomes, budgets, hashes, and Arc transaction references."
        size="compact"
        actions={
          <>
            <NavPill href="/arena">Back to Arena</NavPill>
            <NavPill href="/demo-resolution">Demo Script</NavPill>
          </>
        }
        side={
          <div className="detail-stat-grid">
            <div className="detail-stat">
              <p className="panel-kicker">Generated</p>
              <strong>{receipt.generatedSignalCount}</strong>
              <p>{receipt.marketCount} markets scanned</p>
            </div>
            <div className="detail-stat">
              <p className="panel-kicker">Queue</p>
              <strong>{receipt.committedCount} / {receipt.dryRunCount}</strong>
              <p>{receipt.skippedCount} skipped</p>
            </div>
          </div>
        }
      />

      <section className="receipt-grid">
        <article className="detail-card">
          <SectionLabel>Receipt Metadata</SectionLabel>
          <dl className="audit-list">
            <div>
              <dt>Run ID</dt>
              <dd className="audit-mono">{receipt.runId}</dd>
            </div>
            <div>
              <dt>Triggered</dt>
              <dd>{formatIsoDateTime(receipt.triggeredAt)}</dd>
            </div>
            <div>
              <dt>Completed</dt>
              <dd>{formatIsoDateTime(receipt.completedAt)}</dd>
            </div>
            <div>
              <dt>Mode By Agent</dt>
              <dd>
                Volatility {receipt.modeByAgent.volatility} · Momentum {receipt.modeByAgent.momentum}
              </dd>
            </div>
          </dl>
        </article>

        <article className="detail-card">
          <SectionLabel>Budget Snapshot</SectionLabel>
          <div className="receipt-stack">
            {receipt.budgetSnapshots.map((snapshot) => (
              <div key={snapshot.agentName} className="receipt-mini-row">
                <strong>{formatAgentName(snapshot.agentName)}</strong>
                <span>
                  {formatMicroUsdc(snapshot.dailyBondUsedUsdc6)} / {formatMicroUsdc(snapshot.policy.maxDailyBondUsdc6)}
                </span>
                <small>
                  {snapshot.signalsUsedToday}/{snapshot.policy.maxSignalsPerDay} daily · {snapshot.openSignals}/{snapshot.policy.maxOpenSignals} open · min edge {formatBps(snapshot.policy.minEdgeBps)}
                </small>
              </div>
            ))}
            {receipt.budgetSnapshots.length === 0 ? (
              <p className="muted">No budget snapshot was recorded for this run.</p>
            ) : null}
          </div>
        </article>
      </section>

      <section className="leaderboard-table-shell receipt-table-shell">
        <div className="table-scroll">
          <table className="leaderboard-table receipt-table">
            <thead>
              <tr>
                <th>Signal</th>
                <th>Agent</th>
                <th>Decision</th>
                <th>Edge</th>
                <th>Stake</th>
                <th>Model Hash</th>
                <th>Data Hash</th>
                <th>Failure / Tx</th>
              </tr>
            </thead>
            <tbody>
              {receipt.queue.map((entry) => (
                <tr key={`${entry.signalId}:${entry.status}`}>
                  <td>
                    <Link href={`/signals/${encodeURIComponent(entry.signalId)}`} className="table-agent-link">
                      {entry.signalId}
                    </Link>
                    <span className="receipt-question">{entry.marketQuestion ?? 'Signal not persisted'}</span>
                  </td>
                  <td>{formatAgentName(entry.agentName)}</td>
                  <td>{entry.status}</td>
                  <td>{formatBps(entry.edgeBps)}</td>
                  <td>{formatMicroUsdc(entry.stakeMicroUsdc)}</td>
                  <td className="audit-mono">{entry.modelHash ?? 'pending'}</td>
                  <td className="audit-mono">{entry.dataHash ?? 'pending'}</td>
                  <td>
                    {entry.txHash ? <TxLink hash={entry.txHash} /> : entry.reason ?? 'No chain transaction attempted'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  );
}
