import { NextResponse } from 'next/server';
import { alertsQuerySchema } from '@/lib/intelligence/savedState';
import {
  invalidRequestResponse,
  savedIntelligenceUnavailableResponse,
  searchParamsObject
} from '@/app/api/intelligence/shared';
import { getSavedIntelligenceStore, readWorkspaceState } from '@/app/api/intelligence/savedStateHelpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsedQuery = alertsQuerySchema.safeParse(searchParamsObject(request));
  if (!parsedQuery.success) {
    return invalidRequestResponse(parsedQuery.error.issues);
  }

  try {
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedQuery.data.workspaceId);

    const unreadFilter =
      parsedQuery.data.unread === undefined ? null : parsedQuery.data.unread === 'true';
    const alerts = workspaceState.alerts.filter((alert) => {
      if (parsedQuery.data.reason && alert.reasonCode !== parsedQuery.data.reason) {
        return false;
      }
      if (parsedQuery.data.severity && alert.severity !== parsedQuery.data.severity) {
        return false;
      }
      if (unreadFilter !== null && Boolean(!alert.readAt && !alert.dismissedAt) !== unreadFilter) {
        return false;
      }
      return true;
    });

    return NextResponse.json({
      workspaceId: parsedQuery.data.workspaceId,
      alerts
    });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
