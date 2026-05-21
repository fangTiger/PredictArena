import { NextResponse } from 'next/server';
import { buildResolutionDemoScript } from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await getRuntimeStore().getArenaState();
  const script = buildResolutionDemoScript(state);

  return NextResponse.json({ script });
}
