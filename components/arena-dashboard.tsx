'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { buildArcTxUrl } from '@/lib/arc/explorer';
import type { AgentSignal, ParsedCryptoMarket } from '@/lib/polymarket/types';
import type { ArenaMetrics, ArenaState } from '@/lib/persistence/store';
import { isSignalEligibleForCommit } from '@/lib/utils/signal';

interface ArenaDashboardProps {
  initialMetrics: ArenaMetrics;
  initialState: ArenaState;
}

interface MarketsResponse {
  source: 'live' | 'demo_snapshot';
  fallbackReason?: string;
  markets: ParsedCryptoMarket[];
}

interface RunAgentsResponse extends MarketsResponse {
  signals: AgentSignal[];
  metrics: ArenaMetrics;
}

interface CommitResponse {
  reason?: string;
  signal?: AgentSignal;
  txHash?: `0x${string}`;
}

type CommitResult =
  | {
      status: 'committed';
      signalId: string;
      txHash: `0x${string}`;
    }
  | {
      status: 'disabled';
      signalId: string;
      reason: string;
    };

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

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
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

function signalDecisionClass(signal: AgentSignal) {
  if (signal.side === 'YES') {
    return 'decision-buy_yes';
  }

  if (signal.side === 'NO') {
    return 'decision-buy_no';
  }

  return 'decision-avoid';
}

function marketDirection(market: ParsedCryptoMarket) {
  return market.conditionType.replace('_', ' ');
}

function agentDisplayName(agentName: AgentSignal['agentName']) {
  return agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';
}

function buildSignalReasons(signal: AgentSignal) {
  const riskLine =
    signal.riskFlags.length > 0
      ? `Risk flags: ${signal.riskFlags.join(', ')}`
      : 'Risk agent cleared this signal.';

  return [
    `${signal.modelVersion} priced ${formatPercent(signal.agentProbabilityBps)} vs market ${formatPercent(signal.marketPriceBps)}.`,
    `${riskLine} Kelly capped at ${formatPercent(signal.kellyBps)}.`
  ];
}

function buildAssetLeaderboard(signals: AgentSignal[]) {
  const grouped = new Map<string, AgentSignal[]>();
  for (const signal of signals) {
    grouped.set(signal.asset, [...(grouped.get(signal.asset) ?? []), signal]);
  }

  return [...grouped.entries()]
    .map(([asset, assetSignals]) => {
      const scoreBps = Math.round(
        assetSignals.reduce((sum, signal) => sum + signal.edgeBps, 0) / assetSignals.length
      );

      return {
        asset,
        committedCount: assetSignals.filter((signal) => signal.arcTxHash).length,
        scoreBps,
        signalCount: assetSignals.length
      };
    })
    .sort((a, b) => b.scoreBps - a.scoreBps);
}

export function ArenaDashboard({ initialMetrics, initialState }: ArenaDashboardProps) {
  const [arena, setArena] = useState(initialState);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [lastCommitResult, setLastCommitResult] = useState<CommitResult | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshMarkets() {
    const response = await fetch('/api/markets', { headers: { accept: 'application/json' } });
    const payload = (await response.json()) as MarketsResponse;
    if (!response.ok) {
      throw new Error('Market scan failed.');
    }

    setArena((current) => ({
      ...current,
      latestScan: {
        fallbackReason: payload.fallbackReason,
        marketCount: payload.markets.length,
        scannedAt: new Date().toISOString(),
        source: payload.source
      },
      markets: payload.markets
    }));
  }

  async function runAgents() {
    const response = await fetch('/api/run-agents', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ limit: 20 })
    });
    const payload = (await response.json()) as RunAgentsResponse;
    if (!response.ok) {
      throw new Error('Agent run failed.');
    }

    const generatedAt = new Date().toISOString();
    setArena({
      latestScan: {
        fallbackReason: payload.fallbackReason,
        marketCount: payload.markets.length,
        scannedAt: generatedAt,
        source: payload.source
      },
      lastRun: {
        generatedAt,
        runId: `run:${Date.now()}`,
        source: payload.source
      },
      markets: payload.markets,
      signals: payload.signals
    });
    setMetrics(payload.metrics);
  }

  async function commitSignal(signal: AgentSignal) {
    const response = await fetch('/api/commit-signal', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ signalId: signal.id })
    });
    const payload = (await response.json()) as CommitResponse;

    if (!response.ok || !payload.signal || !payload.txHash) {
      setLastCommitResult({
        reason: payload.reason ?? 'Commit failed.',
        signalId: signal.id,
        status: 'disabled'
      });
      return;
    }

    const committedSignal = payload.signal;
    setArena((current) => ({
      ...current,
      signals: current.signals.map((currentSignal) =>
        currentSignal.id === committedSignal.id ? committedSignal : currentSignal
      )
    }));
    setMetrics((current) => ({
      ...current,
      committedSignals: current.committedSignals + 1,
      totalBondedMicroUsdc: current.totalBondedMicroUsdc + committedSignal.stakeMicroUsdc
    }));
    setLastCommitResult({
      signalId: signal.id,
      status: 'committed',
      txHash: payload.txHash
    });
  }

  async function commitEligibleSignals() {
    const pendingEligibleSignals = arena.signals.filter(
      (signal) => isSignalEligibleForCommit(signal) && !signal.arcTxHash
    );

    if (pendingEligibleSignals.length === 0) {
      setLastCommitResult({
        reason: 'No medium/high eligible signals are waiting for Arc commit.',
        signalId: 'eligible-signals',
        status: 'disabled'
      });
      return;
    }

    for (const signal of pendingEligibleSignals) {
      await commitSignal(signal);
    }
  }

  function runAction(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown dashboard action error.';
        setLastCommitResult({
          reason,
          signalId: 'dashboard',
          status: 'disabled'
        });
      }
    });
  }

  const sourceLabel = formatSourceLabel(arena.latestScan?.source);
  const fallbackReason = arena.latestScan?.fallbackReason;
  const latestSignal = arena.signals[0];
  const eligibleSignals = arena.signals.filter(
    (signal) => isSignalEligibleForCommit(signal) && !signal.arcTxHash
  );
  const assetLeaderboard = buildAssetLeaderboard(arena.signals);
  const scannedMarkets = arena.latestScan?.marketCount ?? arena.markets.length;
  const skippedMarkets = Math.max(scannedMarkets - arena.markets.length, 0);
  const commitArmed = eligibleSignals.length > 0;

  return (
    <main className="arena-shell">
      <section className="command-deck">
        <div className="deck-copy">
          <p className="deck-kicker">Arc Trading War Room</p>
          <h1>PredictArena</h1>
          <p className="deck-summary">
            Autonomous scan, deterministic agent forecasts, and Arc USDC signal commitments in one
            market-terminal surface. This stays a prediction room, not a trading clone.
          </p>
          <div className="deck-status-row">
            <span className={`status-chip status-${arena.latestScan?.source ?? 'idle'}`}>
              Source: {sourceLabel}
            </span>
            <span className={`status-chip ${commitArmed ? 'status-ready' : 'status-risk'}`}>
              Arc commit: {commitArmed ? 'armed' : 'guarded'}
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
            <strong>{scannedMarkets}</strong>
            <small>Latest sweep</small>
          </article>
          <article className="metric-card">
            <span>Parsed Markets</span>
            <strong>{arena.markets.length}</strong>
            <small>Scan {formatTimestampLabel(arena.latestScan?.scannedAt)}</small>
          </article>
          <article className="metric-card">
            <span>Signals</span>
            <strong>{arena.signals.length || metrics.generatedSignals}</strong>
            <small>Deterministic agent output</small>
          </article>
          <article className="metric-card">
            <span>USDC Bonded</span>
            <strong>{formatUsdMicro(metrics.totalBondedMicroUsdc)}</strong>
            <small>{metrics.committedSignals} committed</small>
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
            <span className="panel-value">{arena.markets.length}</span>
          </div>

          <div className="control-stack">
            <button type="button" onClick={() => runAction(refreshMarkets)} disabled={isPending}>
              Re-Scan Markets
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => runAction(runAgents)}
              disabled={isPending}
            >
              Run Agents
            </button>
            <button
              type="button"
              className="wide-button"
              onClick={() => runAction(commitEligibleSignals)}
              disabled={isPending || eligibleSignals.length === 0}
            >
              Commit Eligible Signals
            </button>
          </div>

          <dl className="rail-stats">
            <div>
              <dt>Source</dt>
              <dd>{sourceLabel}</dd>
            </div>
            <div>
              <dt>Skipped</dt>
              <dd>{skippedMarkets}</dd>
            </div>
            <div>
              <dt>Fallback</dt>
              <dd>{fallbackReason ?? 'none'}</dd>
            </div>
            <div>
              <dt>Avg edge</dt>
              <dd>{formatPercent(metrics.averageEdgeBps)}</dd>
            </div>
          </dl>

          <div className="market-list">
            {arena.markets.map((market) => (
              <section key={market.id} className="market-card">
                <div className="market-card-header">
                  <p className="market-asset">{market.asset}</p>
                  <span className="market-direction">{marketDirection(market)}</span>
                </div>
                <h3>{market.question}</h3>
                <dl className="market-metrics">
                  <div>
                    <dt>Strike</dt>
                    <dd>{formatUsd(market.thresholdUsd)}</dd>
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
                    <dt>Scout</dt>
                    <dd>{formatPercent(market.scoutScoreBps)}</dd>
                  </div>
                </dl>
              </section>
            ))}
            {arena.markets.length === 0 ? (
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
            <span className="panel-value">{arena.signals.length}</span>
          </div>

          <div className="signal-board-meta">
            <span>Decision</span>
            <span>Confidence</span>
            <span>Edge</span>
            <span>Arc lane</span>
          </div>

          <div className="signal-list">
            {arena.signals.map((signal) => {
              const disabledReason =
                signal.side === 'AVOID'
                  ? 'Risk agent avoided this setup'
                  : !isSignalEligibleForCommit(signal)
                    ? 'Signal below commit threshold'
                    : undefined;

              return (
                <section key={signal.id} className="signal-card">
                  <div className="signal-card-top">
                    <div>
                      <p className="signal-id">{signal.id}</p>
                      <h3>
                        <Link href={`/signals/${encodeURIComponent(signal.id)}`}>
                          {signal.marketQuestion}
                        </Link>
                      </h3>
                    </div>
                    <span className={`decision ${signalDecisionClass(signal)}`}>{signal.side}</span>
                  </div>

                  <div className="signal-grid">
                    <div>
                      <span className="signal-label">Agent</span>
                      <strong>{agentDisplayName(signal.agentName)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Asset / Strike</span>
                      <strong>
                        {signal.asset} {formatUsd(signal.thresholdUsd)}
                      </strong>
                    </div>
                    <div>
                      <span className="signal-label">Confidence</span>
                      <strong>{signal.confidence}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Edge</span>
                      <strong>{formatPercent(signal.edgeBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Agent Probability</span>
                      <strong>{formatPercent(signal.agentProbabilityBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Market Price</span>
                      <strong>{formatPercent(signal.marketPriceBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">YES Price</span>
                      <strong>{formatPercent(signal.yesPriceBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Capped Kelly</span>
                      <strong>{formatPercent(signal.kellyBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Risk Flags</span>
                      <strong>
                        {signal.riskFlags.length > 0 ? signal.riskFlags.join(', ') : 'None'}
                      </strong>
                    </div>
                    <div>
                      <span className="signal-label">Bond</span>
                      <strong>{formatUsdMicro(signal.stakeMicroUsdc)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Expiry</span>
                      <strong>{formatTimestampLabel(signal.expiresAt)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">Status</span>
                      <strong>{signal.status}</strong>
                    </div>
                  </div>

                  <ul className="reason-list signal-reasons">
                    {buildSignalReasons(signal).map((reason) => (
                      <li key={`${signal.id}-${reason}`}>{reason}</li>
                    ))}
                  </ul>

                  <div className="commit-cell">
                    {signal.arcTxHash ? (
                      <a href={buildArcTxUrl(signal.arcTxHash)} target="_blank" rel="noreferrer">
                        {truncateHash(signal.arcTxHash)}
                      </a>
                    ) : disabledReason ? (
                      <span className="muted">{disabledReason}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => runAction(() => commitSignal(signal))}
                        disabled={isPending}
                      >
                        Commit to Arc
                      </button>
                    )}
                  </div>
                </section>
              );
            })}

            {arena.signals.length === 0 ? (
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
            <span className="panel-value">{metrics.committedSignals}</span>
          </div>

          <div className="commit-summary">
            {lastCommitResult ? (
              lastCommitResult.status === 'committed' ? (
                <>
                  <span className="summary-tone summary-positive">Commit confirmed</span>
                  <p>
                    <strong>{lastCommitResult.signalId}</strong> settled to Arc with tx{' '}
                    <code>{truncateHash(lastCommitResult.txHash)}</code>
                  </p>
                </>
              ) : (
                <>
                  <span className="summary-tone summary-risk">Commit blocked</span>
                  <p>
                    <strong>{lastCommitResult.signalId}</strong> remains gated:{' '}
                    {lastCommitResult.reason}
                  </p>
                </>
              )
            ) : latestSignal ? (
              <>
                <span className="summary-tone summary-neutral">Latest signal</span>
                <p>
                  <strong>{latestSignal.id}</strong> is ready for review in the Signal Board.
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
              <strong>{commitArmed ? 'Armed' : 'Guarded'}</strong>
            </article>
            <article>
              <span>USDC bonded</span>
              <strong>{formatUsdMicro(metrics.totalBondedMicroUsdc)}</strong>
            </article>
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <p className="panel-kicker">Leaderboard</p>
              <span>{assetLeaderboard.length}</span>
            </div>
            <ul className="leaderboard-list">
              {assetLeaderboard.map((entry) => (
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
              {assetLeaderboard.length === 0 ? (
                <li className="plain-list-item">Run agents to rank assets.</li>
              ) : null}
            </ul>
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <p className="panel-kicker">Risk Diagnostics</p>
              <span>{arena.signals.filter((signal) => signal.riskFlags.length > 0).length}</span>
            </div>
            <ul className="skip-list">
              {arena.signals
                .filter((signal) => signal.riskFlags.length > 0)
                .slice(0, 8)
                .map((signal) => (
                  <li key={`${signal.id}-risk`}>
                    <div>
                      <strong>{signal.riskFlags.join(', ')}</strong>
                      <span>{signal.marketQuestion}</span>
                    </div>
                    <code>{signal.asset}</code>
                  </li>
                ))}
              {arena.signals.every((signal) => signal.riskFlags.length === 0) ? (
                <li className="plain-list-item">No risk flags in generated signals.</li>
              ) : null}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
