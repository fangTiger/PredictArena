import { NextResponse } from 'next/server';
import {
  buildAgentReputationProfile,
  isSupportedAgentName
} from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ agentName: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { agentName } = await context.params;
  if (!isSupportedAgentName(agentName)) {
    return NextResponse.json({ reason: 'unsupported_agent' }, { status: 400 });
  }

  const state = await getRuntimeStore().getArenaState();
  const profile = buildAgentReputationProfile(state, agentName);

  return NextResponse.json({ profile });
}
