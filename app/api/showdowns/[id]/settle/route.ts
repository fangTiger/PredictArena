import { NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_COOKIE_NAME,
  isAdminSessionAuthorized,
  readAdminAccessToken
} from '@/lib/config/admin-auth';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import { mapResolutionToAgentAWins } from '@/lib/services/showdownSettlement';
import { buildDefaultSettlementDeps } from '@/lib/services/showdownSettlementDefaults';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

function hasDeadlinePassed(deadline: string, nowMs: number): boolean {
  const deadlineMs = Date.parse(deadline);
  return Number.isFinite(deadlineMs) && deadlineMs <= nowMs;
}

function safeReasonCode(input: unknown, fallback: string): string {
  if (typeof input !== 'string') {
    return fallback;
  }

  return /^[a-z0-9_:-]+$/i.test(input) ? input : fallback;
}

function readCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${name}=`)) {
      continue;
    }

    const rawValue = trimmed.slice(name.length + 1);
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return null;
}

function authorizeAdminRequest(request: Request): NextResponse | null {
  const expectedToken = readAdminAccessToken(process.env);
  if (!expectedToken) {
    return NextResponse.json(
      { reason: 'admin_access_not_configured' },
      { status: 503 }
    );
  }

  const authorization = request.headers.get('authorization');
  const bearerToken =
    authorization?.startsWith('Bearer ') === true
      ? authorization.slice('Bearer '.length).trim()
      : null;
  const cookieToken = readCookieValue(
    request.headers.get('cookie'),
    ADMIN_ACCESS_COOKIE_NAME
  );
  const candidateToken = bearerToken || cookieToken;

  if (!candidateToken) {
    return NextResponse.json(
      { reason: 'missing_admin_authorization' },
      { status: 401 }
    );
  }

  if (!isAdminSessionAuthorized(candidateToken, process.env)) {
    return NextResponse.json(
      { reason: 'invalid_admin_authorization' },
      { status: 403 }
    );
  }

  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const unauthorizedResponse = authorizeAdminRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  const { id } = await context.params;
  const onchainId = Number.parseInt(id, 10);
  if (!Number.isSafeInteger(onchainId) || onchainId <= 0) {
    return NextResponse.json(
      { reason: 'invalid_showdown_id' },
      { status: 400 }
    );
  }

  const showdownStore = getShowdownStore();
  const record = await showdownStore.findByOnchainId(onchainId);
  if (!record) {
    return NextResponse.json(
      { reason: 'showdown_not_found' },
      { status: 404 }
    );
  }

  if (record.status !== 'Open') {
    return NextResponse.json(
      { reason: 'showdown_not_open' },
      { status: 409 }
    );
  }

  if (!hasDeadlinePassed(record.deadline, Date.now())) {
    return NextResponse.json(
      { reason: 'showdown_deadline_pending' },
      { status: 409 }
    );
  }

  try {
    const deps = await buildDefaultSettlementDeps();
    const resolution = await deps.resolveMarket(record);
    if (!resolution) {
      return NextResponse.json({
        settled: false,
        reason: 'resolution-pending'
      });
    }

    const agentAWins = mapResolutionToAgentAWins(record, resolution.outcomeYes);
    const txHash = await deps.settleOnChain(onchainId, agentAWins);
    await showdownStore.updateOnSettle(onchainId, {
      status: agentAWins ? 'SettledA' : 'SettledB',
      settledAt: new Date(deps.nowMs()).toISOString(),
      settleTxHash: txHash,
      resolvedOutcome: resolution.outcomeYes ? 'YES' : 'NO',
      resolvedPriceLabel: resolution.priceLabel
    });

    return NextResponse.json({
      settled: true,
      winner: agentAWins ? 'A' : 'B',
      txHash
    });
  } catch (error) {
    return NextResponse.json(
      {
        reason: safeReasonCode(
          error instanceof Error ? error.message : null,
          'showdown_settlement_failed'
        )
      },
      { status: 500 }
    );
  }
}
