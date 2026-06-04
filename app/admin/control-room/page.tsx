import React from 'react';
import { TxLink } from '@/components/TxLink';
import { getArcControlRoomState, type ArcControlRoomState } from '@/lib/arc/controlRoom';
import { formatMicroUsdc } from '@/lib/utils/format';

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

function formatAddress(value: `0x${string}` | null): string {
  return value ?? 'Not configured';
}

function formatMicro(value: string | null): string {
  return value === null ? 'Pending' : formatMicroUsdc(Number(value));
}

function readinessChip(controlRoom: ArcControlRoomState): string {
  if (controlRoom.commitAvailable) {
    return 'status-chip status-ready';
  }

  if (controlRoom.status === 'degraded') {
    return 'status-chip status-amber';
  }

  return 'status-chip';
}

function readinessLabel(controlRoom: ArcControlRoomState): string {
  if (controlRoom.commitAvailable) {
    return 'Commit available';
  }

  if (controlRoom.reason) {
    return controlRoom.reason.replaceAll('_', ' ');
  }

  return 'Read only';
}

export default async function AdminControlRoomPage() {
  const controlRoom = await getArcControlRoomState();
  const wallets = Object.entries(controlRoom.wallets) as Array<
    [
      keyof ArcControlRoomState['wallets'],
      ArcControlRoomState['wallets'][keyof ArcControlRoomState['wallets']]
    ]
  >;

  return (
    <section style={sectionStyle}>
      <header style={panelStyle}>
        <div className="deck-status-row">
          <span className={readinessChip(controlRoom)}>{readinessLabel(controlRoom)}</span>
          <span className={controlRoom.latestTxHash ? 'status-chip status-live' : 'status-chip'}>
            {controlRoom.latestTxHash ? 'Latest tx known' : 'No tx yet'}
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
            Control Room
          </p>
          <h1 style={{ margin: 0, fontSize: '2.1rem' }}>Arc Readiness</h1>
          <p style={mutedStyle}>
            Public operator facts for Arc chain readiness, agent wallet funding, allowance headroom,
            and the latest known autonomous transaction.
          </p>
        </div>
        <dl className="proof-hero-metrics">
          <div>
            <dt>Arc chain</dt>
            <dd>{controlRoom.chainId}</dd>
          </div>
          <div>
            <dt>Contract</dt>
            <dd>
              <code>{formatAddress(controlRoom.arenaAddress)}</code>
            </dd>
          </div>
          <div>
            <dt>USDC</dt>
            <dd>
              <code>{formatAddress(controlRoom.usdcAddress)}</code>
            </dd>
          </div>
          <div>
            <dt>Decimals</dt>
            <dd>{controlRoom.usdcDecimals}</dd>
          </div>
        </dl>
      </header>

      <section className="admin-ops-grid" aria-label="Arc readiness panels">
        <article className="panel proof-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Readiness state</p>
              <h2>Commit availability</h2>
            </div>
            <span className={readinessChip(controlRoom)}>{readinessLabel(controlRoom)}</span>
          </div>
          <dl className="proof-fact-grid">
            <div>
              <dt>Status</dt>
              <dd>{controlRoom.status}</dd>
            </div>
            <div>
              <dt>Latest tx</dt>
              <dd>
                <TxLink hash={controlRoom.latestTxHash} />
              </dd>
            </div>
            <div>
              <dt>Commit lane</dt>
              <dd>{controlRoom.commitAvailable ? 'Enabled' : 'Read only'}</dd>
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
              <p className="panel-kicker">Contract inventory</p>
              <h2>Arc addresses</h2>
            </div>
          </div>
          <div className="admin-ops-list">
            <article className="admin-ops-card">
              <strong>Arena contract</strong>
              <p className="admin-ops-code">
                <code>{formatAddress(controlRoom.arenaAddress)}</code>
              </p>
            </article>
            <article className="admin-ops-card">
              <strong>USDC asset</strong>
              <p className="admin-ops-code">
                <code>{formatAddress(controlRoom.usdcAddress)}</code>
              </p>
            </article>
          </div>
        </article>
      </section>

      <section className="panel proof-wallet-panel" aria-labelledby="control-room-wallets-title">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Wallet funding</p>
            <h2 id="control-room-wallets-title">Agent wallet public addresses</h2>
          </div>
        </div>
        <div className="proof-wallet-grid">
          {wallets.map(([agentName, wallet]) => (
            <article key={agentName}>
              <strong>{agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent'}</strong>
              <dl>
                <div>
                  <dt>Address</dt>
                  <dd>
                    <code>{formatAddress(wallet.publicAddress)}</code>
                  </dd>
                </div>
                <div>
                  <dt>USDC balance</dt>
                  <dd>{formatMicro(wallet.usdcBalanceMicroUsdc)}</dd>
                </div>
                <div>
                  <dt>Allowance</dt>
                  <dd>{formatMicro(wallet.allowanceMicroUsdc)}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
