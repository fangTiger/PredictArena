import { NextResponse } from 'next/server';
import { z } from 'zod';
import { commitSignalToArena } from '@/lib/arc/commitSignal';
import { getRuntimeStore } from '@/lib/persistence/store';

const commitSignalBodySchema = z.object({
  signalId: z.string().min(1)
});

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

export async function POST(request: Request) {
  const parsedBody = commitSignalBodySchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }
  const body = parsedBody.data;
  const store = getRuntimeStore();
  const signal = await store.getSignal(body.signalId);

  if (!signal) {
    return NextResponse.json({ reason: 'signal_not_found' }, { status: 404 });
  }

  if (signal.side === 'AVOID' || signal.edgeBps < 700 || signal.confidence === 'LOW') {
    return NextResponse.json({ reason: 'signal_not_eligible' }, { status: 409 });
  }

  try {
    const result = await commitSignalToArena(store, signal);
    const committedSignal = await store.markSignalCommitted(signal.id, result.txHash);

    return NextResponse.json({
      signal: committedSignal,
      txHash: result.txHash
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'commit_failed';
    return NextResponse.json({ reason }, { status: 409 });
  }
}
