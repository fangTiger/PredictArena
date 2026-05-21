import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  deriveAutonomousIdempotencyKey,
  deriveUtcScheduleWindowId,
  runAutonomousAgents
} from '@/lib/autonomy/runAutonomousAgents';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';

const bodySchema = z.object({
  idempotencyKey: z.string().min(1).max(200).optional(),
  limit: z.number().int().positive().max(20).optional()
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

function authorizeCronRequest(request: Request) {
  const env = getServerEnv();
  if (!env.cron.secret) {
    return {
      env,
      response: NextResponse.json({ reason: 'cron_secret_not_configured' }, { status: 503 })
    };
  }

  const authorization = request.headers.get('authorization');
  if (!authorization) {
    return {
      env,
      response: NextResponse.json({ reason: 'missing_cron_authorization' }, { status: 401 })
    };
  }

  if (authorization !== `Bearer ${env.cron.secret}`) {
    return {
      env,
      response: NextResponse.json({ reason: 'invalid_cron_authorization' }, { status: 403 })
    };
  }

  return { env, response: null };
}

function safeReasonCode(input: unknown, fallback: string): string {
  if (typeof input !== 'string') {
    return fallback;
  }

  return /^[a-z0-9_:-]+$/i.test(input) ? input : fallback;
}

async function runCron(request: Request, body: { idempotencyKey?: string; limit?: number }) {
  const { env, response } = authorizeCronRequest(request);
  if (response) {
    return response;
  }

  try {
    const store = getRuntimeStore();
    const now = new Date().toISOString();
    const scheduleWindowId = deriveUtcScheduleWindowId(now);
    const idempotencyKey = body.idempotencyKey ?? deriveAutonomousIdempotencyKey(scheduleWindowId);
    const result = await runAutonomousAgents(store, {
      env,
      now,
      limit: body.limit,
      idempotencyKey,
      scheduleWindowId
    });
    const metrics = await store.getMetrics();

    if (result.status === 'locked') {
      return NextResponse.json(
        {
          status: 'locked',
          reason: 'autonomous_run_locked',
          lock: {
            scope: result.lock?.scope ?? 'autonomy',
            runId: result.lock?.runId ?? null,
            expiresAt: result.lock?.expiresAt ?? null
          },
          metrics
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      status: result.status,
      duplicateBy: result.duplicateBy ?? null,
      source: result.source,
      fallbackReason: result.fallbackReason,
      run: result.run,
      metrics
    });
  } catch (error) {
    return NextResponse.json(
      {
        reason: safeReasonCode(
          error instanceof Error ? error.message : null,
          'autonomous_run_failed'
        )
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  return runCron(request, {});
}

export async function POST(request: Request) {
  const body = request.headers.get('content-type')?.includes('application/json')
    ? await request.json()
    : {};
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  return runCron(request, parsedBody.data);
}
