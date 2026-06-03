import React from 'react';
import Link from 'next/link';
import { submitAdminLogin } from '@/app/admin-login/actions';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminLoginPage({
  searchParams
}: Readonly<{
  searchParams?: SearchParams;
}>) {
  const params = (searchParams ? await searchParams : {}) as Record<
    string,
    string | string[] | undefined
  >;
  const hasError = params.error === '1';

  return (
    <div
      className="admin-page"
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '1.5rem'
      }}
    >
      <main
        style={{
          width: 'min(460px, 100%)',
          display: 'grid',
          gap: '1.5rem',
          padding: '1.75rem',
          border: '1px solid var(--admin-rule)',
          borderRadius: '20px',
          background: '#141414'
        }}
      >
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '0.78rem',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--admin-accent)'
            }}
          >
            Hidden Operator Access
          </p>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Admin Login</h1>
          <p style={{ margin: 0, lineHeight: 1.8, color: '#9c9c9c' }}>
            Enter the configured access token to unlock the greyscale operator surface.
          </p>
        </div>

        <form action={submitAdminLogin} style={{ display: 'grid', gap: '1rem' }}>
          <label
            htmlFor="admin-access-token"
            style={{
              display: 'grid',
              gap: '0.5rem',
              fontSize: '0.92rem'
            }}
          >
            <span>Access Token</span>
            <input
              id="admin-access-token"
              name="token"
              type="password"
              autoComplete="current-password"
              placeholder="ADMIN_ACCESS_TOKEN"
              style={{
                minHeight: '48px',
                padding: '0.85rem 1rem',
                borderRadius: '14px',
                border: '1px solid var(--admin-rule)',
                background: '#0f0f0f',
                color: 'var(--admin-fg)'
              }}
            />
          </label>

          {hasError ? (
            <p role="alert" style={{ margin: 0, color: '#f29b9b' }}>
              Invalid token
            </p>
          ) : null}

          <button
            type="submit"
            style={{
              minHeight: '48px',
              borderRadius: '14px',
              border: '1px solid #3a3a3a',
              background: '#f0f0f0',
              color: '#121212',
              fontWeight: 700
            }}
          >
            Enter Admin
          </button>
        </form>

        <Link href="/" style={{ color: '#9c9c9c', fontSize: '0.92rem' }}>
          Back to showcase
        </Link>
      </main>
    </div>
  );
}
