import { NextResponse } from 'next/server';
import { workspaceQuerySchema } from '@/lib/intelligence/savedState';
import {
  invalidRequestResponse,
  savedIntelligenceUnavailableResponse,
  searchParamsObject
} from '@/app/api/intelligence/shared';
import {
  getSavedIntelligenceStore,
  readWorkspaceState,
  workspaceSummaryPayload
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
    return NextResponse.json(
      workspaceSummaryPayload({
        workspaceId: parsedQuery.data.workspaceId,
        arenaState,
        workspaceState,
        now: new Date().toISOString()
      })
    );
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
