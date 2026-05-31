import { NextResponse } from 'next/server';
import {
  WATCHLIST_LIMIT,
  buildWatchedMarketSnapshot,
  createSavedIntelligenceId,
  findMarketIntelligenceItem,
  type WatchedMarketEntry,
  watchlistCreateBodySchema,
  workspaceQuerySchema
} from '@/lib/intelligence/savedState';
import {
  invalidRequestResponse,
  notFoundResponse,
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
      watchlist: workspaceState.watchlist
    });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}

export async function POST(request: Request) {
  const parsedBody = watchlistCreateBodySchema.safeParse(await parseJsonRequest(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  try {
    const store = getSavedIntelligenceStore();
    const workspaceState = await readWorkspaceState(store, parsedBody.data.workspaceId);
    const existing = workspaceState.watchlist.find((watch) => watch.marketId === parsedBody.data.marketId);
    if (existing) {
      return NextResponse.json(
        {
          duplicate: true,
          watch: existing
        },
        { status: 200 }
      );
    }

    if (workspaceState.watchlist.length >= WATCHLIST_LIMIT) {
      return NextResponse.json(
        {
          reason: 'saved_intelligence_limit_reached',
          limit: WATCHLIST_LIMIT
        },
        { status: 409 }
      );
    }

    const arenaState = await store.getArenaState();
    const now = new Date().toISOString();
    const market = findMarketIntelligenceItem(arenaState, parsedBody.data.marketId, now);
    if (!market) {
      return notFoundResponse();
    }

    const watch: WatchedMarketEntry = {
      id: createSavedIntelligenceId('watch'),
      workspaceId: parsedBody.data.workspaceId,
      marketId: market.marketId,
      asset: market.asset,
      question: market.question,
      conditionType: market.conditionType,
      source: market.source,
      marketUrl: market.marketUrl,
      expiresAt: market.expiresAt,
      label: parsedBody.data.label ?? null,
      note: parsedBody.data.note ?? null,
      supportStatus: market.freshnessStatus === 'fresh' ? 'supported' : 'degraded',
      degradedReason: market.freshnessStatus === 'fresh' ? null : 'data_degraded',
      latestSnapshot: buildWatchedMarketSnapshot(market, now),
      createdAt: now,
      updatedAt: now
    };

    workspaceState.watchlist = [...workspaceState.watchlist, watch].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
    await writeWorkspaceState(store, parsedBody.data.workspaceId, workspaceState);

    return NextResponse.json({ watch }, { status: 201 });
  } catch {
    return savedIntelligenceUnavailableResponse();
  }
}
