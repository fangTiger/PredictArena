import { NextResponse } from 'next/server';
import { alertPatchBodySchema } from '@/lib/intelligence/savedState';
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
  context: { params: Promise<{ alertId: string }> }
) {
  const parsedBody = alertPatchBodySchema.safeParse(await parseJsonRequest(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  try {
    const { alertId } = await context.params;
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedBody.data.workspaceId);
    const existing = workspaceState.alerts.find((alert) => alert.id === alertId);
    if (!existing) {
      return notFoundResponse();
    }

    const now = new Date().toISOString();
    const alert = {
      ...existing,
      readAt:
        parsedBody.data.state === 'read'
          ? now
          : parsedBody.data.state === 'unread'
            ? null
            : existing.readAt,
      dismissedAt: parsedBody.data.state === 'dismissed' ? now : null,
      updatedAt: now
    };

    workspaceState.alerts = workspaceState.alerts.map((item) =>
      item.id === alertId ? alert : item
    );
    await writeWorkspaceState(store, parsedBody.data.workspaceId, workspaceState);

    return NextResponse.json({ alert });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
