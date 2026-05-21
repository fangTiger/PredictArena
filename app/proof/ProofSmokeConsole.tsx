'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import type { ProofSmokeView } from '@/lib/proof/service';

interface ProofSmokeConsoleProps {
  smoke: ProofSmokeView;
}

type SubmitState = 'idle' | 'pending' | 'complete' | 'blocked';

const PROOF_SECRET_STORAGE_KEY = 'predictarena:proof-secret';

function signalOptionLabel(signal: ProofSmokeView['eligibleSignals'][number]): string {
  return `${signal.agentName} - ${signal.confidence} - ${signal.id}`;
}

export function ProofSmokeConsole({ smoke }: ProofSmokeConsoleProps) {
  const [signalId, setSignalId] = useState(smoke.eligibleSignals[0]?.id ?? '');
  const [proofSecret, setProofSecret] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const selectedSignal =
    smoke.eligibleSignals.find((signal) => signal.id === signalId) ?? null;
  const hasEligibleSignals = smoke.eligibleSignals.length > 0;

  useEffect(() => {
    const storedSecret = window.sessionStorage.getItem(PROOF_SECRET_STORAGE_KEY);
    if (storedSecret) {
      setProofSecret(storedSecret);
    }
  }, []);

  useEffect(() => {
    if (!hasEligibleSignals) {
      return;
    }

    const stillEligible = smoke.eligibleSignals.some((signal) => signal.id === signalId);
    if (!stillEligible) {
      setSignalId(smoke.eligibleSignals[0].id);
    }
  }, [hasEligibleSignals, signalId, smoke.eligibleSignals]);

  function updateProofSecret(value: string) {
    setProofSecret(value);
    if (value) {
      window.sessionStorage.setItem(PROOF_SECRET_STORAGE_KEY, value);
      return;
    }

    window.sessionStorage.removeItem(PROOF_SECRET_STORAGE_KEY);
  }

  function forgetProofSecret() {
    setProofSecret('');
    window.sessionStorage.removeItem(PROOF_SECRET_STORAGE_KEY);
  }

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitState('pending');
    setMessage(null);
    window.sessionStorage.setItem(PROOF_SECRET_STORAGE_KEY, proofSecret);

    try {
      const response = await fetch('/api/proof/smoke', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json'
        },
        body: JSON.stringify({
          signalId,
          proofSecret,
          confirmTx: true
        })
      });
      const payload = (await response.json()) as {
        reason?: string;
        txHash?: string;
      };

      if (!response.ok) {
        setSubmitState('blocked');
        setMessage(payload.reason ?? 'proof_transaction_blocked');
        return;
      }

      setSubmitState('complete');
      setMessage(
        payload.txHash
          ? `tx ${payload.txHash.slice(0, 10)}...${payload.txHash.slice(-8)}`
          : 'proof_tx_committed'
      );
    } catch {
      setSubmitState('blocked');
      setMessage('proof_request_failed');
    }
  }

  const stateClass =
    submitState === 'complete'
      ? 'status-chip status-ready'
      : submitState === 'blocked'
        ? 'status-chip status-risk'
        : submitState === 'pending'
          ? 'status-chip status-amber'
          : 'status-chip';

  return (
    <section className="panel proof-smoke-panel" aria-labelledby="proof-smoke-title">
      <div className="panel-header">
        <div>
          <p className="panel-kicker">Proof Smoke</p>
          <h2 id="proof-smoke-title">Bounded Transaction Check</h2>
        </div>
        <div className="deck-status-row">
          <span className="status-chip">Read-only Proof</span>
          <span className="status-chip status-ready">Read-only safe</span>
        </div>
      </div>

      <dl className="proof-fact-grid">
        <div>
          <dt>Read-only Mode</dt>
          <dd>{smoke.transactionAttempted ? 'Transaction attempted' : 'No transaction sent'}</dd>
        </div>
        <div>
          <dt>Eligible Signals</dt>
          <dd>{smoke.commitPreconditions.eligibleSignalCount}</dd>
        </div>
        <div>
          <dt>Max Stake</dt>
          <dd>{smoke.proofLimits.maxStakePerSignalUsdc6.toLocaleString()} usdc6</dd>
        </div>
        <div>
          <dt>Daily Cap</dt>
          <dd>{smoke.proofLimits.maxDailySpendUsdc6.toLocaleString()} usdc6</dd>
        </div>
      </dl>

      <div className="proof-precondition">
        <strong>{smoke.commitPreconditions.blockingReasonCode ?? 'commit_available'}</strong>
        <p>{smoke.commitPreconditions.blockingFact}</p>
        <span>{smoke.commitPreconditions.nextAction}</span>
      </div>

      <form className="proof-form" onSubmit={submitProof}>
        <label>
          <span>Signal ID</span>
          {hasEligibleSignals ? (
            <select
              value={signalId}
              onChange={(event) => setSignalId(event.target.value)}
              aria-describedby="proof-selected-signal"
              required
            >
              {smoke.eligibleSignals.map((signal) => (
                <option key={signal.id} value={signal.id}>
                  {signalOptionLabel(signal)}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={signalId}
              onChange={(event) => setSignalId(event.target.value)}
              placeholder="existing-signal-id"
              autoComplete="off"
              required
            />
          )}
          <small id="proof-selected-signal" className="proof-signal-summary">
            {selectedSignal
              ? `Auto-selected eligible signal: ${selectedSignal.marketQuestion} (${selectedSignal.stakeMicroUsdc.toLocaleString()} usdc6, edge ${selectedSignal.edgeBps.toLocaleString()} bps)`
              : 'No eligible signal is available yet; run agents first or paste a valid signal id.'}
          </small>
        </label>
        <label>
          <span>Proof Secret</span>
          <div className="proof-secret-row">
            <input
              value={proofSecret}
              onChange={(event) => updateProofSecret(event.target.value)}
              type="password"
              autoComplete="off"
              required
            />
            <button type="button" onClick={forgetProofSecret} disabled={!proofSecret}>
              Forget
            </button>
          </div>
          <small className="proof-secret-state">
            {proofSecret ? 'Session unlocked' : 'Locked until a proof secret is entered'}
          </small>
        </label>
        <button type="submit" className="primary-button" disabled={submitState === 'pending'}>
          Send Bounded Proof
        </button>
      </form>

      <div className="deck-status-row" aria-live="polite">
        <span className={stateClass}>
          {submitState === 'idle' ? 'transaction idle' : submitState}
        </span>
        {message ? <code className="audit-mono">{message}</code> : null}
      </div>
    </section>
  );
}
