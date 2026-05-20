'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import type { ArenaSignal, DashboardState } from '@/types/predictarena';

interface ArenaDashboardProps {
  initialState: DashboardState;
}

function formatSourceLabel(source?: string) {
  if (source === 'demo_snapshot') {
    return 'demo snapshot';
  }

  if (source === 'live') {
    return 'live';
  }

  return 'not scanned';
}

function formatPercent(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatUsdMicro(micro: number) {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatTimestampLabel(value?: string) {
  if (!value) {
    return 'pending';
  }

  return value.slice(0, 16).replace('T', ' ');
}

export function ArenaDashboard({ initialState }: ArenaDashboardProps) {
  const [dashboard, setDashboard] = useState(initialState);
  const [isPending, startTransition] = useTransition();

  function runAction(url: string, method: 'GET' | 'POST') {
    startTransition(async () => {
      const response = await fetch(url, {
        method,
        headers: {
          accept: 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const payload = (await response.json()) as DashboardState;
      setDashboard(payload);
    });
  }

  function commitSignal(signal: ArenaSignal) {
    runAction(`/api/signals/${signal.id}/commit`, 'POST');
  }

  const sourceLabel = formatSourceLabel(dashboard.scan?.source);
  const fallbackReason = dashboard.scan?.fallbackReason;
  const latestSignal = dashboard.signals[0];
  const marketQuestions = new Map(dashboard.markets.map((market) => [market.id, market.question]));

  return (
    <main className="arena-shell">
      <section className="command-deck">
        <div className="deck-copy">
          <p className="deck-kicker">Arc Trading War Room</p>
          <h1>PredictArena</h1>
          <p className="deck-summary">
            Autonomous scan, deterministic agent forecasts, and Arc USDC signal commitments in one
            market-terminal surface. This stays a decision room, not a trading clone.
          </p>
          <div className="deck-status-row">
            <span className={`status-chip status-${dashboard.scan?.source ?? 'idle'}`}>Source: {sourceLabel}</span>
            <span className={`status-chip ${dashboard.commitDisabledReason ? 'status-risk' : 'status-ready'}`}>
              Arc commit: {dashboard.commitDisabledReason ? 'guarded' : 'armed'}
            </span>
            {fallbackReason ? <span className="status-chip status-amber">Fallback: {fallbackReason}</span> : null}
          </div>
        </div>

        <div className="deck-visual">
          <div className="visual-frame">
            <Image
              src="/predictarena-war-room.png"
              alt="PredictArena war room hero illustration"
              fill
              priority
              sizes="(max-width: 1100px) 100vw, 40vw"
              className="hero-image"
            />
            <div className="visual-grid">
              <span>BTC</span>
              <span>ETH</span>
              <span>SOL</span>
              <span>ARC</span>
            </div>
          </div>
        </div>

        <div className="deck-metrics">
          <article className="metric-card">
            <span>Markets Scanned</span>
            <strong>{dashboard.stats.totalScannedMarkets}</strong>
            <small>Latest sweep</small>
          </article>
          <article className="metric-card">
            <span>Parsed Markets</span>
            <strong>{dashboard.stats.parsedMarkets}</strong>
            <small>Scan {formatTimestampLabel(dashboard.scan?.createdAt)}</small>
          </article>
          <article className="metric-card">
            <span>Signals</span>
            <strong>{dashboard.stats.generatedSignals}</strong>
            <small>Deterministic agent output</small>
          </article>
          <article className="metric-card">
            <span>USDC Bonded</span>
            <strong>{formatUsdMicro(dashboard.stats.usdcBondedMicro)}</strong>
            <small>{dashboard.stats.committedSignals} committed</small>
          </article>
        </div>
      </section>

      <section className="war-room-grid">
        <article className="panel rail-panel market-rail">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Scan Control</p>
              <h2>Market Scan Rail</h2>
            </div>
            <span className="panel-value">{dashboard.stats.parsedMarkets}</span>
          </div>

          <div className="control-stack">
            <button type="button" onClick={() => runAction('/api/markets/scan', 'GET')} disabled={isPending}>
              Re-Scan Markets
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => runAction('/api/agents/run', 'POST')}
              disabled={isPending}
            >
              Run Agents
            </button>
          </div>

          <dl className="rail-stats">
            <div>
              <dt>Source</dt>
              <dd>{sourceLabel}</dd>
            </div>
            <div>
              <dt>Skipped</dt>
              <dd>{dashboard.stats.skippedMarkets}</dd>
            </div>
            <div>
              <dt>Fallback</dt>
              <dd>{fallbackReason ?? 'none'}</dd>
            </div>
            <div>
              <dt>Avg score</dt>
              <dd>{formatPercent(dashboard.stats.averageAgentScoreBps)}</dd>
            </div>
          </dl>

          <div className="market-list">
            {dashboard.markets.map((market) => (
              <section key={market.id} className="market-card">
                <div className="market-card-header">
                  <p className="market-asset">{market.asset}</p>
                  <span className="market-direction">{market.direction}</span>
                </div>
                <h3>{market.question}</h3>
                <dl className="market-metrics">
                  <div>
                    <dt>Strike</dt>
                    <dd>${(market.thresholdCents / 100).toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>YES</dt>
                    <dd>{formatPercent(market.yesPriceBps)}</dd>
                  </div>
                  <div>
                    <dt>NO</dt>
                    <dd>{formatPercent(market.noPriceBps)}</dd>
                  </div>
                  <div>
                    <dt>Liquidity</dt>
                    <dd>{formatPercent(market.liquidityScoreBps)}</dd>
                  </div>
                </dl>
              </section>
            ))}
            {dashboard.markets.length === 0 ? (
              <div className="empty-card">
                <p>No parsed markets yet. Trigger a scan to load the rail.</p>
              </div>
            ) : null}
          </div>
        </article>

        <article className="panel signal-board">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Agent Output</p>
              <h2>Signal Board</h2>
            </div>
            <span className="panel-value">{dashboard.signals.length}</span>
          </div>

          <div className="signal-board-meta">
            <span>Decision</span>
            <span>Confidence</span>
            <span>Edge</span>
            <span>Arc lane</span>
          </div>

          <div className="signal-list">
            {dashboard.signals.map((signal) => {
              const globalDisabled = dashboard.commitDisabledReason;
              const rowDisabledReason =
                signal.decision === 'AVOID'
                  ? signal.disabledReason ?? 'Risk agent avoided this setup'
                  : globalDisabled ?? (!signal.eligibleForCommit ? signal.disabledReason : undefined);

              return (
                <section key={signal.id} className="signal-card">
                  <div className="signal-card-top">
                    <div>
                      <p className="signal-id">{signal.id.replace('signal-', '')}</p>
                      <h3>{marketQuestions.get(signal.marketId) ?? signal.marketId}</h3>
                    </div>
                    <span className={`decision decision-${signal.decision.toLowerCase()}`}>{signal.decision}</span>
                  </div>

                  <div className="signal-grid">
                    <div>
                      <span className="signal-label">Confidence</span>
                      <strong>{formatPercent(signal.confidenceBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Edge</span>
                      <strong>{formatPercent(signal.edgeBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">YES / NO</span>
                      <strong>
                        {formatPercent(signal.yesProbabilityBps)} / {formatPercent(signal.noProbabilityBps)}
                      </strong>
                    </div>
                    <div>
                      <span className="signal-label">Bond</span>
                      <strong>{formatUsdMicro(signal.bondAmountMicroUsdc)}</strong>
                    </div>
                  </div>

                  <ul className="reason-list signal-reasons">
                    {signal.reasons.slice(0, 2).map((reason) => (
                      <li key={`${signal.id}-${reason}`}>{reason}</li>
                    ))}
                  </ul>

                  <div className="commit-cell">
                    {signal.committedTxHash ? (
                      <code>{truncateHash(signal.committedTxHash)}</code>
                    ) : rowDisabledReason ? (
                      <span className="muted">{rowDisabledReason}</span>
                    ) : (
                      <button type="button" onClick={() => commitSignal(signal)} disabled={isPending}>
                        Commit to Arc
                      </button>
                    )}
                  </div>
                </section>
              );
            })}

            {dashboard.signals.length === 0 ? (
              <div className="empty-card signal-empty">
                <p>Signals will appear here after you click Run Agents.</p>
              </div>
            ) : null}
          </div>
        </article>

        <aside className="panel rail-panel arc-rail">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Arc Commit Lane</p>
              <h2>Settlement Rail</h2>
            </div>
            <span className="panel-value">{dashboard.stats.committedSignals}</span>
          </div>

          <div className="commit-summary">
            {dashboard.lastCommitResult ? (
              dashboard.lastCommitResult.status === 'committed' ? (
                <>
                  <span className="summary-tone summary-positive">Commit confirmed</span>
                  <p>
                    <strong>{dashboard.lastCommitResult.signalId}</strong>
                    {' '}
                    settled to Arc with tx
                    {' '}
                    <code>{truncateHash(dashboard.lastCommitResult.txHash)}</code>
                  </p>
                </>
              ) : (
                <>
                  <span className="summary-tone summary-risk">Commit blocked</span>
                  <p>
                    <strong>{dashboard.lastCommitResult.signalId}</strong>
                    {' '}
                    remains gated:
                    {' '}
                    {dashboard.lastCommitResult.reason}
                  </p>
                </>
              )
            ) : latestSignal ? (
              <>
                <span className="summary-tone summary-neutral">Latest signal</span>
                <p>
                  <strong>{latestSignal.id.replace('signal-', '')}</strong>
                  {' '}
                  is ready for review in the Signal Board.
                </p>
              </>
            ) : (
              <>
                <span className="summary-tone summary-neutral">Awaiting forecast</span>
                <p>Run agents to populate the commitment rail.</p>
              </>
            )}
          </div>

          <div className="mini-metrics">
            <article>
              <span>Arc status</span>
              <strong>{dashboard.commitDisabledReason ? 'Guarded' : 'Configured'}</strong>
            </article>
            <article>
              <span>USDC bonded</span>
              <strong>{formatUsdMicro(dashboard.stats.usdcBondedMicro)}</strong>
            </article>
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <p className="panel-kicker">Leaderboard</p>
              <span>{dashboard.leaderboard.length}</span>
            </div>
            <ul className="leaderboard-list">
              {dashboard.leaderboard.map((entry) => (
                <li key={entry.asset}>
                  <div>
                    <strong>{entry.asset}</strong>
                    <span>{entry.signalCount} signals</span>
                  </div>
                  <div className="leaderboard-metric">
                    <strong>{formatPercent(entry.scoreBps)}</strong>
                    <span>{entry.committedCount} committed</span>
                  </div>
                </li>
              ))}
              {dashboard.leaderboard.length === 0 ? <li className="plain-list-item">Run agents to rank assets.</li> : null}
            </ul>
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <p className="panel-kicker">Skip Diagnostics</p>
              <span>{dashboard.skips.length}</span>
            </div>
            <ul className="skip-list">
              {dashboard.skips.slice(0, 8).map((skip) => (
                <li key={`${skip.marketId}-${skip.reason}`}>
                  <div>
                    <strong>{skip.reason}</strong>
                    <span>{skip.question ?? 'No question captured'}</span>
                  </div>
                  <code>{skip.marketId}</code>
                </li>
              ))}
              {dashboard.skips.length === 0 ? <li className="plain-list-item">No skipped markets in the latest scan.</li> : null}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
