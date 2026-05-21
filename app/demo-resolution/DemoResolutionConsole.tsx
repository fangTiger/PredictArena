'use client';

import { useState, useTransition } from 'react';
import type { ResolutionDemoScriptView } from '@/lib/insights/readModels';
import { formatBps, formatMicroUsdc } from '@/lib/utils/format';

export function DemoResolutionConsole({ initialScript }: { initialScript: ResolutionDemoScriptView }) {
  const [script, setScript] = useState(initialScript);
  const [token, setToken] = useState('');
  const [signalId, setSignalId] = useState(initialScript.eligibleSignals[0]?.signalId ?? '');
  const [outcomeCorrect, setOutcomeCorrect] = useState('true');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      setMessage(null);
      const response = await fetch('/api/admin/resolve-demo', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-admin-resolve-token': token
        },
        body: JSON.stringify({
          signalId,
          outcomeCorrect: outcomeCorrect === 'true'
        })
      });
      const payload = (await response.json()) as { reason?: string };

      if (!response.ok) {
        setMessage(payload.reason ?? 'demo_settlement_failed');
        return;
      }

      const refreshed = await fetch('/api/demo-script', { headers: { accept: 'application/json' } });
      const refreshedPayload = (await refreshed.json()) as { script: ResolutionDemoScriptView };
      setScript(refreshedPayload.script);
      setSignalId(refreshedPayload.script.eligibleSignals[0]?.signalId ?? '');
      setMessage('Demo settlement recorded. Leaderboard and reputation profiles can now be refreshed.');
    });
  }

  return (
    <section className="demo-script-grid">
      <article className="detail-card demo-script-card">
        <div className="admin-demo-header">
          <div>
            <p className="panel-kicker">{script.settlementLabel}</p>
            <h2 className="detail-title">Resolution Demo Script</h2>
          </div>
          <span className="status-chip status-amber">{script.oracleDisclaimer}</span>
        </div>
        <ol className="demo-step-list">
          {script.steps.map((step) => (
            <li key={step.id}>
              <span className={`status-chip ${step.state === 'complete' ? 'status-ready' : step.state === 'ready' ? 'status-live' : ''}`}>
                {step.state}
              </span>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </li>
          ))}
        </ol>
      </article>

      <article className="detail-card demo-script-card">
        <div className="admin-demo-header">
          <div>
            <p className="panel-kicker">Demo/Admin Only</p>
            <h2 className="detail-title">Settlement Command</h2>
          </div>
          <span className="status-chip status-amber">not an oracle</span>
        </div>
        <p className="detail-copy">
          Select one committed open signal, enter the configured admin token, and mark it correct or incorrect through the protected server route.
        </p>
        <div className="admin-demo-form demo-script-form">
          <label>
            <span>Committed Signal</span>
            <select value={signalId} onChange={(event) => setSignalId(event.target.value)}>
              {script.eligibleSignals.map((signal) => (
                <option key={signal.signalId} value={signal.signalId}>
                  {signal.signalId}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Admin Token</span>
            <input
              aria-label="Admin Token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              type="password"
              placeholder="ADMIN_RESOLVE_TOKEN"
            />
          </label>
          <label>
            <span>Settlement Outcome</span>
            <select
              aria-label="Settlement Outcome"
              value={outcomeCorrect}
              onChange={(event) => setOutcomeCorrect(event.target.value)}
            >
              <option value="true">Correct</option>
              <option value="false">Incorrect</option>
            </select>
          </label>
          <button type="button" onClick={submit} disabled={isPending || !token || !signalId}>
            Submit Demo Settlement
          </button>
        </div>
        {script.eligibleSignals.length === 0 ? (
          <p className="muted">No committed unresolved signal is available for demo settlement.</p>
        ) : null}
        {message ? <p className="muted">{message}</p> : null}
      </article>

      <article className="detail-card demo-script-card">
        <p className="panel-kicker">Eligible Signals</p>
        <div className="receipt-stack">
          {script.eligibleSignals.slice(0, 6).map((signal) => (
            <div key={signal.signalId} className="receipt-mini-row">
              <strong>{signal.signalId}</strong>
              <span>{signal.agentName} · {signal.side} · {signal.confidence}</span>
              <small>{formatBps(signal.edgeBps)} edge · {formatMicroUsdc(signal.stakeMicroUsdc)} bond</small>
            </div>
          ))}
          {script.eligibleSignals.length === 0 ? <p className="muted">Commit a signal before running the settlement demo.</p> : null}
        </div>
      </article>

      <article className="detail-card demo-script-card">
        <p className="panel-kicker">Recent Resolution Impact</p>
        <div className="receipt-stack">
          {script.recentResolvedSignals.slice(0, 6).map((signal) => (
            <div key={signal.signalId} className="receipt-mini-row">
              <strong>{signal.signalId}</strong>
              <span>{signal.outcomeCorrect ? 'Correct' : 'Incorrect'} · {signal.agentName}</span>
              <small>{signal.resolvedAt ?? 'pending'} · {formatMicroUsdc(signal.stakeMicroUsdc)}</small>
            </div>
          ))}
          {script.recentResolvedSignals.length === 0 ? <p className="muted">Resolved signals will appear here after demo settlement.</p> : null}
        </div>
      </article>
    </section>
  );
}
