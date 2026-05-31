import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildSignalResearchView } from '@/lib/intelligence/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import {
  invalidRequestResponse,
  searchParamsObject
} from '@/app/api/intelligence/shared';

const querySchema = z
  .object({
    signalId: z.string().min(1).optional(),
    marketId: z.string().min(1).optional()
  })
  .refine(
    ({ signalId, marketId }) => Number(Boolean(signalId)) + Number(Boolean(marketId)) === 1,
    {
      message: 'Exactly one of signalId or marketId is required',
      path: ['signalId']
    }
  );

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const parsedQuery = querySchema.safeParse(searchParamsObject(request));
  if (!parsedQuery.success) {
    return invalidRequestResponse(parsedQuery.error.issues);
  }

  const state = await getRuntimeStore().getArenaState();
  const research = buildSignalResearchView(state, parsedQuery.data, new Date().toISOString());
  if (!research) {
    return NextResponse.json({ reason: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ research });
}
