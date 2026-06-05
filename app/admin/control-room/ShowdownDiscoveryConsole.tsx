'use client';

import React from 'react';
import { useMemo, useState } from 'react';

interface DiscoverySkip {
  marketId: string;
  reason: string;
  detail?: string;
}

interface DiscoveryResult {
  discovered: number;
  opened: number;
  skips: DiscoverySkip[];
}

type DiscoveryState =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'success'; result: DiscoveryResult }
  | { status: 'error'; reason: string };

interface SkipSummary {
  reason: string;
  count: number;
  latestMarketId: string;
  latestDetail: string | null;
}

const actionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.75rem',
  alignItems: 'center'
} as const;

function readReason(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === 'object' &&
    'reason' in payload &&
    typeof payload.reason === 'string' &&
    payload.reason.length > 0
  ) {
    return payload.reason;
  }

  return fallback;
}

function normalizeResult(payload: unknown): DiscoveryResult {
  if (!payload || typeof payload !== 'object') {
    return { discovered: 0, opened: 0, skips: [] };
  }

  const result = payload as Partial<DiscoveryResult>;
  return {
    discovered: typeof result.discovered === 'number' ? result.discovered : 0,
    opened: typeof result.opened === 'number' ? result.opened : 0,
    skips: Array.isArray(result.skips)
      ? result.skips.flatMap((skip) => {
          if (!skip || typeof skip !== 'object') {
            return [];
          }

          const candidate = skip as Partial<DiscoverySkip>;
          if (typeof candidate.marketId !== 'string' || typeof candidate.reason !== 'string') {
            return [];
          }

          return [
            {
              marketId: candidate.marketId,
              reason: candidate.reason,
              detail: typeof candidate.detail === 'string' ? candidate.detail : undefined
            }
          ];
        })
      : []
  };
}

function summarizeSkips(skips: DiscoverySkip[]): SkipSummary[] {
  const grouped = new Map<string, SkipSummary>();

  for (const skip of skips) {
    const existing = grouped.get(skip.reason);
    if (existing) {
      existing.count += 1;
      existing.latestMarketId = skip.marketId;
      existing.latestDetail = skip.detail ?? existing.latestDetail;
      continue;
    }

    grouped.set(skip.reason, {
      reason: skip.reason,
      count: 1,
      latestMarketId: skip.marketId,
      latestDetail: skip.detail ?? null
    });
  }

  return Array.from(grouped.values());
}

function stateClassName(status: DiscoveryState['status']): string {
  if (status === 'success') {
    return 'status-chip status-ready';
  }

  if (status === 'error') {
    return 'status-chip status-risk';
  }

  if (status === 'pending') {
    return 'status-chip status-amber';
  }

  return 'status-chip';
}

function stateLabel(state: DiscoveryState): string {
  if (state.status === 'success') {
    return 'Discovery complete';
  }

  if (state.status === 'error') {
    return 'Discovery blocked';
  }

  if (state.status === 'pending') {
    return 'Discovering';
  }

  return 'Discovery idle';
}

function skipSummaryCopy(summary: SkipSummary): string {
  const marketLabel = summary.count === 1 ? 'market' : 'markets';
  const detailSuffix = summary.latestDetail ? `. ${summary.latestDetail}` : '';
  return `${summary.count} skipped ${marketLabel}. Latest: ${summary.latestMarketId}${detailSuffix}`;
}

export function ShowdownDiscoveryConsole() {
  const [state, setState] = useState<DiscoveryState>({ status: 'idle' });
  const result = state.status === 'success' ? state.result : null;
  const skipSummaries = useMemo(() => summarizeSkips(result?.skips ?? []), [result]);

  async function discoverShowdowns() {
    setState({ status: 'pending' });

    try {
      const response = await fetch('/api/showdowns/discover', {
        method: 'POST',
        headers: {
          accept: 'application/json'
        }
      });
      const payload = (await response.json().catch(() => null)) as unknown;

      if (!response.ok) {
        setState({
          status: 'error',
          reason: readReason(payload, 'showdown_discovery_failed')
        });
        return;
      }

      setState({
        status: 'success',
        result: normalizeResult(payload)
      });
    } catch {
      setState({
        status: 'error',
        reason: 'showdown_discovery_request_failed'
      });
    }
  }

  return (
    <section className="panel proof-panel" aria-labelledby="showdown-discovery-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Showdown Discovery</p>
          <h2 id="showdown-discovery-title">Operator Open Trigger</h2>
        </div>
        <span className={stateClassName(state.status)}>{stateLabel(state)}</span>
      </div>

      <p className="muted">
        Open eligible admin-gated showdowns explicitly when the Arena is empty. This console only
        calls the protected discovery endpoint, so regular users never trigger hidden operator
        transactions from Run Agents.
      </p>

      <div className="proof-precondition">
        <strong>Admin-only discovery control</strong>
        <p>Use this after readiness checks are green and new opposing agent signals should become visible in the Showdown Arena.</p>
        <span>Successful runs report discovered candidates, onchain opens, and skip reasons before you head back to Arena.</span>
      </div>

      <div style={actionRowStyle}>
        <button
          type="button"
          className="primary-button"
          onClick={discoverShowdowns}
          disabled={state.status === 'pending'}
        >
          {state.status === 'pending' ? 'Discovering...' : 'Discover Showdowns'}
        </button>
        {result ? (
          <a className="icon-link" href="/arena">
            Open Arena
          </a>
        ) : null}
      </div>

      {result ? (
        <>
          <dl className="proof-fact-grid">
            <div>
              <dt>Discovered</dt>
              <dd>{result.discovered}</dd>
            </div>
            <div>
              <dt>Opened</dt>
              <dd>{result.opened}</dd>
            </div>
            <div>
              <dt>Skips</dt>
              <dd>{result.skips.length}</dd>
            </div>
            <div>
              <dt>Next Step</dt>
              <dd>Back to /arena to review opened showdowns.</dd>
            </div>
          </dl>

          {skipSummaries.length > 0 ? (
            <ul className="skip-list" aria-label="Discovery skip summary">
              {skipSummaries.map((summary) => (
                <li key={summary.reason}>
                  <div>
                    <strong>{summary.reason}</strong>
                    <span>{skipSummaryCopy(summary)}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="admin-ops-empty">No skips were recorded in this discovery run.</p>
          )}
        </>
      ) : null}

      {state.status === 'error' ? (
        <div className="deck-status-row" aria-live="polite">
          <code className="audit-mono">{state.reason}</code>
        </div>
      ) : null}
    </section>
  );
}
