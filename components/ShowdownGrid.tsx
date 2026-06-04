'use client';

import React from 'react';
import { useState } from 'react';
import { ShowdownCard, type ShowdownCardData } from '@/components/ShowdownCard';

interface ShowdownGridProps {
  showdowns: ShowdownCardData[];
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

export function ShowdownGrid({ showdowns, loading = false, error = null }: ShowdownGridProps) {
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
    return <section className="showdown-grid-state">No showdowns yet</section>;
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
