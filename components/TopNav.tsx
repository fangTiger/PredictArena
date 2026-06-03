'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnectButton } from '@/components/WalletConnectButton';

export type TopNavVariant = 'editorial' | 'glass';

interface TopNavProps {
  variant: TopNavVariant;
}

const SEGMENTS = [
  { label: 'HOME', href: '/' },
  { label: 'ARENA', href: '/arena' },
  { label: 'AGENTS', href: '/agents' },
  { label: 'MY', href: '/my' }
];

export function TopNav({ variant }: TopNavProps) {
  const currentPath = usePathname() || '/';
  const variantClass = variant === 'editorial' ? 'topnav-editorial' : 'topnav-glass';

  return (
    <nav className={`topnav ${variantClass}`}>
      <span className="topnav-logo">PREDICTARENA</span>
      <div className="topnav-segments">
        {SEGMENTS.map((seg) => {
          const isActive =
            seg.href === '/'
              ? currentPath === '/'
              : currentPath.startsWith(seg.href);
          return (
            <Link
              key={seg.href}
              href={seg.href}
              className="topnav-segment"
              data-active={isActive ? 'true' : 'false'}
            >
              {seg.label}
            </Link>
          );
        })}
      </div>
      <WalletConnectButton className="topnav-wallet" />
    </nav>
  );
}
