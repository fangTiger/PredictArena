import React from 'react';

export default function MyPage() {
  return (
    <section
      className="glass-card"
      style={{
        padding: 'clamp(1.4rem, 3vw, 2.2rem)',
        display: 'grid',
        gap: '1.2rem'
      }}
    >
      <div style={{ display: 'grid', gap: '0.5rem', maxWidth: '38rem' }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.78rem',
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--glass-fg-mute)'
          }}
        >
          Personal Dashboard Placeholder
        </p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 3.5rem)' }}>Wallet-bound record</h1>
        <p style={{ margin: 0, color: 'var(--glass-fg-mute)', lineHeight: 1.8 }}>
          Follow history, summary strips, and transaction memory arrive in later chunks. This
          foundation keeps the route live with the new public shell.
        </p>
      </div>
    </section>
  );
}
