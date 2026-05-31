import { NextResponse } from 'next/server';
import { savedFilterPatchBodySchema, workspaceMutationBodySchema } from '@/lib/intelligence/savedState';
import {
  invalidRequestResponse,
  notFoundResponse,
  parseJsonRequest,
  savedIntelligenceUnavailableResponse
} from '@/app/api/intelligence/shared';
import {
  getSavedIntelligenceStore,
  readWorkspaceState,
  writeWorkspaceState
} from '@/app/api/intelligence/savedStateHelpers';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ filterId: string }> }
) {
  const parsedBody = savedFilterPatchBodySchema.safeParse(await parseJsonRequest(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  try {
    const { filterId } = await context.params;
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedBody.data.workspaceId);
    const existing = workspaceState.savedFilters.find((filter) => filter.id === filterId);
    if (!existing) {
      return notFoundResponse();
    }

    const now = new Date().toISOString();
    const savedFilter = {
      ...existing,
      name: parsedBody.data.name ?? existing.name,
      query: parsedBody.data.query
        ? {
            ...existing.query,
            ...parsedBody.data.query
          }
        : existing.query,
      thresholds: parsedBody.data.thresholds
        ? {
            ...existing.thresholds,
            ...parsedBody.data.thresholds
          }
        : existing.thresholds,
      enabled: parsedBody.data.enabled ?? existing.enabled,
      updatedAt: now
    };

    workspaceState.savedFilters = workspaceState.savedFilters.map((filter) =>
      filter.id === filterId ? savedFilter : filter
    );
    await writeWorkspaceState(store, parsedBody.data.workspaceId, workspaceState);

    return NextResponse.json({ savedFilter });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ filterId: string }> }
) {
  const parsedBody = workspaceMutationBodySchema.safeParse(await parseJsonRequest(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  try {
    const { filterId } = await context.params;
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedBody.data.workspaceId);
    const existing = workspaceState.savedFilters.find((filter) => filter.id === filterId);
    if (!existing) {
      return notFoundResponse();
    }

    workspaceState.savedFilters = workspaceState.savedFilters.filter((filter) => filter.id !== filterId);
    workspaceState.alerts = workspaceState.alerts.map((alert) =>
      alert.sourceType === 'saved_filter' && alert.sourceId === filterId
        ? {
            ...alert,
            orphaned: true,
            sourceLabel: alert.sourceLabel ?? existing.name,
            updatedAt: new Date().toISOString()
          }
        : alert
    );

    await writeWorkspaceState(store, parsedBody.data.workspaceId, workspaceState);
    return NextResponse.json({ deleted: true, filterId });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
