import { NextResponse } from 'next/server';
import { getAddress } from 'viem';
import { getRuntimeStore } from '@/lib/persistence/store';

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

export async function GET(_request: Request, context: RouteContext) {
  const { address } = await context.params;
  const normalizedAddress = normalizeWalletAddress(address);
  if (!normalizedAddress) {
    return NextResponse.json({ reason: 'invalid_wallet_address' }, { status: 400 });
  }

  const store = getRuntimeStore();
  const follows = await store.listWalletFollows();
  const walletFollows = await Promise.all(
    follows
      .filter((follow) => follow.walletAddress.toLowerCase() === normalizedAddress.toLowerCase())
      .map(async (follow) => {
        const signal = await store.getSignal(follow.signalId);
        return {
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
