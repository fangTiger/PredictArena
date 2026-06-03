import React from 'react';
import Link from 'next/link';

const ADMIN_LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/control-room', label: 'Control Room' },
  { href: '/admin/receipts', label: 'Receipts' },
  { href: '/admin/resolution', label: 'Resolution' },
  { href: '/admin/proof', label: 'Proof' },
  { href: '/admin/health', label: 'Health' }
];

export function AdminShell({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '1rem',
        gridTemplateColumns: 'minmax(220px, 260px) minmax(0, 1fr)',
        minHeight: 'calc(100vh - 2.5rem)'
      }}
    >
      <aside
        style={{
          display: 'grid',
          gap: '1rem',
          alignContent: 'start',
          padding: '1.5rem',
          border: '1px solid var(--admin-rule)',
          borderRadius: '18px',
          background: '#111111'
        }}
      >
        <div style={{ display: 'grid', gap: '0.45rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.75rem',
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: 'var(--admin-accent)'
            }}
          >
            PredictArena
          </p>
          <strong style={{ fontSize: '1.3rem' }}>Admin Shell</strong>
          <p style={{ margin: 0, lineHeight: 1.7, color: '#9c9c9c' }}>
            Hidden operator rail for control-room facts, receipt review, resolution commands, and proof diagnostics.
          </p>
        </div>

        <nav aria-label="Admin sidebar" style={{ display: 'grid', gap: '0.65rem' }}>
          {ADMIN_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: '44px',
                padding: '0.8rem 1rem',
                border: '1px solid var(--admin-rule)',
                borderRadius: '14px',
                color: 'var(--admin-fg)',
                background: '#181818'
              }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div
        style={{
          minWidth: 0,
          display: 'grid',
          alignContent: 'start'
        }}
      >
        {children}
      </div>
    </div>
  );
}
