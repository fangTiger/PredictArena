import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  getWalletFollowPublicClient,
  recordWalletFollowReceipt
} from '@/lib/arc/walletFollows';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';

const walletFollowBodySchema = z.object({
  signalId: z.string().min(1),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/)
});

const reasonStatus: Record<string, number> = {
  signal_not_found: 404,
  signal_not_eligible: 409,
  wallet_follow_duplicate: 409,
  wallet_follow_sender_mismatch: 409,
  wallet_follow_signal_mismatch: 409,
  wallet_follow_event_missing: 422,
  wallet_follow_receipt_missing: 422
};

export const dynamic = 'force-dynamic';

function invalidRequestResponse(issues: z.ZodIssue[]) {
  return NextResponse.json(
    {
      reason: 'invalid_request',
      issues: issues.map(({ code, message, path }) => ({ code, message, path }))
    },
    { status: 400 }
  );
}

function reasonFromError(error: unknown): string {
  if (!(error instanceof Error)) {
    return 'wallet_follow_failed';
  }

  return error.message.split(':')[0] || 'wallet_follow_failed';
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ reason: 'invalid_request' }, { status: 400 });
  }

  const parsedBody = walletFollowBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  const env = getServerEnv();
  if (!env.arc.signalBondArenaAddress) {
    return NextResponse.json({ reason: 'missing_signal_bond_arena_address' }, { status: 503 });
  }

  try {
    const follow = await recordWalletFollowReceipt({
      store: getRuntimeStore(),
      publicClient: getWalletFollowPublicClient(env.arc.rpcUrl),
      signalId: parsedBody.data.signalId,
      walletAddress: parsedBody.data.walletAddress as `0x${string}`,
      txHash: parsedBody.data.txHash as `0x${string}`,
      chainId: env.arc.chainId,
      arenaAddress: env.arc.signalBondArenaAddress
    });

    return NextResponse.json({ follow });
  } catch (error) {
    const reason = reasonFromError(error);
    return NextResponse.json(
      { reason },
      {
        status:
          reasonStatus[reason] ??
          (reason.startsWith('wallet_follow_signal_mismatch') ? 409 : 500)
      }
    );
  }
}
