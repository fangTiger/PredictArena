import Link from 'next/link';
import { DemoResolutionConsole } from './DemoResolutionConsole';
import { buildResolutionDemoScript } from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

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

const actionLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: '42px',
  padding: '0.72rem 1rem',
  border: '1px solid var(--admin-rule)',
  borderRadius: '14px',
  color: 'var(--admin-fg)',
  background: '#181818'
} as const;

export default async function DemoResolutionPage() {
  const script = buildResolutionDemoScript(await getRuntimeStore().getArenaState());
  const nextStep =
    script.steps.find((step) => step.state !== 'complete')?.title ??
    'All settlement steps recorded';

  return (
    <section style={sectionStyle}>
      <header style={panelStyle}>
        <div className="deck-status-row">
          <span className="status-chip status-live">Resolution Console</span>
          <span className="status-chip">Admin only</span>
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
            Settlement Rail
          </p>
          <h1 style={{ margin: 0, fontSize: '2.1rem' }}>Admin Resolution</h1>
          <p style={mutedStyle}>
            Guided settlement replay for committed demo signals. The operator token still gates the protected resolve route; this page only removes the public showcase chrome.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gap: '0.85rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))'
          }}
        >
          <article className="panel" style={{ minHeight: 'unset' }}>
            <p className="panel-kicker">Eligible</p>
            <strong>{script.eligibleSignals.length}</strong>
            <span className="muted">open committed signals</span>
          </article>
          <article className="panel" style={{ minHeight: 'unset' }}>
            <p className="panel-kicker">Recent Impact</p>
            <strong>{script.recentResolvedSignals.length}</strong>
            <span className="muted">resolved entries on record</span>
          </article>
          <article className="panel" style={{ minHeight: 'unset' }}>
            <p className="panel-kicker">Next Step</p>
            <strong>{nextStep}</strong>
            <span className="muted">current operator checkpoint</span>
          </article>
        </div>
        <div className="deck-status-row">
          <Link href="/admin/receipts" style={actionLinkStyle}>
            Receipts
          </Link>
          <Link href="/admin/proof" style={actionLinkStyle}>
            Proof
          </Link>
        </div>
      </header>
      <DemoResolutionConsole initialScript={script} />
    </section>
  );
}
