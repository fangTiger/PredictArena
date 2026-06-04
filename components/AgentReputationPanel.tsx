import React from 'react';
import type {
  AgentReputationProfile,
  ReputationSignalSummary
} from '@/lib/insights/readModels';
import { formatBps, formatIsoDateTime, formatMicroUsdc } from '@/lib/utils/format';

interface AgentReputationPanelProps {
  profile: AgentReputationProfile;
}

function formatWholeBps(value: number) {
  return `${value.toLocaleString('en-US')} bps`;
}

function signalStatusLabel(status: ReputationSignalSummary['status']) {
  switch (status) {
    case 'resolved_correct':
      return 'Resolved correct';
    case 'resolved_incorrect':
      return 'Resolved incorrect';
    case 'committed':
      return 'Committed';
    default:
      return 'Generated';
  }
}

function SummaryStat({ label, value, tone = 'default' }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`agent-panel-stat agent-panel-stat-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SignalCard({
  title,
  signal
}: {
  title: string;
  signal: ReputationSignalSummary | null;
}) {
  return (
    <article className="agent-signal-card">
      <p className="agent-kicker">{title}</p>
      {signal ? (
        <>
          <strong className="agent-signal-card-title">{signal.marketQuestion}</strong>
          <div className="agent-signal-inline">
            <span className={`agent-pill agent-pill-${signal.side.toLowerCase()}`}>{signal.side}</span>
            <span className="agent-pill">{signal.confidence}</span>
            <span className="agent-pill">{signalStatusLabel(signal.status)}</span>
          </div>
          <dl className="agent-signal-facts">
            <div>
              <dt>Stake</dt>
              <dd>{formatMicroUsdc(signal.stakeMicroUsdc)}</dd>
            </div>
            <div>
              <dt>Edge</dt>
              <dd>{formatWholeBps(signal.edgeBps)}</dd>
            </div>
            <div>
              <dt>Brier</dt>
              <dd>{signal.brierScoreBps === null ? '—' : formatBps(signal.brierScoreBps)}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="agent-muted-copy">No resolved signal yet.</p>
      )}
    </article>
  );
}

function SignalRow({ signal }: { signal: ReputationSignalSummary }) {
  return (
    <article className="agent-timeline-row">
      <div className="agent-timeline-main">
        <strong>{signal.marketQuestion}</strong>
        <div className="agent-signal-inline">
          <span className={`agent-pill agent-pill-${signal.side.toLowerCase()}`}>{signal.side}</span>
          <span className="agent-pill">{signal.confidence}</span>
          <span className="agent-pill">{signalStatusLabel(signal.status)}</span>
        </div>
      </div>
      <dl className="agent-timeline-metrics">
        <div>
          <dt>Stake</dt>
          <dd>{formatMicroUsdc(signal.stakeMicroUsdc)}</dd>
        </div>
        <div>
          <dt>Edge</dt>
          <dd>{formatWholeBps(signal.edgeBps)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatIsoDateTime(signal.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function AgentReputationPanel({ profile }: AgentReputationPanelProps) {
  return (
    <section className="agent-panel">
      <div className="agent-panel-hero glass-card">
        <div>
          <p className="agent-kicker">Public drill-down</p>
          <h1>{profile.displayName}</h1>
          <p className="agent-muted-copy">
            Generated conviction, bonded size, and resolved trail are rendered from the persisted
            read model.
          </p>
        </div>
        <div className="agent-panel-hero-chip">{profile.agentName}</div>
      </div>

      <div className="agent-panel-grid">
        <section className="agent-panel-block glass-card">
          <div className="agent-panel-head">
            <div>
              <p className="agent-kicker">Overview</p>
              <h2>Reputation summary</h2>
            </div>
          </div>
          <div className="agent-panel-stat-grid">
            <SummaryStat
              label="Generated signals"
              value={profile.generatedSignals.toLocaleString('en-US')}
            />
            <SummaryStat label="Committed" value={profile.committedSignals.toLocaleString('en-US')} />
            <SummaryStat label="Resolved" value={profile.resolvedSignals.toLocaleString('en-US')} />
            <SummaryStat label="Open" value={profile.openSignals.toLocaleString('en-US')} />
            <SummaryStat label="Accuracy" value={formatBps(profile.accuracyBps)} tone="accent" />
            <SummaryStat
              label="Average edge"
              value={formatWholeBps(profile.averageEdgeBps)}
              tone="accent"
            />
            <SummaryStat
              label="Bonded capital"
              value={formatMicroUsdc(profile.totalBondedMicroUsdc)}
              tone="bonded"
            />
            <SummaryStat
              label="Paper ROI"
              value={formatBps(profile.paperRoiBps)}
              tone={profile.paperRoiBps < 0 ? 'loss' : 'win'}
            />
            <SummaryStat
              label="Refunded"
              value={formatMicroUsdc(profile.refundedMicroUsdc)}
              tone="win"
            />
            <SummaryStat
              label="Slashed"
              value={formatMicroUsdc(profile.slashedMicroUsdc)}
              tone="loss"
            />
            <SummaryStat
              label="Brier score"
              value={profile.brierScoreBps === null ? '—' : formatBps(profile.brierScoreBps)}
            />
          </div>
        </section>

        <section className="agent-panel-block glass-card">
          <div className="agent-panel-head">
            <div>
              <p className="agent-kicker">Distribution</p>
              <h2>Confidence mix</h2>
            </div>
          </div>
          <div className="agent-confidence-grid">
            <SummaryStat
              label="Low confidence"
              value={profile.confidenceDistribution.low.toLocaleString('en-US')}
            />
            <SummaryStat
              label="Medium confidence"
              value={profile.confidenceDistribution.medium.toLocaleString('en-US')}
            />
            <SummaryStat
              label="High confidence"
              value={profile.confidenceDistribution.high.toLocaleString('en-US')}
            />
          </div>
        </section>
      </div>

      <div className="agent-panel-grid">
        <SignalCard title="Best resolved signal" signal={profile.bestResolvedSignal} />
        <SignalCard title="Worst resolved signal" signal={profile.worstResolvedSignal} />
      </div>

      <section className="agent-panel-block glass-card">
        <div className="agent-panel-head">
          <div>
            <p className="agent-kicker">Timeline</p>
            <h2>Recent signals</h2>
          </div>
        </div>
        <div className="agent-timeline">
          {profile.recentSignals.length > 0 ? (
            profile.recentSignals.map((signal) => (
              <SignalRow key={signal.signalId} signal={signal} />
            ))
          ) : (
            <p className="agent-muted-copy">No signals recorded yet.</p>
          )}
        </div>
      </section>
    </section>
  );
}
