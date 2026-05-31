import { NextResponse } from 'next/server';
import {
  evaluateSavedIntelligenceWorkspace,
  markSavedIntelligenceEvaluationFailure,
  workspaceMutationBodySchema
} from '@/lib/intelligence/savedState';
import {
  invalidRequestResponse,
  parseJsonRequest,
  savedIntelligenceUnavailableResponse
} from '@/app/api/intelligence/shared';
import {
  getSavedIntelligenceStore,
  readWorkspaceState,
  writeWorkspaceState
} from '@/app/api/intelligence/savedStateHelpers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const parsedBody = workspaceMutationBodySchema.safeParse(await parseJsonRequest(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  const workspaceId = parsedBody.data.workspaceId;

  try {
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, workspaceId);
    const now = new Date().toISOString();

    try {
      const arenaState = await store.getArenaState();
      const evaluation = evaluateSavedIntelligenceWorkspace({
        workspaceId,
        arenaState,
        workspaceState,
        now
      });

      await writeWorkspaceState(store, workspaceId, evaluation.workspaceState);
      return NextResponse.json(evaluation.result);
    } catch {
      const failure = markSavedIntelligenceEvaluationFailure(workspaceId, workspaceState, now);
      await writeWorkspaceState(store, workspaceId, failure.workspaceState);
      return NextResponse.json(failure.result);
    }
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
