import React from 'react';

export default function AdminPage() {
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
        Admin Overview
      </p>
      <h1 style={{ margin: 0, fontSize: '2.2rem' }}>Operator surface staged.</h1>
      <p style={{ margin: 0, lineHeight: 1.8, color: '#9c9c9c' }}>
        Control-room details, receipts, and health panels will replace this placeholder in later
        chunks.
      </p>
    </section>
  );
}
