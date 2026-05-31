import {
  DAILY_QUEUE_PREVIEW_LIMIT,
  buildDailyResearchQueue,
  normalizeSavedIntelligenceWorkspaceState,
  type DailyQueueItem,
  type SavedIntelligenceWorkspaceState
} from '@/lib/intelligence/savedState';
import type { ArenaState, PersistenceStore } from '@/lib/persistence/store';
import { getRuntimeStore } from '@/lib/persistence/store';

export function getSavedIntelligenceStore(): PersistenceStore {
  return getRuntimeStore();
}

export async function readWorkspaceState(
  store: PersistenceStore,
  workspaceId: string
): Promise<SavedIntelligenceWorkspaceState> {
  return normalizeSavedIntelligenceWorkspaceState(
    workspaceId,
    await store.getSavedIntelligenceWorkspace(workspaceId)
  );
}

export async function writeWorkspaceState(
  store: PersistenceStore,
  workspaceId: string,
  workspaceState: SavedIntelligenceWorkspaceState
): Promise<SavedIntelligenceWorkspaceState> {
  return store.putSavedIntelligenceWorkspace(
    workspaceId,
    normalizeSavedIntelligenceWorkspaceState(workspaceId, workspaceState)
  );
}

export function unreadAlertCount(workspaceState: SavedIntelligenceWorkspaceState): number {
  return workspaceState.alerts.filter((alert) => !alert.readAt && !alert.dismissedAt).length;
}

export function buildWorkspaceQueue(
  workspaceId: string,
  arenaState: ArenaState,
  workspaceState: SavedIntelligenceWorkspaceState,
  now: string
): DailyQueueItem[] {
  return buildDailyResearchQueue({
    workspaceId,
    arenaState,
    workspaceState,
    now
  });
}

export function workspaceSummaryPayload(input: {
  workspaceId: string;
  arenaState: ArenaState;
  workspaceState: SavedIntelligenceWorkspaceState;
  now: string;
}) {
  const queue = buildWorkspaceQueue(
    input.workspaceId,
    input.arenaState,
    input.workspaceState,
    input.now
  );

  return {
    workspaceId: input.workspaceId,
    freshness: input.workspaceState.freshness,
    lastEvaluatedAt: input.workspaceState.lastEvaluatedAt,
    lastSuccessfulEvaluatedAt: input.workspaceState.lastSuccessfulEvaluatedAt,
    failureReason: input.workspaceState.failureReason,
    unreadAlertCount: unreadAlertCount(input.workspaceState),
    savedFilters: input.workspaceState.savedFilters,
    watchlist: input.workspaceState.watchlist,
    dailyQueuePreview: queue.slice(0, DAILY_QUEUE_PREVIEW_LIMIT)
  };
}
