import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';

const resolveBodySchema = z.object({
  signalId: z.string().min(1),
  outcomeCorrect: z.boolean()
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

  const parsedBody = resolveBodySchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }
  const body = parsedBody.data;
  const store = getRuntimeStore();
  const signal = await store.resolveSignal(body.signalId, body.outcomeCorrect);

  return NextResponse.json({
    signal
  });
}
