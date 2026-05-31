import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildSegmentedAgentReputation } from '@/lib/intelligence/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import {
  ASSET_VALUES,
  CONDITION_TYPE_VALUES,
  CONFIDENCE_VALUES,
  invalidRequestResponse,
  searchParamsObject
} from '@/app/api/intelligence/shared';

const querySchema = z.object({
  groupBy: z
    .enum(['agent', 'asset', 'conditionType', 'expiryBucket', 'confidenceBucket', 'edgeBucket'])
    .default('agent'),
  asset: z.enum(ASSET_VALUES).default('all'),
  conditionType: z.enum(CONDITION_TYPE_VALUES).default('all'),
  confidence: z.enum(CONFIDENCE_VALUES).default('all'),
  minResolved: z.coerce.number().int().min(0).max(100).default(3)
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse(searchParamsObject(request));
  if (!parsedQuery.success) {
    return invalidRequestResponse(parsedQuery.error.issues);
  }

  const state = await getRuntimeStore().getArenaState();

  return NextResponse.json({
    filters: parsedQuery.data,
    rows: buildSegmentedAgentReputation(state, parsedQuery.data)
  });
}
