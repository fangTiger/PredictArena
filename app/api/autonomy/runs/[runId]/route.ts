import { NextResponse } from 'next/server';
import { buildAutonomousRunReceipt } from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { runId } = await context.params;
  const store = getRuntimeStore();
  const state = await store.getArenaState();
  const receipt = buildAutonomousRunReceipt(state, decodeURIComponent(runId));

  if (!receipt) {
    return NextResponse.json({ reason: 'run_not_found' }, { status: 404 });
  }

  return NextResponse.json({ receipt });
}
