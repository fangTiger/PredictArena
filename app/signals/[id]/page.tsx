import { notFound } from 'next/navigation';
import { AgentBadge } from '@/components/AgentBadge';
import { HeroPill, NavPill, PageHero, PageShell, SectionLabel } from '@/components/PageShell';
import { TxLink } from '@/components/TxLink';
import { AdminDemoSettlement } from '@/app/signals/[id]/AdminDemoSettlement';
import { fetchClobSpreadDiagnostic } from '@/lib/polymarket/orderbook';
import { getRuntimeStore } from '@/lib/persistence/store';
import { formatBps, formatMicroUsdc, formatUsd } from '@/lib/utils/format';
import { buildSignalExplanation, normalizeSignalIdParam } from '@/lib/utils/signal';

export const dynamic = 'force-dynamic';

function formatAgentName(agentName: 'volatility' | 'momentum') {
  return agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';
}

function formatModelPercent(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'Unavailable';
  }

  return `${(value * 100).toFixed(2)}%`;
}

function formatOptionalBps(value: number | null): string {
  return value === null ? 'Unavailable' : formatBps(value);
}

export default async function SignalDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const store = getRuntimeStore();
  const signal = await store.getSignal(normalizeSignalIdParam(id));

  if (!signal) {
    notFound();
  }

  const state = await store.getArenaState();
  const market = state.markets.find((entry) => entry.id === signal.marketId);
  const clobDiagnostic = await fetchClobSpreadDiagnostic(market?.clobTokenIds ?? []);
  const explanation = buildSignalExplanation(signal);
  const modelParams = JSON.stringify(signal.modelParams, null, 2);
  const resolution = signal.resolution
    ? `${signal.resolution.outcomeCorrect ? 'Correct' : 'Incorrect'} at ${signal.resolution.resolvedAt}`
    : 'Pending';
  const resolutionSource = signal.resolution?.source ?? 'pending';

  return (
    <PageShell>
      <PageHero
        eyebrow={
          <>
            <HeroPill tone="sky">Signal Detail</HeroPill>
            <HeroPill tone={signal.agentName === 'volatility' ? 'mint' : 'sky'}>
              {formatAgentName(signal.agentName)}
            </HeroPill>
          </>
        }
        title={signal.marketQuestion}
        description="A deterministic signal record with model inputs, hashes, risk flags, and Arc bond status in the same dashboard shell as the arena."
        size="compact"
        actions={
          <>
            <NavPill href="/arena">Back to Arena</NavPill>
            <NavPill href="/leaderboard">Leaderboard</NavPill>
          </>
        }
        side={
          <div className="page-side-stack">
            <div className="tag-row">
              <AgentBadge agent={signal.agentName} />
              <span className="status-chip">
                {signal.side}
              </span>
              <span className="status-chip status-amber">
                {signal.confidence} confidence
              </span>
            </div>
            <div className="detail-stat-grid">
              <div className="detail-stat">
                <p className="panel-kicker">Signal Edge</p>
                <strong>{formatBps(signal.edgeBps)}</strong>
                <p>Kelly cap {formatBps(signal.kellyBps)}</p>
              </div>
              <div className="detail-stat">
                <p className="panel-kicker">Bond</p>
                <strong>{formatMicroUsdc(signal.stakeMicroUsdc)}</strong>
                <p>{signal.status}</p>
              </div>
            </div>
            <div className="detail-card">
              <SectionLabel>Arc Tx</SectionLabel>
              <div>
                <TxLink hash={signal.arcTxHash} />
              </div>
            </div>
          </div>
        }
      />

      <section className="detail-card detail-card-large decision-trace-card">
        <div>
          <p className="panel-kicker">Agentic Audit</p>
          <h2 className="detail-title">Decision Trace</h2>
        </div>
        <div className="decision-trace-grid">
          <article className="trace-card">
            <span>Market Scout</span>
            <strong>{market ? formatBps(market.scoutScoreBps) : 'Unavailable'}</strong>
            <p>
              Liquidity {market ? formatUsd(market.liquidity) : 'unavailable'} · volume{' '}
              {market ? formatUsd(market.volume) : 'unavailable'}
            </p>
          </article>
          <article className="trace-card">
            <span>Volatility Summary</span>
            <strong>{formatModelPercent(signal.modelParams.sigma)}</strong>
            <p>
              7d {formatModelPercent(signal.modelParams.sigma7)} · 30d{' '}
              {formatModelPercent(signal.modelParams.sigma30)}
            </p>
          </article>
          <article className="trace-card">
            <span>Monte Carlo Probability</span>
            <strong>{formatBps(signal.pYesBps)}</strong>
            <p>Selected side probability {formatBps(signal.agentProbabilityBps)}</p>
          </article>
          <article className="trace-card">
            <span>Momentum Drift</span>
            <strong>{formatModelPercent(signal.modelParams.recentReturn7d)}</strong>
            <p>Model version {signal.modelVersion}</p>
          </article>
          <article className="trace-card trace-card-wide">
            <span>Risk Agent Timeline</span>
            <ol className="trace-timeline">
              <li>
                <strong>Parse and market sanity</strong>
                <p>{market ? `${formatBps(Math.round(market.parseConfidence * 10_000))} parse confidence` : 'Market snapshot unavailable'}</p>
              </li>
              <li>
                <strong>Edge gate</strong>
                <p>{signal.edgeBps >= 700 ? 'PASS' : 'BLOCK'} · {formatBps(signal.edgeBps)} edge</p>
              </li>
              <li>
                <strong>Risk Agent</strong>
                <p>{signal.riskFlags.length === 0 ? 'PASS with no flags' : `BLOCK / FLAGS: ${signal.riskFlags.join(', ')}`}</p>
              </li>
              <li>
                <strong>Commit eligibility</strong>
                <p>{signal.side !== 'AVOID' && signal.confidence !== 'LOW' ? 'Eligible for policy budget check' : 'Not eligible for autonomous commit'}</p>
              </li>
            </ol>
          </article>
          <article className="trace-card trace-card-wide">
            <span>Deterministic Payload</span>
            <pre className="audit-pre">{JSON.stringify({
              modelHash: signal.modelHash,
              dataHash: signal.dataHash,
              marketId: signal.marketId,
              side: signal.side,
              pYesBps: signal.pYesBps,
              modelParams: signal.modelParams
            }, null, 2)}</pre>
          </article>
          <article className="trace-card trace-card-wide">
            <span>CLOB Diagnostics</span>
            <strong>{clobDiagnostic.status}</strong>
            <p>
              Token {clobDiagnostic.tokenId ?? 'unavailable'} · spread{' '}
              {formatOptionalBps(clobDiagnostic.spreadBps)} · midpoint{' '}
              {formatOptionalBps(clobDiagnostic.midpointBps)}
            </p>
            <p>
              Liquidity{' '}
              {clobDiagnostic.liquidityUsd === null
                ? 'Unavailable'
                : formatUsd(clobDiagnostic.liquidityUsd)}
              {clobDiagnostic.reason ? ` · ${clobDiagnostic.reason}` : ''}
            </p>
          </article>
        </div>
      </section>

      <AdminDemoSettlement signalId={signal.id} />

      <section className="detail-layout">
        <article className="detail-card detail-card-large">
          <h2 className="detail-title">Deterministic Thesis</h2>
          <p className="detail-copy">{explanation}</p>

          <div className="detail-stat-grid detail-stat-grid-spaced">
            <div className="detail-stat">
              <p className="panel-kicker">Signal Edge</p>
              <strong>{formatBps(signal.edgeBps)}</strong>
              <p>
                Market {formatBps(signal.marketPriceBps)} vs agent {formatBps(signal.agentProbabilityBps)}
              </p>
            </div>
            <div className="detail-stat">
              <p className="panel-kicker">Bond</p>
              <strong>{formatMicroUsdc(signal.stakeMicroUsdc)}</strong>
              <p>Kelly cap {formatBps(signal.kellyBps)}</p>
            </div>
          </div>
        </article>

        <aside className="detail-card audit-card">
          <h2 className="detail-title">Audit Trail</h2>
          <dl className="audit-list">
            <div>
              <dt>Signal ID</dt>
              <dd className="audit-mono">{signal.id}</dd>
            </div>
            <div>
              <dt>Run ID</dt>
              <dd className="audit-mono">{signal.runId}</dd>
            </div>
            <div>
              <dt>Market ID</dt>
              <dd className="audit-mono">{signal.marketId}</dd>
            </div>
            <div>
              <dt>Asset</dt>
              <dd>{signal.asset}</dd>
            </div>
            <div>
              <dt>Condition Type</dt>
              <dd>{signal.conditionType}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{signal.status}</dd>
            </div>
            <div>
              <dt>Source</dt>
              <dd>{signal.source}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{signal.createdAt}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{signal.updatedAt}</dd>
            </div>
            <div>
              <dt>Threshold</dt>
              <dd>{formatUsd(signal.thresholdUsd)}</dd>
            </div>
            <div>
              <dt>Expiry</dt>
              <dd>{signal.expiresAt}</dd>
            </div>
            <div>
              <dt>pYes</dt>
              <dd>{formatBps(signal.pYesBps)}</dd>
            </div>
            <div>
              <dt>YES Price</dt>
              <dd>{formatBps(signal.yesPriceBps)}</dd>
            </div>
            <div>
              <dt>Confidence Bps</dt>
              <dd>{formatBps(signal.confidenceBps)}</dd>
            </div>
            <div>
              <dt>Risk Flags</dt>
              <dd>
                {signal.riskFlags.length > 0 ? signal.riskFlags.join(', ') : 'None'}
              </dd>
            </div>
            <div>
              <dt>Resolution</dt>
              <dd>{resolution}</dd>
            </div>
            <div>
              <dt>Resolution Source</dt>
              <dd>{resolutionSource}</dd>
            </div>
            <div>
              <dt>YES Outcome</dt>
              <dd>
                {signal.resolution?.yesOutcome === undefined
                  ? 'Pending'
                  : signal.resolution.yesOutcome
                    ? 'YES'
                    : 'NO'}
              </dd>
            </div>
            <div>
              <dt>Settlement Price</dt>
              <dd>
                {signal.resolution?.settlementPrice === undefined
                  ? 'Pending'
                  : formatUsd(signal.resolution.settlementPrice)}
              </dd>
            </div>
            <div>
              <dt>Observed At</dt>
              <dd>{signal.resolution?.observedAt ?? 'Pending'}</dd>
            </div>
            <div>
              <dt>Onchain Resolve Tx</dt>
              <dd>
                <TxLink hash={signal.resolution?.onchainTxHash ?? null} />
              </dd>
            </div>
            <div>
              <dt>Model Hash</dt>
              <dd className="audit-mono">{signal.modelHash}</dd>
            </div>
            <div>
              <dt>Data Hash</dt>
              <dd className="audit-mono">{signal.dataHash}</dd>
            </div>
            <div>
              <dt>Model Params</dt>
              <dd>
                <pre className="audit-pre">{modelParams}</pre>
              </dd>
            </div>
            <div>
              <dt>Arc Tx</dt>
              <dd>
                <TxLink hash={signal.arcTxHash} />
              </dd>
            </div>
            <div>
              <dt>Market Link</dt>
              <dd>
                {signal.marketUrl ? (
                  <a
                    href={signal.marketUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="tx-link"
                  >
                    Open Polymarket market
                  </a>
                ) : (
                  <span className="muted">Unavailable</span>
                )}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </PageShell>
  );
}
