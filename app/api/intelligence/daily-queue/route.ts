import { NextResponse } from 'next/server';
import { workspaceQuerySchema } from '@/lib/intelligence/savedState';
import {
  invalidRequestResponse,
  savedIntelligenceUnavailableResponse,
  searchParamsObject
} from '@/app/api/intelligence/shared';
import {
  buildWorkspaceQueue,
  getSavedIntelligenceStore,
  readWorkspaceState
} from '@/app/api/intelligence/savedStateHelpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsedQuery = workspaceQuerySchema.safeParse(searchParamsObject(request));
  if (!parsedQuery.success) {
    return invalidRequestResponse(parsedQuery.error.issues);
  }

  try {
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedQuery.data.workspaceId);
    const arenaState = await store.getArenaState();
    const items = buildWorkspaceQueue(
      parsedQuery.data.workspaceId,
      arenaState,
      workspaceState,
      new Date().toISOString()
    );

    return NextResponse.json({
      workspaceId: parsedQuery.data.workspaceId,
      freshness: workspaceState.freshness,
      lastEvaluatedAt: workspaceState.lastEvaluatedAt,
      items
    });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
