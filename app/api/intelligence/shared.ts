import { NextResponse } from 'next/server';
import { z } from 'zod';

export const ASSET_VALUES = ['BTC', 'ETH', 'SOL', 'all'] as const;
export const CONDITION_TYPE_VALUES = [
  'EXPIRY_ABOVE',
  'EXPIRY_BELOW',
  'TOUCH_ABOVE',
  'TOUCH_BELOW',
  'all'
] as const;
export const CONFIDENCE_VALUES = ['LOW', 'MEDIUM', 'HIGH', 'all'] as const;

export function invalidRequestResponse(issues: z.ZodIssue[]) {
  return NextResponse.json(
    {
      reason: 'invalid_request',
      issues: issues.map(({ code, message, path }) => ({ code, message, path }))
    },
    { status: 400 }
  );
}

export function notFoundResponse() {
  return NextResponse.json({ reason: 'not_found' }, { status: 404 });
}

export function savedIntelligenceUnavailableResponse() {
  return NextResponse.json({ reason: 'saved_intelligence_unavailable' }, { status: 503 });
}

export async function parseJsonRequest(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export function searchParamsObject(request: Request): Record<string, string> {
  return Object.fromEntries(new URL(request.url).searchParams.entries());
}

export function optionalIsoDatetime() {
  return z.preprocess(
    (value) => (value === '' || value === undefined ? undefined : value),
    z.string().datetime().optional()
  );
}
