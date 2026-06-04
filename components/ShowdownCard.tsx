'use client';

import React from 'react';

export interface ShowdownAgentView {
  name: string;
  side: string;
  probabilityBps: number;
  confidence: string;
  thesis: string;
}

export interface ShowdownCardData {
  id: string;
  onchainId?: string | number | null;
  marketId: string;
  marketQuestion: string;
  agentA: ShowdownAgentView;
  agentB: ShowdownAgentView;
  bondMicroUsdc: string;
  deadline: string;
  status: 'Open' | 'SettledA' | 'SettledB' | string;
  openedAt: string;
  settledAt?: string | null;
  openTxHash?: string | null;
  settleTxHash?: string | null;
  resolvedOutcome?: string | null;
  resolvedPriceLabel?: string | null;
}

interface ShowdownCardProps {
  showdown: ShowdownCardData;
}

function formatPercent(probabilityBps: number) {
  return `${(probabilityBps / 100).toFixed(2)}%`;
}

function formatUsdMicro(value: string) {
  return `$${(Number(value) / 1_000_000).toFixed(2)}`;
}

function formatUtc(value: string) {
  return `${new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(new Date(value))} UTC`;
}

function shortenHash(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function agentTone(side: string) {
  return side === 'YES' ? 'var(--color-yes)' : 'var(--color-no)';
}

function showdownPhase(showdown: ShowdownCardData) {
  if (showdown.status === 'SettledA' || showdown.status === 'SettledB') {
    return {
      className: 'showdown-card-tag-settled',
      label: 'RESOLVED'
    };
  }

  if (Date.parse(showdown.deadline) <= Date.now()) {
    return {
      className: 'showdown-card-tag-resolving',
      label: 'RESOLVING'
    };
  }

  return {
    className: 'showdown-card-tag-open',
    label: 'SHOWDOWN'
  };
}

function settlementCopy(showdown: ShowdownCardData, side: 'a' | 'b') {
  if (showdown.status !== 'SettledA' && showdown.status !== 'SettledB') {
    return null;
  }

  const winner = showdown.status === 'SettledA' ? 'a' : 'b';
  const bond = formatUsdMicro(showdown.bondMicroUsdc);
  const pot = formatUsdMicro(String(Number(showdown.bondMicroUsdc) * 2));

  if (winner === side) {
    return {
      className: 'showdown-agent-settlement-win',
      label: 'Winner payout',
      value: `+ ${pot} USDC`
    };
  }

  return {
    className: 'showdown-agent-settlement-loss',
    label: 'Forfeit',
    value: `- ${bond} USDC`
  };
}

function ShowdownAgent({
  agent,
  settlement,
  testId
}: {
  agent: ShowdownAgentView;
  settlement: ReturnType<typeof settlementCopy>;
  testId: string;
}) {
  return (
    <article className="showdown-agent" data-testid={testId}>
      <div className="showdown-agent-top">
        <div>
          <p className="showdown-agent-label">Agent</p>
          <h3 className="showdown-agent-name">{agent.name}</h3>
        </div>
        <div className={`showdown-agent-side showdown-agent-side-${agent.side.toLowerCase()}`}>
          {agent.side}
        </div>
      </div>

      <div className="showdown-agent-meta">
        <div className="showdown-agent-probability">
          <span className="showdown-agent-label">Probability</span>
          <strong style={{ color: agentTone(agent.side) }}>{formatPercent(agent.probabilityBps)}</strong>
        </div>
        <div className="showdown-agent-confidence">
          <span className="showdown-agent-label">Confidence</span>
          <strong>{agent.confidence}</strong>
        </div>
      </div>

      <p className="showdown-agent-thesis">{agent.thesis}</p>

      {settlement ? (
        <div className={`showdown-agent-settlement ${settlement.className}`}>
          <span>{settlement.label}</span>
          <strong>{settlement.value}</strong>
        </div>
      ) : null}
    </article>
  );
}

export function ShowdownCard({ showdown }: ShowdownCardProps) {
  const phase = showdownPhase(showdown);
  const potMicroUsdc = String(Number(showdown.bondMicroUsdc) * 2);
  const isSettled = showdown.status === 'SettledA' || showdown.status === 'SettledB';
  const txHash = shortenHash(isSettled ? showdown.settleTxHash : showdown.openTxHash);
  const settlementTime = showdown.settledAt ? formatUtc(showdown.settledAt) : null;

  return (
    <article className="showdown-card glass-card" data-testid="showdown-card">
      <div className="showdown-card-head">
        <div className="showdown-card-heading">
          <span className={`showdown-card-tag ${phase.className}`}>{phase.label}</span>
          <h2 className="showdown-card-question">{showdown.marketQuestion}</h2>
        </div>
        <div className="showdown-card-id">#{showdown.onchainId ?? showdown.marketId}</div>
      </div>

      <div className="showdown-card-metrics">
        <div className="showdown-card-metric">
          <span>Deadline UTC</span>
          <strong>{formatUtc(showdown.deadline)}</strong>
        </div>
        <div className="showdown-card-metric">
          <span>Bond per side</span>
          <strong>{formatUsdMicro(showdown.bondMicroUsdc)}</strong>
        </div>
        <div className="showdown-card-metric">
          <span>Combined pot</span>
          <strong>{formatUsdMicro(potMicroUsdc)}</strong>
        </div>
        {settlementTime ? (
          <div className="showdown-card-metric">
            <span>Settlement UTC</span>
            <strong>{settlementTime}</strong>
          </div>
        ) : null}
      </div>

      <div className="showdown-card-agents">
        <ShowdownAgent
          agent={showdown.agentA}
          settlement={settlementCopy(showdown, 'a')}
          testId="showdown-agent-a"
        />
        <ShowdownAgent
          agent={showdown.agentB}
          settlement={settlementCopy(showdown, 'b')}
          testId="showdown-agent-b"
        />
      </div>

      <footer className="showdown-card-footer">
        <div className="showdown-card-footer-block">
          <span className="showdown-card-footer-label">{isSettled ? 'Resolution' : 'Opened'}</span>
          <strong>{isSettled ? showdown.resolvedPriceLabel ?? 'Awaiting resolution label' : formatUtc(showdown.openedAt)}</strong>
        </div>
        {txHash ? (
          <div className="showdown-card-footer-block">
            <span className="showdown-card-footer-label">{isSettled ? 'Settle Tx' : 'Open Tx'}</span>
            <code className="showdown-card-hash">{txHash}</code>
          </div>
        ) : null}
      </footer>
    </article>
  );
}
