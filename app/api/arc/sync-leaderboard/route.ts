import { NextResponse } from 'next/server';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';
import { syncArcLeaderboard } from '@/lib/arc/syncLeaderboard';

export const dynamic = 'force-dynamic';

async function sync() {
  const env = getServerEnv();
  const store = getRuntimeStore();
  return NextResponse.json(await syncArcLeaderboard({ env, store }));
}

export async function GET() {
  return sync();
}

export async function POST() {
  return sync();
}
