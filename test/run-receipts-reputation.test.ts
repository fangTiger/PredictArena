import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSignal } from '@/lib/polymarket/types';

const HASH_A = '0x1111111111111111111111111111111111111111111111111111111111111111' as const;
const HASH_B = '0x2222222222222222222222222222222222222222222222222222222222222222' as const;
const TX_A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' as const;

async function createTempStorePath() {
  const dir = path.join(tmpdir(), `predictarena-receipts-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'predictarena-store.json');
}

function makeSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  const agentName = overrides.agentName ?? 'volatility';
  const id = overrides.id ?? `demo-btc:${agentName}`;

  return {
    id,
    runId: overrides.runId ?? 'run-demo',
    marketId: overrides.marketId ?? 'demo-btc',
    marketQuestion:
      overrides.marketQuestion ?? 'Will BTC be above $105,000 on May 30, 2026?',
    marketUrl: overrides.marketUrl ?? 'https://polymarket.com/event/demo-btc',
    asset: overrides.asset ?? 'BTC',
    conditionType: overrides.conditionType ?? 'EXPIRY_ABOVE',
    thresholdUsd: overrides.thresholdUsd ?? 105000,
    expiresAt: overrides.expiresAt ?? '2026-05-30T23:59:00.000Z',
    agentName,
    modelVersion:
      overrides.modelVersion ??
      (agentName === 'volatility' ? 'volatility-gbm-v1' : 'momentum-gbm-v1'),
    modelParams: overrides.modelParams ?? { sigma: 0.7 },
    modelHash: overrides.modelHash ?? HASH_A,
    dataHash: overrides.dataHash ?? HASH_B,
    side: overrides.side ?? 'YES',
    status: overrides.status ?? 'generated',
    confidence: overrides.confidence ?? 'HIGH',
    confidenceBps: overrides.confidenceBps ?? 7600,
    marketPriceBps: overrides.marketPriceBps ?? 5400,
    agentProbabilityBps: overrides.agentProbabilityBps ?? 7600,
    yesPriceBps: overrides.yesPriceBps ?? 5400,
    pYesBps: overrides.pYesBps ?? 7600,
    edgeBps: overrides.edgeBps ?? 2200,
    kellyBps: overrides.kellyBps ?? 300,
    stakeMicroUsdc: overrides.stakeMicroUsdc ?? 50000,
    riskFlags: overrides.riskFlags ?? [],
    arcTxHash: overrides.arcTxHash ?? null,
    arcSignalRecordId: overrides.arcSignalRecordId,
    createdAt: overrides.createdAt ?? '2026-05-20T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-05-20T00:00:00.000Z',
    source: overrides.source ?? 'demo_snapshot',
    resolution: overrides.resolution ?? null
  };
}

describe('run receipts, reputation profiles, and demo script read models', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('ALLOW_DEMO_SNAPSHOT', 'true');
    vi.stubEnv('PREDICTARENA_LOCAL_STORE_PATH', await createTempStorePath());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('GET /api/autonomy/runs/[runId] returns an audit receipt and never exposes secrets', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret-never-render');
    vi.stubEnv('VOL_AGENT_PRIVATE_KEY', HASH_A);
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });
    const signal = makeSignal({
      id: 'receipt-signal',
      status: 'committed',
      arcTxHash: TX_A
    });
    const runId = 'autonomy:2026-05-20T12:00:00.000Z';

    await store.saveAgentRun({
      runId,
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T12:00:00.000Z',
      signals: [signal]
    });
    await store.saveAutonomousRun({
      runId,
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:00.000Z',
      completedAt: '2026-05-20T12:00:05.000Z',
      marketCount: 1,
      generatedSignalCount: 1,
      modeByAgent: { volatility: 'LIVE', momentum: 'OFF' },
      queue: [
        {
          signalId: signal.id,
          agentName: 'volatility',
          status: 'committed',
          reason: null,
          txHash: TX_A,
          edgeBps: signal.edgeBps,
          stakeMicroUsdc: signal.stakeMicroUsdc
        }
      ],
      budgetSnapshots: [
        {
          agentName: 'volatility',
          mode: 'LIVE',
          dailyBondUsedUsdc6: 50000,
          signalsUsedToday: 1,
          openSignals: 1,
          policy: {
            mode: 'LIVE',
            maxDailyBondUsdc6: 150000,
            maxSignalsPerDay: 4,
            maxStakePerSignalUsdc6: 50000,
            maxOpenSignals: 3,
            minEdgeBps: 900
          }
        }
      ]
    });
    setRuntimeStoreForTests(store);

    const { GET } = await import('@/app/api/autonomy/runs/[runId]/route');
    const response = await GET(new Request(`http://localhost/api/autonomy/runs/${runId}`), {
      params: Promise.resolve({ runId })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.receipt).toMatchObject({
      runId,
      source: 'demo_snapshot',
      modeByAgent: { volatility: 'LIVE', momentum: 'OFF' },
      queue: [
        expect.objectContaining({
          signalId: signal.id,
          status: 'committed',
          txHash: TX_A,
          modelHash: HASH_A,
          dataHash: HASH_B
        })
      ]
    });
    expect(JSON.stringify(payload)).not.toContain('cron-secret-never-render');
    expect(JSON.stringify(payload)).not.toContain('VOL_AGENT_PRIVATE_KEY');
  });

  it('GET /api/autonomy/runs/[runId] returns controlled not_found for unknown runs', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    setRuntimeStoreForTests(
      createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! })
    );

    const { GET } = await import('@/app/api/autonomy/runs/[runId]/route');
    const response = await GET(new Request('http://localhost/api/autonomy/runs/missing'), {
      params: Promise.resolve({ runId: 'missing' })
    });
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.reason).toBe('run_not_found');
  });

  it('GET /api/agents/[agentName] returns derived reputation profile metrics', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-reputation',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T12:00:00.000Z',
      signals: [
        makeSignal({
          id: 'resolved-best',
          status: 'resolved_correct',
          arcTxHash: TX_A,
          confidence: 'HIGH',
          pYesBps: 9000,
          agentProbabilityBps: 9000,
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-05-20T13:00:00.000Z',
            source: 'demo_admin'
          }
        }),
        makeSignal({
          id: 'resolved-worst',
          status: 'resolved_incorrect',
          arcTxHash: TX_A,
          confidence: 'MEDIUM',
          pYesBps: 9000,
          agentProbabilityBps: 9000,
          resolution: {
            outcomeCorrect: false,
            yesOutcome: false,
            resolvedAt: '2026-05-20T14:00:00.000Z',
            source: 'demo_admin'
          }
        }),
        makeSignal({
          id: 'open-signal',
          status: 'committed',
          arcTxHash: TX_A,
          confidence: 'LOW',
          resolution: null
        }),
        makeSignal({
          id: 'momentum-other',
          agentName: 'momentum',
          status: 'generated'
        })
      ]
    });
    setRuntimeStoreForTests(store);

    const { GET } = await import('@/app/api/agents/[agentName]/route');
    const response = await GET(new Request('http://localhost/api/agents/volatility'), {
      params: Promise.resolve({ agentName: 'volatility' })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.profile).toMatchObject({
      agentName: 'volatility',
      generatedSignals: 3,
      committedSignals: 3,
      openSignals: 1,
      resolvedSignals: 2,
      confidenceDistribution: { low: 1, medium: 1, high: 1 },
      bestResolvedSignal: expect.objectContaining({ signalId: 'resolved-best' }),
      worstResolvedSignal: expect.objectContaining({ signalId: 'resolved-worst' })
    });
  });

  it('GET /api/agents/[agentName] validates supported agent names', async () => {
    const { GET } = await import('@/app/api/agents/[agentName]/route');
    const response = await GET(new Request('http://localhost/api/agents/rogue'), {
      params: Promise.resolve({ agentName: 'rogue' })
    });
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe('unsupported_agent');
  });

  it('GET /api/demo-script returns demo-only settlement guidance without exposing admin secrets', async () => {
    vi.stubEnv('ADMIN_RESOLVE_TOKEN', 'admin-token-never-render');
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-demo-script',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T12:00:00.000Z',
      signals: [
        makeSignal({
          id: 'demo-eligible',
          status: 'committed',
          arcTxHash: TX_A
        }),
        makeSignal({
          id: 'demo-resolved',
          status: 'resolved_correct',
          arcTxHash: TX_A,
          resolution: {
            outcomeCorrect: true,
            yesOutcome: true,
            resolvedAt: '2026-05-20T14:00:00.000Z',
            source: 'demo_admin'
          }
        })
      ]
    });
    setRuntimeStoreForTests(store);

    const { GET } = await import('@/app/api/demo-script/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.script).toMatchObject({
      settlementLabel: 'Demo/Admin Only',
      oracleDisclaimer: 'not an oracle',
      eligibleSignals: [expect.objectContaining({ signalId: 'demo-eligible' })],
      recentResolvedSignals: [expect.objectContaining({ signalId: 'demo-resolved' })]
    });
    expect(payload.script.steps.map((step: { id: string }) => step.id)).toEqual([
      'generate',
      'commit-readiness',
      'demo-settlement',
      'leaderboard-sync',
      'verify'
    ]);
    expect(JSON.stringify(payload)).not.toContain('admin-token-never-render');
  });
});
