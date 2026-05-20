'use client';

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

  return (
    <main className="arena-shell">
      <section className="arena-hero">
        <div className="hero-copy">
          <h1>PredictArena</h1>
          <h2 className="hero-subheading">Autonomous Agent Arena</h2>
          <p className="hero-subtitle">
            Auto-scan BTC / ETH / SOL Polymarket markets, run deterministic agents, and surface
            Arc Testnet signal bonds without becoming a trading interface.
          </p>
        </div>
        <div className="hero-status">
          <span className={`status-pill status-${dashboard.scan?.source ?? 'idle'}`}>
            Source: {sourceLabel}
          </span>
          <span className="status-pill">
            Arc commit: {dashboard.commitDisabledReason ? 'disabled' : 'configured'}
          </span>
          {fallbackReason ? <span className="status-pill subtle">Fallback: {fallbackReason}</span> : null}
        </div>
      </section>

      {dashboard.lastCommitResult ? (
        <section className="notice-card">
          {dashboard.lastCommitResult.status === 'committed' ? (
            <p>
              Arc tx confirmed for <strong>{dashboard.lastCommitResult.signalId}</strong>:
              {' '}
              {dashboard.lastCommitResult.txHash}
            </p>
          ) : (
            <p>
              Commit disabled for <strong>{dashboard.lastCommitResult.signalId}</strong>:
              {' '}
              {dashboard.lastCommitResult.reason}
            </p>
          )}
        </section>
      ) : null}

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Markets Scanned</span>
          <strong>{dashboard.stats.totalScannedMarkets}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Parsed Markets</span>
          <strong>{dashboard.stats.parsedMarkets}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Signals</span>
          <strong>{dashboard.stats.generatedSignals}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Committed</span>
          <strong>{dashboard.stats.committedSignals}</strong>
        </article>
        <article className="stat-card accent">
          <span className="stat-label">USDC Bonded</span>
          <strong>{formatUsdMicro(dashboard.stats.usdcBondedMicro)}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <article className="panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Arena Controls</p>
              <h2>Scan + Forecast Flow</h2>
            </div>
            <div className="action-row">
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
          </div>

          <div className="market-list">
            {dashboard.markets.map((market) => (
              <div key={market.id} className="market-card">
                <div>
                  <p className="market-asset">{market.asset}</p>
                  <h3>{market.question}</h3>
                </div>
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
              </div>
            ))}
          </div>
        </article>

        <article className="panel side-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Parse Skip Reasons</p>
              <h2>Auto-Skipped Markets</h2>
            </div>
            <strong>{dashboard.skips.length}</strong>
          </div>
          <ul className="reason-list">
            {dashboard.skips.slice(0, 8).map((skip) => (
              <li key={`${skip.marketId}-${skip.reason}`}>
                <span>{skip.reason}</span>
                <code>{skip.marketId}</code>
              </li>
            ))}
            {dashboard.skips.length === 0 ? <li>No skipped markets in the latest scan.</li> : null}
          </ul>

          <div className="panel-header compact">
            <div>
              <p className="panel-kicker">Leaderboard</p>
              <h2>Agent Scoreboard</h2>
            </div>
          </div>
          <ul className="leaderboard-list">
            {dashboard.leaderboard.map((entry) => (
              <li key={entry.asset}>
                <span>{entry.asset}</span>
                <span>{formatPercent(entry.scoreBps)}</span>
                <span>{entry.signalCount} signals</span>
              </li>
            ))}
            {dashboard.leaderboard.length === 0 ? <li>Run agents to populate the leaderboard.</li> : null}
          </ul>
        </article>
      </section>

      <section className="panel signal-panel">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Agent Output</p>
            <h2>Signal Board</h2>
          </div>
          <strong>{dashboard.signals.length}</strong>
        </div>

        <div className="signal-table">
          <div className="signal-row signal-head">
            <span>Signal</span>
            <span>Decision</span>
            <span>Confidence</span>
            <span>Edge</span>
            <span>Arc</span>
          </div>
          {dashboard.signals.map((signal) => {
            const globalDisabled = dashboard.commitDisabledReason;
            const rowDisabledReason =
              signal.decision === 'AVOID'
                ? signal.disabledReason ?? 'Risk agent avoided this setup'
                : globalDisabled ?? (!signal.eligibleForCommit ? signal.disabledReason : undefined);

            return (
              <div key={signal.id} className="signal-row">
                <div>
                  <strong>{signal.id.replace('signal-', '')}</strong>
                  <p>{signal.reasons[0]}</p>
                </div>
                <span className={`decision decision-${signal.decision.toLowerCase()}`}>{signal.decision}</span>
                <span>{formatPercent(signal.confidenceBps)}</span>
                <span>{formatPercent(signal.edgeBps)}</span>
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
              </div>
            );
          })}
          {dashboard.signals.length === 0 ? (
            <div className="signal-empty">
              <p>Signals will appear here after you click Run Agents.</p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
