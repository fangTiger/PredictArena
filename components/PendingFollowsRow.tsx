'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';

interface PendingFollowsRowProps {
  walletAddress: string | null;
}

interface FollowChip {
  id?: string;
  signalId: string;
  marketQuestion: string;
  status: 'pending' | 'confirmed';
  walletAddress?: string;
  txHash?: string;
  followedAt?: string;
  createdAt?: string;
}

type WalletSummaryPayload = {
  follows?: Array<{
    id?: string;
    signalId?: string;
    marketQuestion?: string;
    status?: string;
    walletAddress?: string;
    txHash?: string;
    followedAt?: string;
    createdAt?: string;
  }>;
  walletFollows?: Array<{
    id?: string;
    signalId?: string;
    marketQuestion?: string;
    status?: string;
    walletAddress?: string;
    txHash?: string;
    followedAt?: string;
    createdAt?: string;
  }>;
  pendingFollows?: Array<{
    signalId?: string;
    marketQuestion?: string;
  }>;
  confirmedFollows?: Array<{
    signalId?: string;
    marketQuestion?: string;
  }>;
} | null;

async function fetchSummary(url: string): Promise<WalletSummaryPayload> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }

    return (await response.json()) as WalletSummaryPayload;
  } catch {
    return null;
  }
}

function toFollowChips(payload: WalletSummaryPayload | undefined): FollowChip[] {
  if (!payload) {
    return [];
  }

  const direct = (payload.follows ?? payload.walletFollows ?? [])
    .filter((entry) => entry.status === 'pending' || entry.status === 'confirmed')
    .map((entry) => ({
      id: entry.id,
      signalId: entry.signalId ?? '',
      marketQuestion: entry.marketQuestion ?? 'Untitled follow',
      status: entry.status as 'pending' | 'confirmed',
      walletAddress: entry.walletAddress,
      txHash: entry.txHash,
      followedAt: entry.followedAt,
      createdAt: entry.createdAt
    }));

  if (direct.length > 0) {
    return direct;
  }

  return [
    ...(payload.pendingFollows ?? []).map((entry) => ({
      signalId: entry.signalId ?? '',
      marketQuestion: entry.marketQuestion ?? 'Untitled follow',
      status: 'pending' as const
    })),
    ...(payload.confirmedFollows ?? []).map((entry) => ({
      signalId: entry.signalId ?? '',
      marketQuestion: entry.marketQuestion ?? 'Untitled follow',
      status: 'confirmed' as const
    }))
  ];
}

function truncateLabel(value: string) {
  return value.length > 44 ? `${value.slice(0, 43)}...` : value;
}

export function buildFollowChipKey(follow: FollowChip, index: number) {
  const stableIdentity =
    follow.id ??
    follow.txHash ??
    follow.followedAt ??
    follow.createdAt ??
    `position-${index}`;

  return [
    follow.status,
    follow.signalId || 'unknown-signal',
    follow.walletAddress || 'unknown-wallet',
    stableIdentity
  ].join(':');
}

export function PendingFollowsRow({ walletAddress }: PendingFollowsRowProps) {
  const swrKey = walletAddress ? `/api/wallet/${walletAddress}/summary` : null;
  const { data } = useSWR(swrKey, fetchSummary, {
    refreshInterval: 60000,
    revalidateOnFocus: false
  });

  const follows = toFollowChips(data).slice(0, 3);
  if (!walletAddress || follows.length === 0) {
    return null;
  }

  return (
    <section className="pending-follows-row glass-card" data-testid="pending-follows-row">
      <span className="pending-follows-label">Wallet follows</span>
      <div className="pending-follows-list">
        {follows.map((follow, index) => (
          <Link key={buildFollowChipKey(follow, index)} href="/my" className="pending-follow-chip">
            <span className="pending-follow-copy">{truncateLabel(follow.marketQuestion)}</span>
            <span className={`pending-follow-state pending-follow-state-${follow.status}`}>
              {follow.status}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
