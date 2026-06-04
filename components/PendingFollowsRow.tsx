'use client';

import React from 'react';
import Link from 'next/link';
import useSWR from 'swr';

interface PendingFollowsRowProps {
  walletAddress: string | null;
}

interface FollowChip {
  signalId: string;
  marketQuestion: string;
  status: 'pending' | 'confirmed';
}

type WalletSummaryPayload = {
  follows?: Array<{
    signalId?: string;
    marketQuestion?: string;
    status?: string;
  }>;
  walletFollows?: Array<{
    signalId?: string;
    marketQuestion?: string;
    status?: string;
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
      signalId: entry.signalId ?? '',
      marketQuestion: entry.marketQuestion ?? 'Untitled follow',
      status: entry.status as 'pending' | 'confirmed'
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
      <span className="pending-follows-label">Pending follows</span>
      <div className="pending-follows-list">
        {follows.map((follow) => (
          <Link key={`${follow.status}:${follow.signalId}`} href="/my" className="pending-follow-chip">
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
