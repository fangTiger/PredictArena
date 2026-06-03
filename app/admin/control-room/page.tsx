import React from 'react';

export default function AdminControlRoomPage() {
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
        Control Room
      </p>
      <h1 style={{ margin: 0, fontSize: '2rem' }}>Readiness panels incoming.</h1>
      <p style={{ margin: 0, lineHeight: 1.8, color: '#9c9c9c' }}>
        This placeholder reserves the greyscale operator lane for Arc readiness and autonomy facts.
      </p>
    </section>
  );
}
