import { NextResponse } from 'next/server';
import {
  SAVED_FILTER_LIMIT,
  createSavedIntelligenceId,
  defaultSavedFilterThresholds,
  savedFilterCreateBodySchema,
  workspaceQuerySchema
} from '@/lib/intelligence/savedState';
import {
  invalidRequestResponse,
  parseJsonRequest,
  savedIntelligenceUnavailableResponse,
  searchParamsObject
} from '@/app/api/intelligence/shared';
import {
  getSavedIntelligenceStore,
  readWorkspaceState,
  writeWorkspaceState
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
    return NextResponse.json({
      workspaceId: parsedQuery.data.workspaceId,
      freshness: workspaceState.freshness,
      lastEvaluatedAt: workspaceState.lastEvaluatedAt,
      savedFilters: workspaceState.savedFilters
    });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}

export async function POST(request: Request) {
  const parsedBody = savedFilterCreateBodySchema.safeParse(await parseJsonRequest(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  try {
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedBody.data.workspaceId);
    if (workspaceState.savedFilters.length >= SAVED_FILTER_LIMIT) {
      return NextResponse.json(
        {
          reason: 'saved_intelligence_limit_reached',
          limit: SAVED_FILTER_LIMIT
        },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const savedFilter = {
      id: createSavedIntelligenceId('filter'),
      workspaceId: parsedBody.data.workspaceId,
      name: parsedBody.data.name,
      enabled: parsedBody.data.enabled ?? true,
      query: {
        ...parsedBody.data.query,
        minOpportunityScoreBps: parsedBody.data.query.minOpportunityScoreBps ?? 0,
        minDataHealthScoreBps: parsedBody.data.query.minDataHealthScoreBps ?? 0
      },
      thresholds: {
        ...defaultSavedFilterThresholds,
        ...parsedBody.data.thresholds
      },
      latestEvaluation: null,
      createdAt: now,
      updatedAt: now
    };

    workspaceState.savedFilters = [...workspaceState.savedFilters, savedFilter].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    await writeWorkspaceState(store, parsedBody.data.workspaceId, workspaceState);

    return NextResponse.json(
      {
        savedFilter
      },
      { status: 201 }
    );
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
