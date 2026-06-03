import React from 'react';
import { TopNav } from '@/components/TopNav';

export default function MyLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="glass-page">
      <TopNav variant="glass" />
      <main
        style={{
          width: 'min(1180px, calc(100vw - 32px))',
          margin: '0 auto',
          padding: '2rem 0 3rem'
        }}
      >
        {children}
      </main>
    </div>
  );
}
