'use client';

import { useState, useTransition } from 'react';

export function AdminDemoSettlement({ signalId }: { signalId: string }) {
  const [token, setToken] = useState('');
  const [outcomeCorrect, setOutcomeCorrect] = useState('true');
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
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

      setMessage('Demo settlement recorded. Refresh leaderboard to inspect reputation updates.');
    });
  }

  return (
    <section className="detail-card admin-demo-card">
      <div className="admin-demo-header">
        <div>
          <p className="panel-kicker">Demo/Admin Only</p>
          <h2 className="detail-title">Admin / Demo Settlement</h2>
        </div>
        <span className="status-chip status-amber">not an oracle</span>
      </div>
      <p className="detail-copy">
        Use this hidden demo command to mark the selected signal correct or incorrect through the
        admin-token protected server route.
      </p>
      <button type="button" onClick={() => setOpen((current) => !current)}>
        Admin / Demo Settlement
      </button>
      {open ? (
        <>
          <div className="admin-demo-form">
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
            <button type="button" onClick={submit} disabled={isPending || !token}>
              Submit Demo Settlement
            </button>
          </div>
          {message ? <p className="muted">{message}</p> : null}
        </>
      ) : null}
    </section>
  );
}
