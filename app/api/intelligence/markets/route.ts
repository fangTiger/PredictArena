import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildMarketIntelligenceCatalog } from '@/lib/intelligence/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import {
  ASSET_VALUES,
  CONDITION_TYPE_VALUES,
  CONFIDENCE_VALUES,
  invalidRequestResponse,
  searchParamsObject
} from '@/app/api/intelligence/shared';

const querySchema = z.object({
  asset: z.enum(ASSET_VALUES).default('all'),
  conditionType: z.enum(CONDITION_TYPE_VALUES).default('all'),
  confidence: z.enum(CONFIDENCE_VALUES).default('all'),
  source: z.enum(['live', 'demo_snapshot', 'all']).default('all'),
  sort: z
    .enum([
      'opportunity_desc',
      'edge_desc',
      'expiry_asc',
      'liquidity_desc',
      'risk_asc',
      'data_health_desc'
    ])
    .default('opportunity_desc'),
  minEdgeBps: z.coerce.number().int().min(0).max(5_000).default(0),
  maxExpiryDays: z.coerce.number().int().min(1).max(21).default(21),
  minLiquidity: z.coerce.number().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse(searchParamsObject(request));
  if (!parsedQuery.success) {
    return invalidRequestResponse(parsedQuery.error.issues);
  }

  const state = await getRuntimeStore().getArenaState();
  const payload = buildMarketIntelligenceCatalog(
    state,
    parsedQuery.data,
    new Date().toISOString()
  );

  return NextResponse.json(payload);
}
