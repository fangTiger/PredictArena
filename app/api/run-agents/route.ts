import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAgents } from '@/lib/agents/runAgents';
import { fetchCandidateMarkets } from '@/lib/polymarket/fetchMarkets';
import { fetchPriceSnapshots } from '@/lib/prices/fetchCandles';
import { getRuntimeStore } from '@/lib/persistence/store';

const runAgentsBodySchema = z.object({
  limit: z.number().int().positive().max(20).optional()
});

export const dynamic = 'force-dynamic';

function invalidRequestResponse(issues: z.ZodIssue[]) {
  return NextResponse.json(
    {
      reason: 'invalid_request',
      issues: issues.map(({ code, message, path }) => ({ code, message, path }))
    },
    { status: 400 }
  );
}

export async function POST(request: Request) {
  const body = request.headers.get('content-type')?.includes('application/json')
    ? await request.json()
    : {};
  const parsedBody = runAgentsBodySchema.safeParse(body);
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }
  const { limit } = parsedBody.data;

  const store = getRuntimeStore();
  const marketResult = await fetchCandidateMarkets({ limit });
  await store.saveMarketScan(marketResult);
  const assets = [...new Set(marketResult.markets.map((market) => market.asset))];
  const priceByAsset = await fetchPriceSnapshots(assets);
  const now = new Date().toISOString();
  const signals = runAgents(marketResult.markets, priceByAsset, { now });

  await store.saveAgentRun({
    runId: `run:${now}`,
    source: marketResult.source,
    generatedAt: now,
    signals
  });

  return NextResponse.json({
    source: marketResult.source,
    fallbackReason: marketResult.fallbackReason,
    markets: marketResult.markets,
    signals,
    metrics: await store.getMetrics()
  });
}
