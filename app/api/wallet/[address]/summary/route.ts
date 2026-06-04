import { NextResponse } from 'next/server';
import {
  walletBindingsFacade,
  type WalletFollow,
  type WalletSummary,
  type WalletTxHistoryItem
} from '@/lib/persistence/walletBindings';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ address: string }>;
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

function serializeFollow(follow: WalletFollow) {
  return {
    ...follow,
    bondedMicroUsdc: follow.bondedMicroUsdc.toString(),
    payoutMicroUsdc: follow.payoutMicroUsdc?.toString() ?? null
  };
}

function serializeWalletFollowAlias(follow: WalletFollow) {
  return {
    ...serializeFollow(follow),
    txHash: follow.followTxHash,
    stakeMicroUsdc: Number(follow.bondedMicroUsdc)
  };
}

function serializeTxHistoryItem(item: WalletTxHistoryItem) {
  return {
    ...item,
    amountMicroUsdc: item.amountMicroUsdc.toString()
  };
}

function serializeSummary(summary: WalletSummary) {
  const follows = summary.follows.map(serializeFollow);

  return {
    walletAddress: summary.walletAddress,
    usdcBalanceMicro: summary.usdcBalanceMicro.toString(),
    usdcAllowanceMicro: summary.usdcAllowanceMicro.toString(),
    arcChainSynced: summary.arcChainSynced,
    follows,
    walletFollows: summary.follows.map(serializeWalletFollowAlias),
    txHistory: summary.txHistory.map(serializeTxHistoryItem),
    cumulativeBondedMicro: summary.cumulativeBondedMicro.toString(),
    cumulativePayoutMicro: summary.cumulativePayoutMicro.toString(),
    currentNetPnlMicro: summary.currentNetPnlMicro.toString()
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const { address } = await context.params;
  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const summary = await walletBindingsFacade.getSummary(address);

  return NextResponse.json(serializeSummary(summary));
}
