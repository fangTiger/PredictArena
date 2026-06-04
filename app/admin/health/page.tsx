import React from 'react';
import { getArcControlRoomState } from '@/lib/arc/controlRoom';
import { getServerEnv } from '@/lib/config/env';
import {
  buildOperatorHealthView,
  type OperatorHealthItem,
  type OperatorHealthView
} from '@/lib/ops/operatorHealth';
import { getRuntimeStore } from '@/lib/persistence/store';
import { formatIsoDateTime } from '@/lib/utils/format';

export const dynamic = 'force-dynamic';

const sectionStyle = {
  display: 'grid',
  gap: '1rem'
} as const;

const panelStyle = {
  display: 'grid',
  gap: '1rem',
  padding: '1.5rem',
  border: '1px solid var(--admin-rule)',
  borderRadius: '18px',
  background: '#141414'
} as const;

const mutedStyle = {
  margin: 0,
  lineHeight: 1.7,
  color: '#9c9c9c'
} as const;

function impactTone(item: OperatorHealthItem): string {
  if (item.impact === 'read_only_proof_safe') {
    return 'status-chip status-ready';
  }

  if (item.impact === 'demo_attention_needed' || item.impact === 'autonomy_dry_run_or_off') {
    return 'status-chip status-amber';
  }

  return 'status-chip status-risk';
}

function impactLabel(item: OperatorHealthItem): string {
  return item.impact.replaceAll('_', ' ');
}

function findItems(
  healthView: OperatorHealthView,
  reasonCodes: string[]
): OperatorHealthItem[] {
  return healthView.items.filter((item) => reasonCodes.includes(item.reasonCode));
}

function summaryChip(items: OperatorHealthItem[]): string {
  if (items.length === 0) {
    return 'status-chip status-ready';
  }

  if (items.some((item) => item.impact === 'bounded_tx_blocked' || item.impact === 'autonomy_blocked')) {
    return 'status-chip status-risk';
  }

  return 'status-chip status-amber';
}

function summaryLabel(items: OperatorHealthItem[], fallback: string): string {
  return items.length === 0 ? fallback : items.map((item) => item.reasonCode).join(' · ');
}

export default async function AdminHealthPage() {
  const env = getServerEnv();
  const store = getRuntimeStore();
  const [state, controlRoom] = await Promise.all([
    store.getArenaState(),
    getArcControlRoomState({ env, store })
  ]);
  const healthView = buildOperatorHealthView({
    env,
    state,
    controlRoom
  });
  const budgetItems = findItems(healthView, [
    'PROOF_BUDGET_EXHAUSTED',
    'PROOF_TRANSACTION_CAP_EXHAUSTED'
  ]);
  const fundingItems = findItems(healthView, ['ALLOWANCE_LOW', 'BALANCE_LOW']);
  const autonomyItems = findItems(healthView, ['AUTONOMY_DRY_RUN']);

  return (
    <section style={sectionStyle}>
      <header style={panelStyle}>
        <div className="deck-status-row">
          <span className={healthView.items.length === 0 ? 'status-chip status-ready' : 'status-chip status-amber'}>
            {healthView.items.length === 0 ? 'Ready' : `${healthView.items.length} blockers`}
          </span>
          <span
            className={
              healthView.persistenceMode === 'local_atomic' ? 'status-chip status-live' : 'status-chip'
            }
          >
            {healthView.persistenceMode === 'local_atomic' ? 'Local atomic' : 'Supabase best effort'}
          </span>
        </div>
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--admin-accent)'
            }}
          >
            Health
          </p>
          <h1 style={{ margin: 0, fontSize: '2.1rem' }}>Operator Health</h1>
          <p style={mutedStyle}>
            Status grid for cron posture, lock visibility, budget caps, chain readiness, funding
            warnings, and structured blocker actions.
          </p>
        </div>
      </header>

      <section className="admin-ops-grid" aria-label="Operator status grid">
        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Last cron</p>
              <h2>Autonomous run</h2>
            </div>
            <span className={healthView.latestRun?.status === 'failed' ? 'status-chip status-risk' : 'status-chip status-ready'}>
              {healthView.latestRun?.status ?? 'never run'}
            </span>
          </div>
          <dl className="proof-fact-grid">
            <div>
              <dt>Completed</dt>
              <dd>{healthView.latestRun ? formatIsoDateTime(healthView.latestRun.completedAt) : 'Pending'}</dd>
            </div>
            <div>
              <dt>Failure reason</dt>
              <dd>{healthView.latestRun?.failureReasonCode ?? 'none'}</dd>
            </div>
          </dl>
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Lock state</p>
              <h2>Scheduler visibility</h2>
            </div>
          </div>
          <dl className="proof-fact-grid">
            <div>
              <dt>Autonomy lock</dt>
              <dd>{healthView.locks.autonomy.active ? 'active' : healthView.locks.autonomy.zombie ? 'stale' : 'clear'}</dd>
            </div>
            <div>
              <dt>Autonomy expiry</dt>
              <dd>{healthView.locks.autonomy.expiresAt ? formatIsoDateTime(healthView.locks.autonomy.expiresAt) : 'none'}</dd>
            </div>
            <div>
              <dt>Proof lock</dt>
              <dd>{healthView.locks.proof.active ? 'active' : healthView.locks.proof.zombie ? 'stale' : 'clear'}</dd>
            </div>
            <div>
              <dt>Proof expiry</dt>
              <dd>{healthView.locks.proof.expiresAt ? formatIsoDateTime(healthView.locks.proof.expiresAt) : 'none'}</dd>
            </div>
          </dl>
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Budget warnings</p>
              <h2>Proof caps</h2>
            </div>
            <span className={summaryChip(budgetItems)}>{summaryLabel(budgetItems, 'clear')}</span>
          </div>
          <p className="muted">
            {budgetItems.length === 0
              ? 'Daily proof spend and transaction caps are below their warning thresholds.'
              : budgetItems.map((item) => item.blockingFact).join(' ')}
          </p>
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Chain readiness</p>
              <h2>Arc commit lane</h2>
            </div>
            <span className={controlRoom.commitAvailable ? 'status-chip status-ready' : 'status-chip status-amber'}>
              {controlRoom.commitAvailable ? 'ready' : 'degraded'}
            </span>
          </div>
          <dl className="proof-fact-grid">
            <div>
              <dt>Chain</dt>
              <dd>{controlRoom.chainId}</dd>
            </div>
            <div>
              <dt>Commit lane</dt>
              <dd>{controlRoom.commitAvailable ? 'enabled' : 'read only'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{controlRoom.status}</dd>
            </div>
            <div>
              <dt>Reason</dt>
              <dd>{controlRoom.reason ? controlRoom.reason.replaceAll('_', ' ') : 'clear'}</dd>
            </div>
          </dl>
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Allowance / balance</p>
              <h2>Funding warnings</h2>
            </div>
            <span className={summaryChip(fundingItems)}>{summaryLabel(fundingItems, 'clear')}</span>
          </div>
          <p className="muted">
            {fundingItems.length === 0
              ? 'Wallet allowance and balance checks are above the configured stake floor.'
              : fundingItems.map((item) => item.blockingFact).join(' ')}
          </p>
        </article>

        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Autonomy mode</p>
              <h2>Policy posture</h2>
            </div>
            <span className={summaryChip(autonomyItems)}>
              {env.autonomy.policies.volatility.mode} / {env.autonomy.policies.momentum.mode}
            </span>
          </div>
          <dl className="proof-fact-grid">
            <div>
              <dt>Volatility</dt>
              <dd>{env.autonomy.policies.volatility.mode}</dd>
            </div>
            <div>
              <dt>Momentum</dt>
              <dd>{env.autonomy.policies.momentum.mode}</dd>
            </div>
            <div>
              <dt>Operator action</dt>
              <dd>{autonomyItems[0]?.nextAction ?? 'No action required.'}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="panel proof-health-panel" aria-labelledby="operator-blockers-title">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Structured blockers</p>
            <h2 id="operator-blockers-title">Reason codes and next actions</h2>
          </div>
        </div>
        <div className="proof-health-list">
          {healthView.items.length === 0 ? (
            <article className="proof-health-item">
              <span className="status-chip status-ready">ready</span>
              <strong>All operator checks are clear.</strong>
              <p>Chain, proof, budget, and autonomy surfaces are within the configured envelope.</p>
              <small>No immediate action required.</small>
            </article>
          ) : (
            healthView.items.map((item) => (
              <article
                key={`${item.scope}:${item.reasonCode}:${item.impact}`}
                className="proof-health-item"
              >
                <div className="admin-ops-meta">
                  <span className={impactTone(item)}>{impactLabel(item)}</span>
                  <span className="status-chip">{item.scope}</span>
                </div>
                <strong>{item.reasonCode}</strong>
                <p>{item.blockingFact}</p>
                <small>{item.nextAction}</small>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
