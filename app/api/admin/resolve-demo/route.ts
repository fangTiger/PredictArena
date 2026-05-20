import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';

const resolveBodySchema = z.object({
  signalId: z.string().min(1),
  outcomeCorrect: z.boolean(),
  yesOutcome: z.boolean().optional()
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

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function deriveYesOutcome(side: 'YES' | 'NO' | 'AVOID', outcomeCorrect: boolean): boolean {
  if (side === 'YES') {
    return outcomeCorrect;
  }

  if (side === 'NO') {
    return !outcomeCorrect;
  }

  return false;
}

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env.admin.resolveToken) {
    return NextResponse.json({ reason: 'resolve_not_configured' }, { status: 503 });
  }

  const token = request.headers.get('x-admin-resolve-token');
  if (!token) {
    return NextResponse.json({ reason: 'missing_admin_token' }, { status: 401 });
  }

  if (token !== env.admin.resolveToken) {
    return NextResponse.json({ reason: 'invalid_admin_token' }, { status: 403 });
  }

  const parsedBody = resolveBodySchema.safeParse(await parseJson(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  const store = getRuntimeStore();
  const signal = await store.getSignal(parsedBody.data.signalId);
  if (!signal) {
    return NextResponse.json({ reason: 'signal_not_found' }, { status: 404 });
  }

  const yesOutcome =
    parsedBody.data.yesOutcome ?? deriveYesOutcome(signal.side, parsedBody.data.outcomeCorrect);
  const resolvedAt = new Date().toISOString();
  let resolvedSignal;
  try {
    resolvedSignal = await store.resolveSignal(
      parsedBody.data.signalId,
      parsedBody.data.outcomeCorrect,
      resolvedAt,
      {
        yesOutcome,
        source: 'demo_admin',
        observedAt: resolvedAt
      }
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'resolve_failed';
    return NextResponse.json({ reason }, { status: 409 });
  }

  return NextResponse.json({
    signal: resolvedSignal,
    source: 'demo_admin'
  });
}
