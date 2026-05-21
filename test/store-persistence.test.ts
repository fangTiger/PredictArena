import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it, vi } from 'vitest';

const TEST_SIGNAL = {
  id: 'demo-btc-105k:volatility',
  runId: 'run:demo-btc-105k:2026-05-20T00:00:00.000Z',
  marketId: 'demo-btc-105k',
  marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
  marketUrl: 'https://polymarket.com/event/demo-btc-105k',
  asset: 'BTC',
  conditionType: 'EXPIRY_ABOVE',
  thresholdUsd: 105000,
  expiresAt: '2026-05-30T23:59:00.000Z',
  agentName: 'volatility' as const,
  modelVersion: 'volatility-gbm-v1',
  modelParams: { sigma: 0.7 },
  modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111' as const,
  dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222' as const,
  side: 'YES' as const,
  status: 'generated' as const,
  confidence: 'HIGH' as const,
  confidenceBps: 7600,
  marketPriceBps: 5400,
  agentProbabilityBps: 7600,
  yesPriceBps: 5400,
  pYesBps: 7600,
  edgeBps: 2200,
  kellyBps: 300,
  stakeMicroUsdc: 50000,
  riskFlags: [],
  arcTxHash: null,
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
  source: 'demo_snapshot' as const,
  resolution: null
};

describe('local persistence store', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('persists scans and signals to local JSON when Supabase is absent', async () => {
    const workdir = path.join(tmpdir(), `predictarena-store-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const store = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });

    await store.saveMarketScan({
      source: 'demo_snapshot',
      fallbackReason: 'network down',
      markets: [
        {
          id: 'demo-btc-105k',
          eventId: 'demo-event-btc-105k',
          slug: 'demo-btc-105k',
          question: 'Will BTC be above $105,000 on May 30, 2026?',
          source: 'demo_snapshot',
          endDate: '2026-05-30T23:59:00.000Z',
          yesPriceBps: 5400,
          noPriceBps: 4600,
          liquidity: 200000,
          volume: 10000,
          active: true,
          closed: false,
          clobTokenIds: [],
          url: null,
          rawPayload: {},
          asset: 'BTC',
          conditionType: 'EXPIRY_ABOVE',
          thresholdUsd: 105000,
          expiresAt: '2026-05-30T23:59:00.000Z',
          yesMeaning: 'YES means BTC closes above $105,000 at expiry.',
          parseConfidence: 0.92,
          scoutScoreBps: 7800
        }
      ]
    });
    await store.saveAgentRun({
      runId: 'run-1',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [TEST_SIGNAL]
    });

    const reloadedStore = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });
    const state = await reloadedStore.getArenaState();

    expect(state.latestScan?.source).toBe('demo_snapshot');
    expect(state.signals).toHaveLength(1);
    expect(state.signals[0]?.id).toBe(TEST_SIGNAL.id);
  });

  it('falls back to in-memory state when file writes fail', async () => {
    const workdir = path.join(tmpdir(), `predictarena-store-fail-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });

    const { promises: fsModule } = await import('node:fs');
    const writeSpy = vi.spyOn(fsModule, 'writeFile').mockRejectedValueOnce(new Error('disk full'));
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const store = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });

    await store.saveAgentRun({
      runId: 'run-memory',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [TEST_SIGNAL]
    });

    const signals = await store.listSignals();

    expect(writeSpy).toHaveBeenCalled();
    expect(signals).toHaveLength(1);
    expect(signals[0]?.id).toBe(TEST_SIGNAL.id);
  });

  it('persists autonomous run history and queue outcomes across reloads', async () => {
    const workdir = path.join(tmpdir(), `predictarena-autonomy-store-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const store = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });

    await store.saveAutonomousRun({
      runId: 'auto-run-1',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:00.000Z',
      completedAt: '2026-05-20T12:00:05.000Z',
      marketCount: 1,
      generatedSignalCount: 1,
      modeByAgent: {
        volatility: 'DRY_RUN',
        momentum: 'OFF'
      },
      queue: [
        {
          signalId: TEST_SIGNAL.id,
          agentName: 'volatility',
          status: 'dry_run_eligible',
          reason: null,
          txHash: null,
          edgeBps: TEST_SIGNAL.edgeBps,
          stakeMicroUsdc: TEST_SIGNAL.stakeMicroUsdc
        }
      ]
    });

    const reloadedStore = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });
    const state = await reloadedStore.getArenaState();

    expect(state.autonomyRuns).toHaveLength(1);
    expect(state.autonomyRuns[0]).toMatchObject({
      runId: 'auto-run-1',
      queue: [
        expect.objectContaining({
          signalId: TEST_SIGNAL.id,
          status: 'dry_run_eligible'
        })
      ]
    });
  });

  it('syncs autonomous run history inside the Supabase payload state', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (!init?.method || init.method === 'GET') {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }

      return new Response(null, { status: 201 });
    });
    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    const { createSupabaseStore } = await import('@/lib/persistence/supabaseStore');
    const store = createSupabaseStore({
      url: 'https://example.supabase.co',
      serviceRoleKey: 'service-role-key',
      stateTable: 'predictarena_state'
    });

    await store.saveAutonomousRun({
      runId: 'supabase-auto-run-1',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:00.000Z',
      completedAt: '2026-05-20T12:00:05.000Z',
      marketCount: 1,
      generatedSignalCount: 1,
      modeByAgent: {
        volatility: 'DRY_RUN',
        momentum: 'OFF'
      },
      queue: []
    });

    const saveCall = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST');
    const body = saveCall?.[1]?.body;
    expect(typeof body).toBe('string');
    expect(String(body)).toContain('supabase-auto-run-1');
    expect(String(body)).toContain('autonomyRuns');
  });

  it('acquires autonomous runs once per key or schedule window and blocks conflicting locks', async () => {
    const workdir = path.join(tmpdir(), `predictarena-lock-store-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const store = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });

    const first = await store.acquireAutonomousRun({
      runId: 'auto-run-1',
      idempotencyKey: 'cron:window-1',
      scheduleWindowId: '2026-05-20T12:00:00.000Z/15m',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:00.000Z',
      lockTtlMs: 60_000
    });
    const sameKey = await store.acquireAutonomousRun({
      runId: 'auto-run-2',
      idempotencyKey: 'cron:window-1',
      scheduleWindowId: '2026-05-20T12:15:00.000Z/15m',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:10.000Z',
      lockTtlMs: 60_000
    });
    const sameWindow = await store.acquireAutonomousRun({
      runId: 'auto-run-3',
      idempotencyKey: 'cron:window-3',
      scheduleWindowId: '2026-05-20T12:00:00.000Z/15m',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:20.000Z',
      lockTtlMs: 60_000
    });
    const locked = await store.acquireAutonomousRun({
      runId: 'auto-run-4',
      idempotencyKey: 'cron:window-4',
      scheduleWindowId: '2026-05-20T12:30:00.000Z/15m',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:30.000Z',
      lockTtlMs: 60_000
    });
    const recovered = await store.acquireAutonomousRun({
      runId: 'auto-run-5',
      idempotencyKey: 'cron:window-5',
      scheduleWindowId: '2026-05-20T12:45:00.000Z/15m',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:02:01.000Z',
      lockTtlMs: 60_000
    });

    expect(first).toMatchObject({
      status: 'acquired',
      run: {
        runId: 'auto-run-1',
        idempotencyKey: 'cron:window-1',
        scheduleWindowId: '2026-05-20T12:00:00.000Z/15m',
        status: 'started'
      }
    });
    expect(sameKey).toMatchObject({
      status: 'duplicate',
      duplicateBy: 'idempotency_key',
      run: {
        runId: 'auto-run-1'
      }
    });
    expect(sameWindow).toMatchObject({
      status: 'duplicate',
      duplicateBy: 'schedule_window',
      run: {
        runId: 'auto-run-1'
      }
    });
    expect(locked).toMatchObject({
      status: 'locked',
      lock: {
        runId: 'auto-run-1'
      }
    });
    expect(recovered).toMatchObject({
      status: 'acquired',
      run: {
        runId: 'auto-run-5',
        status: 'started'
      }
    });
  });

  it('persists uncertain autonomy commit claims across reloads for crash recovery', async () => {
    const workdir = path.join(tmpdir(), `predictarena-claims-store-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const storagePath = path.join(workdir, 'predictarena-store.json');
    const store = createLocalStore({ storagePath });

    const acquired = await store.acquireCommitClaim({
      scope: 'autonomy',
      claimKey: 'autonomy:5042002:arena-1:demo-btc-105k:volatility',
      signalId: TEST_SIGNAL.id,
      agentName: 'volatility',
      stakeMicroUsdc: TEST_SIGNAL.stakeMicroUsdc,
      chainId: 5_042_002,
      arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createdAt: '2026-05-20T12:00:00.000Z',
      runId: 'auto-run-1'
    });

    await store.updateCommitClaim({
      scope: 'autonomy',
      claimKey: 'autonomy:5042002:arena-1:demo-btc-105k:volatility',
      status: 'uncertain',
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      reasonCode: 'persist_committed_signal_failed',
      updatedAt: '2026-05-20T12:00:03.000Z'
    });

    const reloadedStore = createLocalStore({ storagePath });
    const opsState = await reloadedStore.getOperationsState();

    expect(acquired).toMatchObject({
      status: 'acquired',
      claim: {
        signalId: TEST_SIGNAL.id,
        status: 'pending'
      }
    });
    expect(opsState.autonomous.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claimKey: 'autonomy:5042002:arena-1:demo-btc-105k:volatility',
          status: 'uncertain',
          txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          reasonCode: 'persist_committed_signal_failed'
        })
      ])
    );
  });
});
