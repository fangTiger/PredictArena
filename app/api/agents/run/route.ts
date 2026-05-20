import { NextResponse } from 'next/server';
import { runArenaAndLoadDashboardState } from '@/lib/services/dashboard-service';

export const dynamic = 'force-dynamic';

export async function POST() {
  const state = await runArenaAndLoadDashboardState();
  return NextResponse.json(state);
}
