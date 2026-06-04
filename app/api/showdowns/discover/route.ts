import { NextResponse } from 'next/server';
import {
  ADMIN_ACCESS_COOKIE_NAME,
  isAdminSessionAuthorized,
  readAdminAccessToken
} from '@/lib/config/admin-auth';
import { discoverShowdowns } from '@/lib/services/showdownDiscovery';
import { buildDefaultDiscoveryDeps } from '@/lib/services/showdownDiscoveryDefaults';

export const dynamic = 'force-dynamic';

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

export async function POST(request: Request) {
  const unauthorizedResponse = authorizeAdminRequest(request);
  if (unauthorizedResponse) {
    return unauthorizedResponse;
  }

  try {
    const result = await discoverShowdowns(await buildDefaultDiscoveryDeps());
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        reason: safeReasonCode(
          error instanceof Error ? error.message : null,
          'showdown_discovery_failed'
        )
      },
      { status: 500 }
    );
  }
}
