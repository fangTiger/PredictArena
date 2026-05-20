import { NextResponse } from 'next/server';
import { getRuntimeStore } from '@/lib/server/store/runtime-store';
import { commitSignalAndLoadDashboardState } from '@/lib/services/commit-service';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const state = await commitSignalAndLoadDashboardState(getRuntimeStore(), id);
  return NextResponse.json(state);
}
