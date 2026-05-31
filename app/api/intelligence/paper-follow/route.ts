import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildPaperFollowResult } from '@/lib/intelligence/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import {
  ASSET_VALUES,
  CONDITION_TYPE_VALUES,
  CONFIDENCE_VALUES,
  invalidRequestResponse,
  optionalIsoDatetime,
  searchParamsObject
} from '@/app/api/intelligence/shared';

const querySchema = z
  .object({
    agentName: z.enum(['volatility', 'momentum', 'all']).default('all'),
    minEdgeBps: z.coerce.number().int().min(0).max(5_000).default(700),
    confidence: z.enum(CONFIDENCE_VALUES).default('all'),
    asset: z.enum(ASSET_VALUES).default('all'),
    conditionType: z.enum(CONDITION_TYPE_VALUES).default('all'),
    from: optionalIsoDatetime(),
    to: optionalIsoDatetime(),
    stakeModel: z
      .enum(['signal_stake', 'flat_1_usdc', 'confidence_weighted'])
      .default('signal_stake')
  })
  .refine(
    ({ from, to }) =>
      !from || !to || new Date(from).getTime() <= new Date(to).getTime(),
    {
      message: 'from must be earlier than or equal to to',
      path: ['from']
    }
  );

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse(searchParamsObject(request));
  if (!parsedQuery.success) {
    return invalidRequestResponse(parsedQuery.error.issues);
  }

  const state = await getRuntimeStore().getArenaState();
  const filters = {
    ...parsedQuery.data,
    from: parsedQuery.data.from ?? null,
    to: parsedQuery.data.to ?? null
  };

  return NextResponse.json({
    result: buildPaperFollowResult(state, filters, new Date().toISOString())
  });
}
