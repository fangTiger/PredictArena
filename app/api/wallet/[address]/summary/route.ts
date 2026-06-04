import { NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { getRuntimeStore } from '@/lib/persistence/store';
import type { WalletFollowRecord } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ address: string }>;
}

function normalizeWalletAddress(address: string): `0x${string}` | null {
  try {
    return getAddress(address);
  } catch {
    return null;
  }
}

function dedupeLatestFollowPerSignal(follows: WalletFollowRecord[]): WalletFollowRecord[] {
  const bySignal = new Map<string, WalletFollowRecord>();
  for (const follow of follows) {
    const existing = bySignal.get(follow.signalId);
    if (!existing || follow.followedAt.localeCompare(existing.followedAt) > 0) {
      bySignal.set(follow.signalId, follow);
    }
  }

  return [...bySignal.values()].sort((left, right) => right.followedAt.localeCompare(left.followedAt));
}

export async function GET(_request: Request, context: RouteContext) {
  const { address } = await context.params;
  const normalizedAddress = normalizeWalletAddress(address);
  if (!normalizedAddress) {
    return NextResponse.json({ reason: 'invalid_wallet_address' }, { status: 400 });
  }

  const store = getRuntimeStore();
  const follows = await store.listWalletFollows();
  const requestedWalletFollows = dedupeLatestFollowPerSignal(
    follows.filter((follow) => follow.walletAddress.toLowerCase() === normalizedAddress.toLowerCase())
  );
  const walletFollows = await Promise.all(
    requestedWalletFollows.map(async (follow) => {
      const signal = await store.getSignal(follow.signalId);
      return {
        id: follow.id,
        signalId: follow.signalId,
        marketQuestion: signal?.marketQuestion ?? follow.signalId ?? 'Untitled follow',
        status: 'confirmed' as const,
        walletAddress: follow.walletAddress,
        txHash: follow.txHash,
        followedAt: follow.followedAt,
        stakeMicroUsdc: follow.stakeMicroUsdc,
        agentName: follow.agentName
      };
    })
  );

  return NextResponse.json({
    walletAddress: normalizedAddress,
    follows: walletFollows,
    walletFollows
  });
}
