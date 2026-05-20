import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSignalsOnArena } from '@/lib/arc/resolveSignals';
import { getServerEnv } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';
import { fetchCandles } from '@/lib/prices/fetchCandles';
import type { SupportedAsset } from '@/lib/polymarket/types';
import { resolveCryptoMarket } from '@/lib/resolution/resolveCryptoMarket';
import { computeSignalCorrectness } from '@/lib/resolution/scoring';

const resolveSignalsBodySchema = z.object({
  limit: z.number().int().min(1).max(100).optional()
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

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const parsedBody = resolveSignalsBodySchema.safeParse(await parseJson(request));
  if (!parsedBody.success) {
    return invalidRequestResponse(parsedBody.error.issues);
  }

  const env = getServerEnv();
  const adminToken = request.headers.get('x-admin-resolve-token');
  const adminTokenValid =
    Boolean(adminToken) && Boolean(env.admin.resolveToken) && adminToken === env.admin.resolveToken;
  if (adminToken && !adminTokenValid) {
    return NextResponse.json({ reason: 'invalid_admin_token' }, { status: 403 });
  }

  const store = getRuntimeStore();
  const signals = (await store.listSignals())
    .filter((signal) => signal.status === 'committed' && !signal.resolution && signal.side !== 'AVOID')
    .slice(0, parsedBody.data.limit ?? 100);
  const candlesByAsset = new Map<SupportedAsset, Awaited<ReturnType<typeof fetchCandles>>>();
  const prepared = [];
  const resolved = [];
  const skipped = [];

  for (const signal of signals) {
    let series = candlesByAsset.get(signal.asset);
    if (!series) {
      series = await fetchCandles(signal.asset);
      candlesByAsset.set(signal.asset, series);
    }

    const result = resolveCryptoMarket({
      signal,
      candles: series.candles
    });

    if (!result.ok) {
      skipped.push({
        signalId: signal.id,
        reason: result.reason
      });
      continue;
    }

    const outcomeCorrect = computeSignalCorrectness(signal, result.yesOutcome);
    prepared.push({
      signal,
      outcomeCorrect,
      result
    });
  }

  let onchainTxHash: `0x${string}` | null = null;
  let onchainStatus: string = 'skipped_no_record_ids';

  if (prepared.length > 0 && prepared.every((entry) => entry.signal.arcSignalRecordId)) {
    if (!adminTokenValid) {
      onchainStatus = 'skipped_admin_token';
    } else {
      try {
        const onchainResult = await resolveSignalsOnArena(
          prepared.map((entry) => entry.signal.arcSignalRecordId!),
          prepared.map((entry) => entry.outcomeCorrect)
        );
        onchainTxHash = onchainResult.txHash;
        onchainStatus = 'resolved';
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'resolve_onchain_failed';
        if (reason !== 'resolve_config_missing') {
          return NextResponse.json({ reason, resolved: [], skipped }, { status: 409 });
        }
        onchainStatus = 'skipped_config_missing';
      }
    }
  }

  for (const entry of prepared) {
    const resolvedSignal = await store.resolveSignal(entry.signal.id, entry.outcomeCorrect, entry.result.observedAt, {
      yesOutcome: entry.result.yesOutcome,
      source: 'automatic',
      settlementPrice: entry.result.settlementPrice,
      observedAt: entry.result.observedAt,
      onchainTxHash
    });

    resolved.push({
      signalId: entry.signal.id,
      yesOutcome: entry.result.yesOutcome,
      outcomeCorrect: entry.outcomeCorrect,
      settlementPrice: entry.result.settlementPrice,
      observedAt: entry.result.observedAt,
      signal: resolvedSignal
    });
  }

  return NextResponse.json({
    resolved,
    skipped,
    onchain: {
      status: onchainStatus,
      txHash: onchainTxHash
    },
    metrics: await store.getMetrics(),
    leaderboard: await store.getLeaderboard()
  });
}
