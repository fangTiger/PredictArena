import React from 'react';

export default function AdminReceiptsPage() {
  return (
    <section
      style={{
        display: 'grid',
        gap: '1rem',
        padding: '1.5rem',
        border: '1px solid var(--admin-rule)',
        borderRadius: '18px',
        background: '#141414'
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: '0.78rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: 'var(--admin-accent)'
        }}
      >
        Receipts
      </p>
      <h1 style={{ margin: 0, fontSize: '2rem' }}>Autonomous run history placeholder.</h1>
      <p style={{ margin: 0, lineHeight: 1.8, color: '#9c9c9c' }}>
        Receipt lists will attach here after the operator read models are ported into the admin
        tree.
      </p>
    </section>
  );
}
