import React from 'react';
import { TopNav } from '@/components/TopNav';

export default function ArenaLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="glass-page">
      <TopNav variant="glass" />
      <main
        style={{
          width: 'min(1400px, calc(100vw - 32px))',
          margin: '0 auto',
          padding: '1.5rem 0 2.5rem'
        }}
      >
        {children}
      </main>
    </div>
  );
}
