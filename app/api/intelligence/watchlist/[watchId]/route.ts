import { NextResponse } from 'next/server';
import { workspaceMutationBodySchema } from '@/lib/intelligence/savedState';
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

export async function DELETE(
  request: Request,
  context: { params: Promise<{ watchId: string }> }
) {
  const parsedBody = workspaceMutationBodySchema.safeParse(await parseJsonRequest(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  try {
    const { watchId } = await context.params;
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedBody.data.workspaceId);
    const existing = workspaceState.watchlist.find((watch) => watch.id === watchId);
    if (!existing) {
      return notFoundResponse();
    }

    workspaceState.watchlist = workspaceState.watchlist.filter((watch) => watch.id !== watchId);
    workspaceState.alerts = workspaceState.alerts.map((alert) =>
      alert.sourceType === 'watchlist' && alert.sourceId === watchId
        ? {
            ...alert,
            orphaned: true,
            sourceLabel: alert.sourceLabel ?? existing.label ?? existing.question,
            updatedAt: new Date().toISOString()
          }
        : alert
    );

    await writeWorkspaceState(store, parsedBody.data.workspaceId, workspaceState);
    return NextResponse.json({ deleted: true, watchId });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
