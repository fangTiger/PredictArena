import { NextResponse } from 'next/server';
import { z } from 'zod';
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

  return NextResponse.json({ reason: 'public_commit_disabled' }, { status: 403 });
}
