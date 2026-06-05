import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runAgents } from '@/lib/agents/runAgents';
import { fetchCandidateMarkets } from '@/lib/polymarket/fetchMarkets';
import { fetchPriceSnapshots } from '@/lib/prices/fetchCandles';
import { getRuntimeStore } from '@/lib/persistence/store';
import { discoverShowdowns } from '@/lib/services/showdownDiscovery';
import { buildDefaultDiscoveryDeps } from '@/lib/services/showdownDiscoveryDefaults';

const runAgentsBodySchema = z.object({
  limit: z.number().int().positive().max(20).optional()
});

export const dynamic = 'force-dynamic';

const SAFE_SHOWDOWN_DISCOVERY_ERROR_REASONS = new Set([
  'showdown_discovery_config_missing',
  'showdown_discovery_bond_invalid',
  'showdown_discovery_deadline_invalid',
  'showdown_discovery_agent_key_missing:volatility',
  'showdown_discovery_agent_key_missing:momentum'
]);

function invalidRequestResponse(issues: z.ZodIssue[]) {
  return NextResponse.json(
    {
      reason: 'invalid_request',
      issues: issues.map(({ code, message, path }) => ({ code, message, path }))
    },
    { status: 400 }
  );
}

function safeReasonCode(input: unknown, fallback: string): string {
  if (typeof input !== 'string') {
    return fallback;
  }

  return SAFE_SHOWDOWN_DISCOVERY_ERROR_REASONS.has(input) ? input : fallback;
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

  const showdowns = {
    discovery: {
      status: 'ok' as 'ok' | 'error',
      result: null as Awaited<ReturnType<typeof discoverShowdowns>> | null,
      reason: null as string | null
    }
  };

  try {
    showdowns.discovery.result = await discoverShowdowns(await buildDefaultDiscoveryDeps());
  } catch (error) {
    showdowns.discovery.status = 'error';
    showdowns.discovery.result = null;
    const sanitizedReason = safeReasonCode(
      error instanceof Error ? error.message : null,
      'showdown_discovery_failed'
    );
    showdowns.discovery.reason = sanitizedReason;
    console.warn('[run-agents] showdown discovery failed', sanitizedReason);
  }

  return NextResponse.json({
    source: marketResult.source,
    fallbackReason: marketResult.fallbackReason,
    markets: marketResult.markets,
    signals,
    metrics: await store.getMetrics(),
    showdowns
  });
}
