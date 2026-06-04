import React from 'react';
import { TxLink } from '@/components/TxLink';
import { buildAutonomousRunReceipt, type AutonomousRunReceiptView } from '@/lib/insights/readModels';
import { getRuntimeStore, type ArenaState } from '@/lib/persistence/store';
import { formatBps, formatIsoDateTime, formatMicroUsdc } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const sectionStyle = {
  display: 'grid',
  gap: '1rem'
} as const;

const panelStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.5rem',
  border: '1px solid var(--admin-rule)',
  borderRadius: '18px',
  background: '#141414'
} as const;

const mutedStyle = {
  margin: 0,
  lineHeight: 1.7,
  color: '#9c9c9c'
} as const;

interface ReceiptEntry {
  receipt: AutonomousRunReceiptView;
  status: ArenaState['autonomyRuns'][number]['status'];
  failureReasonCode: string | null;
}

function formatModes(value: AutonomousRunReceiptView['modeByAgent']): string {
  return Object.entries(value)
    .map(([agentName, mode]) => `${agentName}: ${mode}`)
    .join(' · ');
}

function statusChip(status: ReceiptEntry['status']): string {
  if (status === 'failed') {
    return 'status-chip status-risk';
  }

  if (status === 'started') {
    return 'status-chip status-amber';
  }

  return 'status-chip status-ready';
}

function queueStatusLabel(value: AutonomousRunReceiptView['queue'][number]['status']): string {
  return value.replaceAll('_', ' ');
}

async function getReceiptEntries(): Promise<ReceiptEntry[]> {
  const store = getRuntimeStore();
  const state = await store.getArenaState();
  const entries: ReceiptEntry[] = [];

  for (const run of [...state.autonomyRuns].sort((left, right) =>
    right.triggeredAt.localeCompare(left.triggeredAt)
  )) {
    const receipt = buildAutonomousRunReceipt(state, run.runId);
    if (!receipt) {
      continue;
    }

    entries.push({
      receipt,
      status: run.status ?? 'completed',
      failureReasonCode: run.failureReasonCode ?? null
    });
  }

  return entries;
}

export default async function AdminReceiptsPage() {
  const receipts = await getReceiptEntries();

  return (
    <section style={sectionStyle}>
      <header style={panelStyle}>
        <div className="deck-status-row">
          <span className={receipts.length === 0 ? 'status-chip' : 'status-chip status-live'}>
            {receipts.length === 0 ? 'No runs yet' : `${receipts.length} runs`}
          </span>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--admin-accent)'
            }}
          >
            Receipts
          </p>
          <h1 style={{ margin: 0, fontSize: '2.1rem' }}>Autonomous Receipts</h1>
          <p style={mutedStyle}>
            Recent autonomous runs with timing, queue outcomes, budget posture, related signal
            hashes, and on-chain transaction evidence when present.
          </p>
        </div>
      </header>

      {receipts.length === 0 ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Receipt log</p>
              <h2>Recent runs</h2>
            </div>
          </div>
          <p className="admin-ops-empty">No autonomous receipts yet</p>
        </section>
      ) : (
        <div className="admin-ops-stack">
          {receipts.map(({ receipt, status, failureReasonCode }) => (
            <article key={receipt.runId} className="panel">
              <div className="panel-header">
                <div>
                  <p className="panel-kicker">Run receipt</p>
                  <h2>{receipt.runId}</h2>
                </div>
                <span className={statusChip(status)}>{status}</span>
              </div>

              <dl className="proof-hero-metrics">
                <div>
                  <dt>Source</dt>
                  <dd>{receipt.source}</dd>
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
                  <dt>Modes</dt>
                  <dd>{formatModes(receipt.modeByAgent)}</dd>
                </div>
              </dl>

              <section className="admin-ops-grid" aria-label={`${receipt.runId} summary`}>
                <article className="admin-ops-card">
                  <strong>Run counts</strong>
                  <dl className="proof-fact-grid">
                    <div>
                      <dt>Markets</dt>
                      <dd>{receipt.marketCount}</dd>
                    </div>
                    <div>
                      <dt>Signals</dt>
                      <dd>{receipt.generatedSignalCount}</dd>
                    </div>
                    <div>
                      <dt>Committed</dt>
                      <dd>{receipt.committedCount}</dd>
                    </div>
                    <div>
                      <dt>Skipped</dt>
                      <dd>{receipt.skippedCount}</dd>
                    </div>
                    <div>
                      <dt>Dry run</dt>
                      <dd>{receipt.dryRunCount}</dd>
                    </div>
                    <div>
                      <dt>Failure reason</dt>
                      <dd>{failureReasonCode ?? 'none'}</dd>
                    </div>
                  </dl>
                </article>

                <article className="admin-ops-card">
                  <strong>Budget snapshots</strong>
                  {receipt.budgetSnapshots.length === 0 ? (
                    <p className="muted">No budget snapshots recorded.</p>
                  ) : (
                    <div className="admin-ops-list">
                      {receipt.budgetSnapshots.map((snapshot) => (
                        <article key={`${receipt.runId}:${snapshot.agentName}`}>
                          <strong>{snapshot.agentName}</strong>
                          <dl className="proof-fact-grid">
                            <div>
                              <dt>Mode</dt>
                              <dd>{snapshot.mode}</dd>
                            </div>
                            <div>
                              <dt>Daily used</dt>
                              <dd>{formatMicroUsdc(snapshot.dailyBondUsedUsdc6)}</dd>
                            </div>
                            <div>
                              <dt>Signals today</dt>
                              <dd>{snapshot.signalsUsedToday}</dd>
                            </div>
                            <div>
                              <dt>Open signals</dt>
                              <dd>{snapshot.openSignals}</dd>
                            </div>
                            <div>
                              <dt>Stake cap</dt>
                              <dd>{formatMicroUsdc(snapshot.policy.maxStakePerSignalUsdc6)}</dd>
                            </div>
                            <div>
                              <dt>Min edge</dt>
                              <dd>{formatBps(snapshot.policy.minEdgeBps)}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  )}
                </article>
              </section>

              <section className="admin-ops-stack" aria-label={`${receipt.runId} queue`}>
                <div className="panel-header">
                  <div>
                    <p className="panel-kicker">Queue decisions</p>
                    <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Related signals</h3>
                  </div>
                </div>
                {receipt.queue.length === 0 ? (
                  <p className="admin-ops-empty">No queue decisions were recorded for this run.</p>
                ) : (
                  <div className="admin-ops-list">
                    {receipt.queue.map((entry) => (
                      <article key={`${receipt.runId}:${entry.signalId}`}>
                        <div className="admin-ops-meta">
                          <span className="status-chip status-live">{entry.agentName}</span>
                          <span className="status-chip">{queueStatusLabel(entry.status)}</span>
                          {entry.reason ? <span className="status-chip status-amber">{entry.reason}</span> : null}
                        </div>
                        <strong>{entry.marketQuestion ?? entry.signalId}</strong>
                        <dl className="proof-fact-grid">
                          <div>
                            <dt>Signal</dt>
                            <dd>{entry.signalId}</dd>
                          </div>
                          <div>
                            <dt>Market</dt>
                            <dd>{entry.marketId ?? 'unknown'}</dd>
                          </div>
                          <div>
                            <dt>Side</dt>
                            <dd>{entry.side ?? 'unknown'}</dd>
                          </div>
                          <div>
                            <dt>Confidence</dt>
                            <dd>{entry.confidence ?? 'unknown'}</dd>
                          </div>
                          <div>
                            <dt>Edge</dt>
                            <dd>{formatBps(entry.edgeBps)}</dd>
                          </div>
                          <div>
                            <dt>Stake</dt>
                            <dd>{formatMicroUsdc(entry.stakeMicroUsdc)}</dd>
                          </div>
                          <div>
                            <dt>Signal status</dt>
                            <dd>{entry.signalStatus ?? 'unknown'}</dd>
                          </div>
                          <div>
                            <dt>Tx</dt>
                            <dd>
                              <TxLink hash={entry.txHash} />
                            </dd>
                          </div>
                        </dl>
                        <p className="admin-ops-code">
                          <code>model: {entry.modelHash ?? 'unavailable'}</code>
                        </p>
                        <p className="admin-ops-code">
                          <code>data: {entry.dataHash ?? 'unavailable'}</code>
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
