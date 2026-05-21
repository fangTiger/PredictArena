import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ArcControlRoomState } from '@/lib/arc/controlRoom';

function createSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proof-signal-1',
    runId: 'proof-run-1',
    marketId: 'proof-market-1',
    marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
    marketUrl: 'https://polymarket.com/event/proof-market-1',
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 105000,
    expiresAt: '2026-05-30T23:59:00.000Z',
    agentName: 'volatility',
    modelVersion: 'volatility-gbm-v1',
    modelParams: { sigma: 0.7 },
    modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    side: 'YES',
    status: 'generated',
    confidence: 'HIGH',
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
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

async function createTempStorePath() {
  const dir = path.join(tmpdir(), `predictarena-proof-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'predictarena-store.json');
}

function createReadyControlRoom(
  overrides: Partial<ArcControlRoomState> = {}
): ArcControlRoomState {
  return {
    status: 'ready',
    reason: null,
    chainId: 5_042_002,
    arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
    commitAvailable: true,
    latestTxHash: null,
    wallets: {
      volatility: {
        publicAddress: '0x1111111111111111111111111111111111111111',
        usdcBalanceMicroUsdc: '100000',
        allowanceMicroUsdc: '100000'
      },
      momentum: {
        publicAddress: '0x2222222222222222222222222222222222222222',
        usdcBalanceMicroUsdc: '100000',
        allowanceMicroUsdc: '100000'
      }
    },
    ...overrides
  };
}

function mockReadyControlRoom(overrides: Partial<ArcControlRoomState> = {}) {
  vi.doMock('@/lib/arc/controlRoom', async () => {
    const actual = await vi.importActual<typeof import('@/lib/arc/controlRoom')>(
      '@/lib/arc/controlRoom'
    );
    return {
      ...actual,
      getArcControlRoomState: vi.fn().mockResolvedValue(createReadyControlRoom(overrides))
    };
  });
}

describe('proof mode routes', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.doUnmock('@/lib/arc/commitSignal');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:00:00.000Z'));
    vi.stubEnv('ALLOW_DEMO_SNAPSHOT', 'true');
    vi.stubEnv('PREDICTARENA_LOCAL_STORE_PATH', await createTempStorePath());
    vi.stubEnv('PROOF_MODE_SECRET', 'judge-secret');
    vi.stubEnv('PROOF_SMOKE_MAX_STAKE_USDC6', '50000');
    vi.stubEnv('PROOF_SMOKE_MAX_DAILY_USDC6', '50000');
    vi.stubEnv('PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY', '1');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('GET /api/proof/smoke stays read-only and never exposes secrets', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-1',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal()]
    });
    setRuntimeStoreForTests(store);

    const { GET } = await import('@/app/api/proof/smoke/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      mode: 'read_only',
      transactionAttempted: false
    });
    expect(JSON.stringify(payload)).not.toContain('judge-secret');
    expect(JSON.stringify(payload)).not.toContain('PROOF_MODE_SECRET');
  });

  it('GET /api/proof/smoke returns safe eligible signal candidates for autofill', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { parseServerEnv } = await import('@/lib/config/env');
    const { getProofSmokeView } = await import('@/lib/proof/service');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-autofill',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        createSignal({ id: 'proof-signal-autofill' }),
        createSignal({
          id: 'proof-signal-autofill-blocked',
          marketId: 'proof-market-autofill-blocked',
          stakeMicroUsdc: 70000
        })
      ]
    });

    const smoke = await getProofSmokeView({
      store,
      env: parseServerEnv(process.env),
      now: '2026-05-20T12:00:00.000Z',
      controlRoom: createReadyControlRoom()
    });
    const serialized = JSON.stringify(smoke);

    expect(smoke.eligibleSignals).toEqual([
      {
        id: 'proof-signal-autofill',
        agentName: 'volatility',
        marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
        confidence: 'HIGH',
        confidenceBps: 7600,
        edgeBps: 2200,
        stakeMicroUsdc: 50000
      }
    ]);
    expect(serialized).not.toContain('judge-secret');
    expect(serialized).not.toContain('modelHash');
    expect(serialized).not.toContain('dataHash');
    expect(serialized).not.toContain('modelParams');
  });

  it('GET /api/proof/smoke still returns autofill candidates when proof tx caps are disabled', async () => {
    vi.stubEnv('PROOF_SMOKE_MAX_STAKE_USDC6', '0');
    vi.stubEnv('PROOF_SMOKE_MAX_DAILY_USDC6', '0');
    vi.stubEnv('PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY', '0');
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { parseServerEnv } = await import('@/lib/config/env');
    const { getProofSmokeView } = await import('@/lib/proof/service');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-disabled-autofill',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal({ id: 'proof-signal-disabled-autofill' })]
    });

    const smoke = await getProofSmokeView({
      store,
      env: parseServerEnv(process.env),
      now: '2026-05-20T12:00:00.000Z',
      controlRoom: createReadyControlRoom()
    });

    expect(smoke.commitPreconditions).toMatchObject({
      commitAvailable: false,
      blockingReasonCode: 'proof_tx_disabled'
    });
    expect(smoke.eligibleSignals[0]).toMatchObject({
      id: 'proof-signal-disabled-autofill',
      agentName: 'volatility'
    });
  });

  it('GET /api/proof returns a sanitized proof pack with operator health', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-pack',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal()]
    });
    await store.saveAutonomousRun({
      runId: 'auto-run-pack',
      idempotencyKey: 'cron:2026-05-20T00:00:00.000Z/15m',
      scheduleWindowId: '2026-05-20T00:00:00.000Z/15m',
      status: 'completed',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T00:00:00.000Z',
      completedAt: '2026-05-20T00:00:05.000Z',
      marketCount: 1,
      generatedSignalCount: 1,
      modeByAgent: {
        volatility: 'DRY_RUN',
        momentum: 'OFF'
      },
      queue: []
    });
    setRuntimeStoreForTests(store);

    const { GET } = await import('@/app/api/proof/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      proofPack: {
        latestReceipt: {
          runId: 'auto-run-pack'
        },
        operatorHealth: {
          items: expect.any(Array)
        }
      }
    });
    expect(JSON.stringify(payload)).not.toContain('judge-secret');
    expect(JSON.stringify(payload)).not.toContain('PROOF_MODE_SECRET');
    expect(JSON.stringify(payload)).not.toContain('idempotencyKey');
  });

  it('POST /api/proof/smoke enforces secret auth and finite proof caps', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-2',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        createSignal({ id: 'proof-signal-cap', stakeMicroUsdc: 70000 }),
        createSignal({ id: 'proof-signal-budget', stakeMicroUsdc: 50000, marketId: 'proof-market-2' })
      ]
    });
    await store.acquireCommitClaim({
      scope: 'proof',
      claimKey: 'proof:5042002:arena-1:proof-signal-budget',
      signalId: 'proof-signal-budget',
      agentName: 'volatility',
      stakeMicroUsdc: 50000,
      chainId: 5_042_002,
      arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createdAt: '2026-05-20T08:00:00.000Z'
    });
    await store.updateCommitClaim({
      scope: 'proof',
      claimKey: 'proof:5042002:arena-1:proof-signal-budget',
      status: 'committed',
      txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      reasonCode: null,
      updatedAt: '2026-05-20T08:00:03.000Z'
    });
    setRuntimeStoreForTests(store);

    const { POST } = await import('@/app/api/proof/smoke/route');
    const missingSecret = await POST(
      new Request('http://localhost/api/proof/smoke', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'proof-signal-cap', confirmTx: true }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const overCap = await POST(
      new Request('http://localhost/api/proof/smoke', {
        method: 'POST',
        body: JSON.stringify({
          signalId: 'proof-signal-cap',
          confirmTx: true,
          proofSecret: 'judge-secret'
        }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const existingClaim = await POST(
      new Request('http://localhost/api/proof/smoke', {
        method: 'POST',
        body: JSON.stringify({
          signalId: 'proof-signal-budget',
          confirmTx: true,
          proofSecret: 'judge-secret'
        }),
        headers: { 'content-type': 'application/json' }
      })
    );

    expect(missingSecret.status).toBe(401);
    expect(await missingSecret.json()).toMatchObject({ reason: 'missing_proof_authorization' });
    expect(overCap.status).toBe(409);
    expect(await overCap.json()).toMatchObject({ reason: 'proof_max_stake_exceeded' });
    expect(existingClaim.status).toBe(409);
    expect(await existingClaim.json()).toMatchObject({ reason: 'proof_claim_exists' });
  });

  it('GET /api/proof/smoke only reports commitAvailable when all proof caps are finite', async () => {
    vi.stubEnv('PROOF_SMOKE_MAX_DAILY_USDC6', '0');
    vi.stubEnv('PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY', '0');
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { parseServerEnv } = await import('@/lib/config/env');
    const { getProofSmokeView } = await import('@/lib/proof/service');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-caps',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal({ id: 'proof-signal-caps' })]
    });

    const smoke = await getProofSmokeView({
      store,
      env: parseServerEnv(process.env),
      now: '2026-05-20T12:00:00.000Z',
      controlRoom: {
        status: 'ready',
        reason: null,
        chainId: 5_042_002,
        arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        usdcAddress: '0x3600000000000000000000000000000000000000',
        usdcDecimals: 6,
        commitAvailable: true,
        latestTxHash: null,
        wallets: {
          volatility: {
            publicAddress: '0x1111111111111111111111111111111111111111',
            usdcBalanceMicroUsdc: '100000',
            allowanceMicroUsdc: '100000'
          },
          momentum: {
            publicAddress: '0x2222222222222222222222222222222222222222',
            usdcBalanceMicroUsdc: '100000',
            allowanceMicroUsdc: '100000'
          }
        }
      }
    });

    expect(smoke.commitPreconditions).toMatchObject({
      commitAvailable: false,
      blockingReasonCode: 'proof_tx_disabled'
    });
  });

  it('GET /api/proof/smoke blocks bounded proof tx when an autonomy lock is active', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { parseServerEnv } = await import('@/lib/config/env');
    const { getProofSmokeView } = await import('@/lib/proof/service');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-autonomy-lock',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal({ id: 'proof-signal-autonomy-lock' })]
    });
    await store.acquireAutonomousRun({
      runId: 'autonomy:2026-05-20T12:00:00.000Z/15m',
      idempotencyKey: 'cron:2026-05-20T12:00:00.000Z/15m',
      scheduleWindowId: '2026-05-20T12:00:00.000Z/15m',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:00.000Z',
      lockTtlMs: 5 * 60 * 1000,
      owner: 'cron'
    });

    const smoke = await getProofSmokeView({
      store,
      env: parseServerEnv(process.env),
      now: '2026-05-20T12:00:00.000Z',
      controlRoom: createReadyControlRoom()
    });

    expect(smoke.commitPreconditions).toMatchObject({
      commitAvailable: false,
      blockingReasonCode: 'autonomy_lock_active'
    });
  });

  it.each([
    {
      claimStatus: 'pending',
      expectedReason: 'autonomy_claim_pending'
    },
    {
      claimStatus: 'uncertain',
      expectedReason: 'autonomy_claim_uncertain_reconcile_required',
      txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    }
  ] as const)(
    'POST /api/proof/smoke blocks autonomy %s claims without sending a tx',
    async ({ claimStatus, expectedReason, txHash }) => {
      const commitSignalToArena = vi.fn();
      vi.doMock('@/lib/arc/commitSignal', async () => {
        const actual = await vi.importActual<typeof import('@/lib/arc/commitSignal')>(
          '@/lib/arc/commitSignal'
        );
        return {
          ...actual,
          commitSignalToArena
        };
      });
      mockReadyControlRoom();

      const { createLocalStore } = await import('@/lib/persistence/localStore');
      const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
      const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

      await store.saveAgentRun({
        runId: `proof-run-autonomy-${claimStatus}`,
        source: 'demo_snapshot',
        generatedAt: '2026-05-20T00:00:00.000Z',
        signals: [createSignal({ id: `proof-signal-autonomy-${claimStatus}` })]
      });
      await store.acquireCommitClaim({
        scope: 'autonomy',
        claimKey: `autonomy:5042002:arena-1:proof-signal-autonomy-${claimStatus}:volatility`,
        signalId: `proof-signal-autonomy-${claimStatus}`,
        agentName: 'volatility',
        stakeMicroUsdc: 50000,
        chainId: 5_042_002,
        arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        createdAt: '2026-05-20T09:00:00.000Z',
        runId: 'autonomy:2026-05-20T09:00:00.000Z/15m'
      });
      if (claimStatus === 'uncertain') {
        await store.updateCommitClaim({
          scope: 'autonomy',
          claimKey: `autonomy:5042002:arena-1:proof-signal-autonomy-${claimStatus}:volatility`,
          status: 'uncertain',
          txHash,
          reasonCode: 'commit_receipt_unconfirmed',
          updatedAt: '2026-05-20T09:00:05.000Z'
        });
      }
      setRuntimeStoreForTests(store);

      const { POST } = await import('@/app/api/proof/smoke/route');
      const response = await POST(
        new Request('http://localhost/api/proof/smoke', {
          method: 'POST',
          body: JSON.stringify({
            signalId: `proof-signal-autonomy-${claimStatus}`,
            confirmTx: true,
            proofSecret: 'judge-secret'
          }),
          headers: { 'content-type': 'application/json' }
        })
      );
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(payload).toMatchObject({
        reason: expectedReason,
        claimStatus
      });
      if (txHash) {
        expect(payload).toMatchObject({ txHash });
      }
      expect(commitSignalToArena).not.toHaveBeenCalled();
    }
  );

  it('POST /api/proof/smoke blocks an active autonomy lock without sending a tx', async () => {
    const commitSignalToArena = vi.fn();
    vi.doMock('@/lib/arc/commitSignal', async () => {
      const actual = await vi.importActual<typeof import('@/lib/arc/commitSignal')>(
        '@/lib/arc/commitSignal'
      );
      return {
        ...actual,
        commitSignalToArena
      };
    });
    mockReadyControlRoom();

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-post-autonomy-lock',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal({ id: 'proof-signal-post-autonomy-lock' })]
    });
    await store.acquireAutonomousRun({
      runId: 'autonomy:2026-05-20T12:00:00.000Z/15m',
      idempotencyKey: 'cron:2026-05-20T12:00:00.000Z/15m',
      scheduleWindowId: '2026-05-20T12:00:00.000Z/15m',
      source: 'demo_snapshot',
      triggeredAt: '2026-05-20T12:00:00.000Z',
      lockTtlMs: 5 * 60 * 1000,
      owner: 'cron'
    });
    setRuntimeStoreForTests(store);

    const { POST } = await import('@/app/api/proof/smoke/route');
    const response = await POST(
      new Request('http://localhost/api/proof/smoke', {
        method: 'POST',
        body: JSON.stringify({
          signalId: 'proof-signal-post-autonomy-lock',
          confirmTx: true,
          proofSecret: 'judge-secret'
        }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      reason: 'autonomy_lock_active',
      blockedBy: 'autonomy_lock'
    });
    expect(commitSignalToArena).not.toHaveBeenCalled();
  });

  it('GET /api/proof/smoke excludes signals already claimed by autonomy from bounded proof candidates', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { parseServerEnv } = await import('@/lib/config/env');
    const { getProofSmokeView } = await import('@/lib/proof/service');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-autonomy-candidate-filter',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        createSignal({ id: 'proof-signal-claimed-by-autonomy' }),
        createSignal({ id: 'proof-signal-free', marketId: 'proof-market-free' })
      ]
    });
    await store.acquireCommitClaim({
      scope: 'autonomy',
      claimKey: 'autonomy:5042002:arena-1:proof-signal-claimed-by-autonomy:volatility',
      signalId: 'proof-signal-claimed-by-autonomy',
      agentName: 'volatility',
      stakeMicroUsdc: 50000,
      chainId: 5_042_002,
      arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createdAt: '2026-05-20T09:00:00.000Z',
      runId: 'autonomy:2026-05-20T09:00:00.000Z/15m'
    });

    const smoke = await getProofSmokeView({
      store,
      env: parseServerEnv(process.env),
      now: '2026-05-20T12:00:00.000Z',
      controlRoom: createReadyControlRoom()
    });

    expect(smoke.commitPreconditions).toMatchObject({
      commitAvailable: true,
      eligibleSignalCount: 1
    });
  });

  it('POST /api/proof/smoke returns uncertain_reconcile_required without re-submitting the same tx', async () => {
    const commitSignalToArena = vi.fn();
    vi.doMock('@/lib/arc/commitSignal', () => ({
      commitSignalToArena
    }));

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-3',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal({ id: 'proof-signal-uncertain' })]
    });
    await store.acquireCommitClaim({
      scope: 'proof',
      claimKey: 'proof:5042002:arena-1:proof-signal-uncertain',
      signalId: 'proof-signal-uncertain',
      agentName: 'volatility',
      stakeMicroUsdc: 50000,
      chainId: 5_042_002,
      arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      createdAt: '2026-05-20T09:00:00.000Z'
    });
    await store.updateCommitClaim({
      scope: 'proof',
      claimKey: 'proof:5042002:arena-1:proof-signal-uncertain',
      status: 'uncertain',
      txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      reasonCode: 'receipt_pending',
      updatedAt: '2026-05-20T09:00:05.000Z'
    });
    setRuntimeStoreForTests(store);

    const { POST } = await import('@/app/api/proof/smoke/route');
    const response = await POST(
      new Request('http://localhost/api/proof/smoke', {
        method: 'POST',
        body: JSON.stringify({
          signalId: 'proof-signal-uncertain',
          confirmTx: true,
          proofSecret: 'judge-secret'
        }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toMatchObject({
      reason: 'uncertain_reconcile_required'
    });
    expect(commitSignalToArena).not.toHaveBeenCalled();
  });

  it('POST /api/proof/smoke marks receipt-wait failures as uncertain with tx hash', async () => {
    const txHash = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const receiptError = Object.assign(new Error('commit_receipt_unconfirmed'), { txHash });
    const commitSignalToArena = vi.fn().mockRejectedValue(receiptError);

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { parseServerEnv } = await import('@/lib/config/env');
    const { executeProofTransaction } = await import('@/lib/proof/service');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-receipt-fail',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [createSignal({ id: 'proof-signal-receipt-fail' })]
    });
    const result = await executeProofTransaction({
      store,
      env: parseServerEnv(process.env),
      now: '2026-05-20T12:00:00.000Z',
      signalId: 'proof-signal-receipt-fail',
      confirmTx: true,
      proofSecret: 'judge-secret',
      commitSignal: commitSignalToArena,
      controlRoom: {
        status: 'ready',
        reason: null,
        chainId: 5_042_002,
        arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        usdcAddress: '0x3600000000000000000000000000000000000000',
        usdcDecimals: 6,
        commitAvailable: true,
        latestTxHash: null,
        wallets: {
          volatility: {
            publicAddress: '0x1111111111111111111111111111111111111111',
            usdcBalanceMicroUsdc: '100000',
            allowanceMicroUsdc: '100000'
          },
          momentum: {
            publicAddress: '0x2222222222222222222222222222222222222222',
            usdcBalanceMicroUsdc: '100000',
            allowanceMicroUsdc: '100000'
          }
        }
      }
    });
    const ops = await store.getOperationsState();

    expect(result.httpStatus).toBe(409);
    expect(result.body).toMatchObject({
      reason: 'uncertain_reconcile_required',
      txHash
    });
    expect(ops.proof.claims[0]).toMatchObject({
      status: 'uncertain',
      txHash,
      reasonCode: 'commit_receipt_unconfirmed'
    });
  });

  it('POST /api/proof/smoke refuses ineligible and already committed signals', async () => {
    const commitSignalToArena = vi.fn();
    vi.doMock('@/lib/arc/commitSignal', () => ({
      commitSignalToArena
    }));

    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'proof-run-4',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        createSignal({
          id: 'proof-signal-ineligible',
          side: 'AVOID',
          confidence: 'LOW',
          edgeBps: 100,
          stakeMicroUsdc: 0
        }),
        createSignal({
          id: 'proof-signal-committed',
          status: 'committed',
          arcTxHash: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
        })
      ]
    });
    setRuntimeStoreForTests(store);

    const { POST } = await import('@/app/api/proof/smoke/route');
    const ineligible = await POST(
      new Request('http://localhost/api/proof/smoke', {
        method: 'POST',
        body: JSON.stringify({
          signalId: 'proof-signal-ineligible',
          confirmTx: true,
          proofSecret: 'judge-secret'
        }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const alreadyCommitted = await POST(
      new Request('http://localhost/api/proof/smoke', {
        method: 'POST',
        body: JSON.stringify({
          signalId: 'proof-signal-committed',
          confirmTx: true,
          proofSecret: 'judge-secret'
        }),
        headers: { 'content-type': 'application/json' }
      })
    );

    expect(ineligible.status).toBe(409);
    expect(await ineligible.json()).toMatchObject({ reason: 'signal_not_eligible' });
    expect(alreadyCommitted.status).toBe(409);
    expect(await alreadyCommitted.json()).toMatchObject({ reason: 'signal_already_committed' });
    expect(commitSignalToArena).not.toHaveBeenCalled();
  });
});
