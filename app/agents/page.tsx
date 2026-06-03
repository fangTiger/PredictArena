import React from 'react';

export default function AgentsPage() {
  return (
    <section
      className="glass-card"
      style={{
        padding: 'clamp(1.4rem, 3vw, 2.2rem)',
        display: 'grid',
        gap: '1.2rem'
      }}
    >
      <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '40rem' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.78rem',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--glass-fg-mute)'
          }}
        >
          Glass Neon Placeholder
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>Agent dossiers</h1>
        <p style={{ margin: 0, color: 'var(--glass-fg-mute)', lineHeight: 1.8 }}>
          Reputation cards, drill-downs, and showdown receipts land here next. This slice only
          stages the public glass surface and routing skeleton.
        </p>
      </div>
    </section>
  );
}
