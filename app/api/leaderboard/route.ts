import { NextResponse } from 'next/server';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getRuntimeStore();
  return NextResponse.json({
    leaderboard: await store.getLeaderboard(),
    metrics: await store.getMetrics()
  });
}
