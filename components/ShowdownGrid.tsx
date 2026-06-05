'use client';

import React from 'react';
import { useState } from 'react';
import { ShowdownCard, type ShowdownCardData } from '@/components/ShowdownCard';

export interface PreviewShowdownCandidate {
  kind?: 'opposing' | 'near_miss';
  marketId: string;
  marketQuestion: string;
  agentA: {
    name: string;
    side: 'YES' | 'NO' | 'AVOID';
    probabilityBps: number;
  };
  agentB: {
    name: string;
    side: 'YES' | 'NO' | 'AVOID';
    probabilityBps: number;
  };
  spreadBps: number;
  source: string;
}

interface ShowdownGridProps {
  showdowns: ShowdownCardData[];
  previewCandidates?: PreviewShowdownCandidate[];
  loading?: boolean;
  error?: string | Error | null;
}

const ACTIVE_LIMIT = 5;
const SETTLED_LIMIT = 5;

function isSettled(showdown: ShowdownCardData) {
  return showdown.status === 'SettledA' || showdown.status === 'SettledB';
}

function sortActive(left: ShowdownCardData, right: ShowdownCardData) {
  return Date.parse(left.deadline) - Date.parse(right.deadline);
}

function sortSettled(left: ShowdownCardData, right: ShowdownCardData) {
  return Date.parse(right.settledAt ?? right.openedAt) - Date.parse(left.settledAt ?? left.openedAt);
}

function formatPercent(probabilityBps: number) {
  return `${(probabilityBps / 100).toFixed(2)}%`;
}

function previewModeLabel(candidate: PreviewShowdownCandidate) {
  return candidate.kind === 'near_miss' ? 'Near-miss preview' : 'Arena preview';
}

export function ShowdownGrid({
  showdowns,
  previewCandidates = [],
  loading = false,
  error = null
}: ShowdownGridProps) {
  const [showAllActive, setShowAllActive] = useState(false);
  const [showAllSettled, setShowAllSettled] = useState(false);
  const active = showdowns.filter((showdown) => !isSettled(showdown)).sort(sortActive);
  const settled = showdowns.filter(isSettled).sort(sortSettled);
  const visibleActive = showAllActive ? active : active.slice(0, ACTIVE_LIMIT);
  const visibleSettled = showAllSettled ? settled : settled.slice(0, SETTLED_LIMIT);

  if (loading && showdowns.length === 0) {
    return <section className="showdown-grid-state">Loading showdowns...</section>;
  }

  if (error && showdowns.length === 0) {
    return <section className="showdown-grid-state showdown-grid-state-error">Showdowns are temporarily unavailable</section>;
  }

  if (showdowns.length === 0) {
    return (
      <section className="showdown-grid-state">
        <p>No showdowns are open yet.</p>
        <p>
          Run Agents generates fresh signals and automatically attempts to open eligible onchain
          matches.
        </p>
        <p>
          Arena can still stay empty when the agents agree, budget or gas safeguards block the
          open, or that market already has a live matchup.
        </p>
        {previewCandidates.length > 0 ? (
          <div className="showdown-preview-state" data-testid="showdown-preview-state">
            <div className="showdown-preview-intro">
              <div className="showdown-preview-tags">
                <span className="showdown-preview-tag">Preview only</span>
                <span className="showdown-preview-tag showdown-preview-tag-muted">Not on-chain</span>
              </div>
              <p>
                These candidates come from the latest in-memory run. Live-only discovery opens a
                real showdown only after live data plus budget, gas, and idempotency checks pass.
              </p>
            </div>
            <div className="showdown-preview-list">
              {previewCandidates.map((candidate) => (
                <article key={`${candidate.marketId}:${candidate.agentA.name}:${candidate.agentB.name}`} className="showdown-preview-card">
                  <div className="showdown-preview-head">
                    <div>
                      <p className="showdown-preview-label">{previewModeLabel(candidate)}</p>
                      <h3>{candidate.marketQuestion}</h3>
                    </div>
                    <strong>Spread {(candidate.spreadBps / 100).toFixed(2)}%</strong>
                  </div>
                  <div className="showdown-preview-agents">
                    <p>
                      {candidate.agentA.name} · {candidate.agentA.side} ·{' '}
                      {formatPercent(candidate.agentA.probabilityBps)}
                    </p>
                    <p>
                      {candidate.agentB.name} · {candidate.agentB.side} ·{' '}
                      {formatPercent(candidate.agentB.probabilityBps)}
                    </p>
                  </div>
                  <p className="showdown-preview-meta">Source: {candidate.source}</p>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="showdown-grid">
      <div className="showdown-grid-section" data-testid="showdown-grid-active">
        <div className="showdown-grid-header">
          <div>
            <p className="showdown-grid-kicker">Live arena</p>
            <h2 className="showdown-grid-heading">Active Showdowns</h2>
          </div>
          <div className="showdown-grid-meta">
            {visibleActive.length} / {active.length}
          </div>
        </div>
        <div className="showdown-grid-list">
          {visibleActive.map((showdown) => (
            <ShowdownCard key={showdown.id} showdown={showdown} />
          ))}
        </div>
        {!showAllActive && active.length > ACTIVE_LIMIT ? (
          <button
            type="button"
            className="showdown-grid-more"
            onClick={() => setShowAllActive(true)}
          >
            Show more ({active.length - ACTIVE_LIMIT})
          </button>
        ) : null}
      </div>

      <div className="showdown-grid-section" data-testid="showdown-grid-settled">
        <div className="showdown-grid-header">
          <div>
            <p className="showdown-grid-kicker">Closed matches</p>
            <h2 className="showdown-grid-heading">Settled Showdowns</h2>
          </div>
          <div className="showdown-grid-meta">{settled.length}</div>
        </div>
        <div className="showdown-grid-list">
          {visibleSettled.map((showdown) => (
            <ShowdownCard key={showdown.id} showdown={showdown} />
          ))}
        </div>
        {!showAllSettled && settled.length > SETTLED_LIMIT ? (
          <button
            type="button"
            className="showdown-grid-more"
            onClick={() => setShowAllSettled(true)}
          >
            Show more ({settled.length - SETTLED_LIMIT})
          </button>
        ) : null}
      </div>
    </section>
  );
}
