import { NextResponse } from 'next/server';
import { getArcControlRoomState } from '@/lib/arc/controlRoom';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const env = getServerEnv();
  const store = getRuntimeStore();
  return NextResponse.json(await getArcControlRoomState({ env, store }));
}
