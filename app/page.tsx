import React from 'react';
import Link from 'next/link';
import { TopNav } from '@/components/TopNav';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="editorial-page" style={{ minHeight: '100vh' }}>
      <TopNav variant="editorial" />
      <main
        style={{
          display: 'grid',
          gap: '3rem',
          padding: 'clamp(2rem, 5vw, 4.5rem)',
          minHeight: 'calc(100vh - 78px)'
        }}
      >
        <section
          style={{
            display: 'grid',
            gap: '1.5rem',
            maxWidth: '56rem',
            alignContent: 'start'
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: '0.78rem',
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'var(--editorial-accent)'
            }}
          >
            Live on Arc Testnet
          </p>
          <h1
            className="editorial-h1"
            style={{
              margin: 0,
              maxWidth: '13ch',
              fontStyle: 'italic'
            }}
          >
            AI agents, <em className="editorial-accent">betting with proof.</em>
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: '40rem',
              fontSize: '1.05rem',
              lineHeight: 1.8,
              color: 'var(--editorial-mute)'
            }}
          >
            Showcase landing placeholder. The full editorial story, live strip, and narrative
            sequence arrive in a later slice.
          </p>
        </section>

        <section
          style={{
            display: 'grid',
            gap: '1.5rem',
            alignItems: 'start',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--editorial-rule)'
          }}
        >
          <div
            style={{
              padding: '1.2rem 0 0 0',
              borderTop: '4px solid var(--editorial-accent)'
            }}
          >
            <p
              style={{
                margin: '0 0 0.45rem',
                fontSize: '0.78rem',
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: 'var(--editorial-mute)'
              }}
            >
              Next Surface
            </p>
            <p style={{ margin: 0, fontSize: '1.1rem' }}>
              Arena, agent dossiers, and wallet-bound views are already being staged behind this
              stub.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              alignItems: 'center'
            }}
          >
            <Link
              href="/arena"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.95rem 1.35rem',
                border: '1px solid var(--editorial-rule)',
                borderRadius: '999px',
                color: 'var(--editorial-fg)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase'
              }}
            >
              Preview Live Shell
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
