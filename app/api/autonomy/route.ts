import { NextResponse } from 'next/server';
import { getArcControlRoomState } from '@/lib/arc/controlRoom';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

function sanitizeAutonomyRun(run: Awaited<ReturnType<ReturnType<typeof getRuntimeStore>['getArenaState']>>['autonomyRuns'][number]) {
  const {
    idempotencyKey: _idempotencyKey,
    scheduleWindowId: _scheduleWindowId,
    lockExpiresAt: _lockExpiresAt,
    ...publicRun
  } = run;

  return publicRun;
}

export async function GET() {
  const env = getServerEnv();
  const store = getRuntimeStore();
  const [state, metrics, controlRoom] = await Promise.all([
    store.getArenaState(),
    store.getMetrics(),
    getArcControlRoomState({ env, store })
  ]);

  return NextResponse.json({
    policies: env.autonomy.policies,
    latestScan: state.latestScan ?? null,
    lastRun: state.lastRun ?? null,
    metrics,
    runs: state.autonomyRuns.map(sanitizeAutonomyRun),
    controlRoom
  });
}
