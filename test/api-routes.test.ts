import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function createTempStorePath() {
  const dir = path.join(tmpdir(), `predictarena-api-${randomUUID()}`);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, 'predictarena-store.json');
}

describe('PredictArena API routes', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.stubEnv('ALLOW_DEMO_SNAPSHOT', 'true');
    vi.stubEnv('PREDICTARENA_LOCAL_STORE_PATH', await createTempStorePath());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('GET /api/markets falls back to snapshot candidates when live fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('network down')));
    const { GET } = await import('@/app/api/markets/route');

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.source).toBe('demo_snapshot');
    expect(payload.markets.length).toBeGreaterThan(0);
  });

  it('POST /api/run-agents produces at least two signals and does not expose secrets', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('network down')));
    const { POST } = await import('@/app/api/run-agents/route');

    const response = await POST(
      new Request('http://localhost/api/run-agents', {
        method: 'POST',
        body: JSON.stringify({ limit: 2 }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.signals.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(payload)).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(JSON.stringify(payload)).not.toContain('PRIVATE_KEY');
  });

  it('POST /api/run-agents returns controlled invalid_request for invalid bodies', async () => {
    const { POST } = await import('@/app/api/run-agents/route');

    const response = await POST(
      new Request('http://localhost/api/run-agents', {
        method: 'POST',
        body: JSON.stringify({ limit: 0 }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe('invalid_request');
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['limit']
        })
      ])
    );
  });

  it('POST /api/commit-signal returns controlled invalid_request for invalid bodies', async () => {
    const { POST } = await import('@/app/api/commit-signal/route');

    const response = await POST(
      new Request('http://localhost/api/commit-signal', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe('invalid_request');
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['signalId']
        })
      ])
    );
  });

  it('POST /api/commit-signal rejects AVOID signals and missing config with machine-readable reasons', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-avoid',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        {
          id: 'avoid-signal',
          runId: 'run-avoid',
          marketId: 'demo-btc',
          marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
          marketUrl: null,
          asset: 'BTC',
          conditionType: 'EXPIRY_ABOVE',
          thresholdUsd: 105000,
          expiresAt: '2026-05-30T23:59:00.000Z',
          agentName: 'volatility',
          modelVersion: 'volatility-gbm-v1',
          modelParams: { sigma: 0.7 },
          modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          side: 'AVOID',
          status: 'generated',
          confidence: 'LOW',
          confidenceBps: 5200,
          marketPriceBps: 5100,
          agentProbabilityBps: 5200,
          yesPriceBps: 5100,
          pYesBps: 5200,
          edgeBps: 100,
          kellyBps: 0,
          stakeMicroUsdc: 0,
          riskFlags: ['edge_below_threshold'],
          arcTxHash: null,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
          source: 'demo_snapshot',
          resolution: null
        }
      ]
    });
    setRuntimeStoreForTests(store);
    const { POST } = await import('@/app/api/commit-signal/route');

    const response = await POST(
      new Request('http://localhost/api/commit-signal', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'avoid-signal' }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.reason).toBe('signal_not_eligible');
  });

  it('POST /api/commit-signal disables the unauthenticated server-wallet spend path', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-public-commit',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        {
          id: 'eligible-public-commit',
          runId: 'run-public-commit',
          marketId: 'demo-btc-live',
          marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
          marketUrl: null,
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
          resolution: null
        }
      ]
    });
    setRuntimeStoreForTests(store);
    const { POST } = await import('@/app/api/commit-signal/route');

    const response = await POST(
      new Request('http://localhost/api/commit-signal', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'eligible-public-commit' }),
        headers: { 'content-type': 'application/json' }
      })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ reason: 'public_commit_disabled' });
  });

  it('POST /api/resolve-demo rejects missing or invalid admin tokens and does not require ADMIN_PRIVATE_KEY', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-resolve',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        {
          id: 'resolve-signal',
          runId: 'run-resolve',
          marketId: 'demo-btc',
          marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
          marketUrl: null,
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
          status: 'committed',
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
          arcTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
          source: 'demo_snapshot',
          resolution: null
        }
      ]
    });
    setRuntimeStoreForTests(store);
    vi.stubEnv('ADMIN_RESOLVE_TOKEN', 'demo-token');
    vi.stubEnv('ADMIN_PRIVATE_KEY', '');
    const { POST } = await import('@/app/api/resolve-demo/route');

    const missingTokenResponse = await POST(
      new Request('http://localhost/api/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'resolve-signal', outcomeCorrect: true }),
        headers: { 'content-type': 'application/json' }
      })
    );
    const invalidTokenResponse = await POST(
      new Request('http://localhost/api/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'resolve-signal', outcomeCorrect: true }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'wrong-token'
        }
      })
    );
    const okResponse = await POST(
      new Request('http://localhost/api/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'resolve-signal', outcomeCorrect: true }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'demo-token'
        }
      })
    );

    expect(missingTokenResponse.status).toBe(401);
    expect(invalidTokenResponse.status).toBe(403);
    expect(okResponse.status).toBe(200);
    expect(await okResponse.json()).toMatchObject({
      signal: {
        resolution: {
          source: 'demo_admin'
        }
      }
    });
  });

  it('POST /api/resolve-demo returns controlled invalid_request after admin token succeeds', async () => {
    vi.stubEnv('ADMIN_RESOLVE_TOKEN', 'demo-token');
    const { POST } = await import('@/app/api/resolve-demo/route');

    const response = await POST(
      new Request('http://localhost/api/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'resolve-signal' }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'demo-token'
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe('invalid_request');
    expect(payload.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['outcomeCorrect']
        })
      ])
    );
  });

  it('POST /api/resolve-signals automatically resolves expired committed signals and updates leaderboard scoring', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-auto-resolve',
      source: 'demo_snapshot',
      generatedAt: '2026-05-18T00:00:00.000Z',
      signals: [
        {
          id: 'auto-resolve-signal',
          runId: 'run-auto-resolve',
          marketId: 'demo-btc-auto',
          marketQuestion: 'Will BTC be above $100,000 on May 19, 2026?',
          marketUrl: null,
          asset: 'BTC',
          conditionType: 'EXPIRY_ABOVE',
          thresholdUsd: 100000,
          expiresAt: '2026-05-19T00:00:00.000Z',
          agentName: 'volatility',
          modelVersion: 'volatility-gbm-v1',
          modelParams: { sigma: 0.7 },
          modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          side: 'YES',
          status: 'committed',
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
          arcTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
          source: 'demo_snapshot',
          resolution: null
        }
      ]
    });
    setRuntimeStoreForTests(store);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json([
          [1_779_062_400, 98_000, 99_000, 98_500, 98_900, 100],
          [1_779_148_800, 100_000, 102_000, 100_500, 101_200, 100]
        ])
      )
    );
    const { POST } = await import('@/app/api/resolve-signals/route');

    const response = await POST(
      new Request('http://localhost/api/resolve-signals', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();
    const leaderboard = await store.getLeaderboard();

    expect(response.status).toBe(200);
    expect(payload.resolved).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'auto-resolve-signal',
          yesOutcome: true,
          outcomeCorrect: true
        })
      ])
    );
    expect(leaderboard[0]).toMatchObject({
      resolvedSignals: 1,
      accuracyBps: 10000,
      brierScoreBps: 576,
      refundedMicroUsdc: 50000,
      slashedMicroUsdc: 0
    });
  });

  it('POST /api/resolve-signals does not trigger onchain owner resolution without admin token', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-auto-no-admin',
      source: 'demo_snapshot',
      generatedAt: '2026-05-18T00:00:00.000Z',
      signals: [
        {
          id: 'auto-no-admin-signal',
          runId: 'run-auto-no-admin',
          marketId: 'demo-btc-auto-admin',
          marketQuestion: 'Will BTC be above $100,000 on May 19, 2026?',
          marketUrl: null,
          asset: 'BTC',
          conditionType: 'EXPIRY_ABOVE',
          thresholdUsd: 100000,
          expiresAt: '2026-05-19T00:00:00.000Z',
          agentName: 'volatility',
          modelVersion: 'volatility-gbm-v1',
          modelParams: { sigma: 0.7 },
          modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          side: 'YES',
          status: 'committed',
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
          arcTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          arcSignalRecordId: 7,
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
          source: 'demo_snapshot',
          resolution: null
        }
      ]
    });
    setRuntimeStoreForTests(store);
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    vi.stubEnv('ADMIN_PRIVATE_KEY', '0x1111111111111111111111111111111111111111111111111111111111111111');
    vi.stubEnv('ADMIN_RESOLVE_TOKEN', 'demo-token');
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        Response.json([
          [1_779_062_400, 98_000, 99_000, 98_500, 98_900, 100],
          [1_779_148_800, 100_000, 102_000, 100_500, 101_200, 100]
        ])
      )
    );
    const { POST } = await import('@/app/api/resolve-signals/route');

    const response = await POST(
      new Request('http://localhost/api/resolve-signals', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.onchain).toMatchObject({
      status: 'skipped_admin_token',
      txHash: null
    });
    expect(payload.resolved).toHaveLength(1);
  });

  it('POST /api/resolve-signals returns controlled invalid_request for malformed JSON', async () => {
    const { POST } = await import('@/app/api/resolve-signals/route');

    const response = await POST(
      new Request('http://localhost/api/resolve-signals', {
        method: 'POST',
        body: '{',
        headers: { 'content-type': 'application/json' }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.reason).toBe('invalid_request');
  });

  it('POST /api/admin/resolve-demo is token protected and records demo-only resolution metadata', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-admin-resolve',
      source: 'demo_snapshot',
      generatedAt: '2026-05-18T00:00:00.000Z',
      signals: [
        {
          id: 'admin-resolve-signal',
          runId: 'run-admin-resolve',
          marketId: 'demo-btc-admin',
          marketQuestion: 'Will BTC be above $100,000 on May 19, 2026?',
          marketUrl: null,
          asset: 'BTC',
          conditionType: 'EXPIRY_ABOVE',
          thresholdUsd: 100000,
          expiresAt: '2026-05-19T00:00:00.000Z',
          agentName: 'momentum',
          modelVersion: 'momentum-gbm-v1',
          modelParams: { sigma: 0.7 },
          modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          side: 'NO',
          status: 'committed',
          confidence: 'HIGH',
          confidenceBps: 7600,
          marketPriceBps: 4600,
          agentProbabilityBps: 7600,
          yesPriceBps: 5400,
          pYesBps: 2400,
          edgeBps: 2200,
          kellyBps: 300,
          stakeMicroUsdc: 50000,
          riskFlags: [],
          arcTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          createdAt: '2026-05-18T00:00:00.000Z',
          updatedAt: '2026-05-18T00:00:00.000Z',
          source: 'demo_snapshot',
          resolution: null
        }
      ]
    });
    setRuntimeStoreForTests(store);
    vi.stubEnv('ADMIN_RESOLVE_TOKEN', 'demo-token');
    const { POST } = await import('@/app/api/admin/resolve-demo/route');

    const invalidTokenResponse = await POST(
      new Request('http://localhost/api/admin/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'admin-resolve-signal', outcomeCorrect: true }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'wrong-token'
        }
      })
    );
    const okResponse = await POST(
      new Request('http://localhost/api/admin/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'admin-resolve-signal', outcomeCorrect: true }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'demo-token'
        }
      })
    );
    const payload = await okResponse.json();

    expect(invalidTokenResponse.status).toBe(403);
    expect(okResponse.status).toBe(200);
    expect(payload.signal.resolution).toMatchObject({
      outcomeCorrect: true,
      yesOutcome: false,
      source: 'demo_admin'
    });
  });

  it('demo resolve rejects uncommitted, already resolved, and malformed requests with controlled reasons', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    const baseSignal = {
      id: 'demo-guard-signal',
      runId: 'run-demo-guard',
      marketId: 'demo-btc-guard',
      marketQuestion: 'Will BTC be above $100,000 on May 19, 2026?',
      marketUrl: null,
      asset: 'BTC' as const,
      conditionType: 'EXPIRY_ABOVE' as const,
      thresholdUsd: 100000,
      expiresAt: '2026-05-19T00:00:00.000Z',
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
      createdAt: '2026-05-18T00:00:00.000Z',
      updatedAt: '2026-05-18T00:00:00.000Z',
      source: 'demo_snapshot' as const,
      resolution: null
    };

    await store.saveAgentRun({
      runId: 'run-demo-guard',
      source: 'demo_snapshot',
      generatedAt: '2026-05-18T00:00:00.000Z',
      signals: [baseSignal]
    });
    setRuntimeStoreForTests(store);
    vi.stubEnv('ADMIN_RESOLVE_TOKEN', 'demo-token');
    const { POST } = await import('@/app/api/admin/resolve-demo/route');

    const uncommittedResponse = await POST(
      new Request('http://localhost/api/admin/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'demo-guard-signal', outcomeCorrect: true }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'demo-token'
        }
      })
    );
    await store.saveAgentRun({
      runId: 'run-demo-guard',
      source: 'demo_snapshot',
      generatedAt: '2026-05-18T00:00:00.000Z',
      signals: [
        {
          ...baseSignal,
          status: 'committed',
          arcTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }
      ]
    });
    const okResponse = await POST(
      new Request('http://localhost/api/admin/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'demo-guard-signal', outcomeCorrect: true }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'demo-token'
        }
      })
    );
    const duplicateResponse = await POST(
      new Request('http://localhost/api/admin/resolve-demo', {
        method: 'POST',
        body: JSON.stringify({ signalId: 'demo-guard-signal', outcomeCorrect: true }),
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'demo-token'
        }
      })
    );
    const malformedResponse = await POST(
      new Request('http://localhost/api/admin/resolve-demo', {
        method: 'POST',
        body: '{',
        headers: {
          'content-type': 'application/json',
          'x-admin-resolve-token': 'demo-token'
        }
      })
    );

    expect(uncommittedResponse.status).toBe(409);
    expect(await uncommittedResponse.json()).toMatchObject({ reason: 'signal_not_committed' });
    expect(okResponse.status).toBe(200);
    expect(duplicateResponse.status).toBe(409);
    expect(await duplicateResponse.json()).toMatchObject({ reason: 'signal_already_resolved' });
    expect(malformedResponse.status).toBe(400);
    expect(await malformedResponse.json()).toMatchObject({ reason: 'invalid_request' });
  });

  it('GET /api/cron/run-autonomous-agents requires CRON_SECRET and persists dry-run run history', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    vi.stubEnv('AUTONOMY_VOL_MODE', 'DRY_RUN');
    vi.stubEnv('AUTONOMY_MOMENTUM_MODE', 'OFF');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('network down')));
    const { GET } = await import('@/app/api/cron/run-autonomous-agents/route');

    const missingResponse = await GET(
      new Request('http://localhost/api/cron/run-autonomous-agents', {
        method: 'GET'
      })
    );
    const okResponse = await GET(
      new Request('http://localhost/api/cron/run-autonomous-agents', {
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret'
        }
      })
    );
    const payload = await okResponse.json();
    const { getRuntimeStore } = await import('@/lib/persistence/store');
    const state = await getRuntimeStore().getArenaState();

    expect(missingResponse.status).toBe(401);
    expect(await missingResponse.json()).toMatchObject({ reason: 'missing_cron_authorization' });
    expect(okResponse.status).toBe(200);
    expect(payload.run.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'dry_run_eligible'
        })
      ])
    );
    expect(state.autonomyRuns).toHaveLength(1);
    expect(JSON.stringify(payload)).not.toContain('cron-secret');
  });

  it('POST /api/cron/run-autonomous-agents also requires Bearer CRON_SECRET', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    vi.stubEnv('AUTONOMY_VOL_MODE', 'DRY_RUN');
    vi.stubEnv('AUTONOMY_MOMENTUM_MODE', 'OFF');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('network down')));
    const { POST } = await import('@/app/api/cron/run-autonomous-agents/route');

    const invalidResponse = await POST(
      new Request('http://localhost/api/cron/run-autonomous-agents', {
        method: 'POST',
        headers: {
          authorization: 'Bearer wrong-secret'
        }
      })
    );
    const okResponse = await POST(
      new Request('http://localhost/api/cron/run-autonomous-agents', {
        method: 'POST',
        headers: {
          authorization: 'Bearer cron-secret'
        }
      })
    );

    expect(invalidResponse.status).toBe(403);
    expect(await invalidResponse.json()).toMatchObject({ reason: 'invalid_cron_authorization' });
    expect(okResponse.status).toBe(200);
  });

  it('GET /api/cron/run-autonomous-agents returns duplicate state for the same UTC schedule window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-20T12:03:00.000Z'));
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    vi.stubEnv('AUTONOMY_VOL_MODE', 'DRY_RUN');
    vi.stubEnv('AUTONOMY_MOMENTUM_MODE', 'OFF');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('network down')));
    const { GET } = await import('@/app/api/cron/run-autonomous-agents/route');

    const firstResponse = await GET(
      new Request('http://localhost/api/cron/run-autonomous-agents', {
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret'
        }
      })
    );
    const secondResponse = await GET(
      new Request('http://localhost/api/cron/run-autonomous-agents', {
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret'
        }
      })
    );
    const secondPayload = await secondResponse.json();
    const { getRuntimeStore } = await import('@/lib/persistence/store');
    const state = await getRuntimeStore().getArenaState();

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(secondPayload).toMatchObject({
      status: 'duplicate'
    });
    expect(state.autonomyRuns).toHaveLength(1);
    vi.useRealTimers();
  });

  it('GET /api/autonomy returns public policy, run history, and control-room data without secrets', async () => {
    vi.stubEnv('CRON_SECRET', 'cron-secret');
    vi.stubEnv('AUTONOMY_VOL_MODE', 'DRY_RUN');
    vi.stubEnv('AUTONOMY_MOMENTUM_MODE', 'OFF');
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(new Error('network down')));
    const { GET: runCron } = await import('@/app/api/cron/run-autonomous-agents/route');
    await runCron(
      new Request('http://localhost/api/cron/run-autonomous-agents', {
        method: 'GET',
        headers: {
          authorization: 'Bearer cron-secret'
        }
      })
    );

    const { GET } = await import('@/app/api/autonomy/route');
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.policies.volatility.mode).toBe('DRY_RUN');
    expect(payload.runs).toHaveLength(1);
    expect(payload.controlRoom).toMatchObject({
      status: expect.any(String),
      commitAvailable: expect.any(Boolean)
    });
    expect(JSON.stringify(payload)).not.toContain('cron-secret');
    expect(JSON.stringify(payload)).not.toContain('idempotencyKey');
    expect(JSON.stringify(payload)).not.toContain('scheduleWindowId');
  });

  it('GET /api/arc/readiness and POST /api/arc/sync-leaderboard degrade safely when chain config is missing', async () => {
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', '');
    const { GET } = await import('@/app/api/arc/readiness/route');
    const { POST } = await import('@/app/api/arc/sync-leaderboard/route');

    const readinessResponse = await GET();
    const syncResponse = await POST(
      new Request('http://localhost/api/arc/sync-leaderboard', {
        method: 'POST'
      })
    );
    const readinessPayload = await readinessResponse.json();
    const syncPayload = await syncResponse.json();

    expect(readinessResponse.status).toBe(200);
    expect(readinessPayload.commitAvailable).toBe(false);
    expect(readinessPayload.status).toBe('degraded');
    expect(syncResponse.status).toBe(200);
    expect(syncPayload.status).toBe('degraded');
  });

  it('syncArcLeaderboard reads onchain getter state and updates local resolved leaderboard state', async () => {
    const { createLocalStore } = await import('@/lib/persistence/localStore');
    const { syncArcLeaderboard } = await import('@/lib/arc/syncLeaderboard');
    const store = createLocalStore({ storagePath: process.env.PREDICTARENA_LOCAL_STORE_PATH! });

    await store.saveAgentRun({
      runId: 'run-sync-chain',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T00:00:00.000Z',
      signals: [
        {
          id: 'sync-chain-signal',
          runId: 'run-sync-chain',
          marketId: 'demo-btc-sync-chain',
          marketQuestion: 'Will BTC be above $100,000 on May 21, 2026?',
          marketUrl: null,
          asset: 'BTC',
          conditionType: 'EXPIRY_ABOVE',
          thresholdUsd: 100000,
          expiresAt: '2026-05-21T00:00:00.000Z',
          agentName: 'volatility',
          modelVersion: 'volatility-gbm-v1',
          modelParams: { sigma: 0.7 },
          modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          side: 'YES',
          status: 'committed',
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
          arcTxHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          arcSignalRecordId: 7,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
          source: 'demo_snapshot',
          resolution: null
        }
      ]
    });

    const { parseServerEnv } = await import('@/lib/config/env');
    const env = parseServerEnv(process.env);
    const result = await syncArcLeaderboard({
      env: {
        ...env,
        arc: {
          ...env.arc,
          signalBondArenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }
      },
      store,
      publicClient: {
        getChainId: vi.fn().mockResolvedValue(5_042_002),
        readContract: vi.fn().mockResolvedValue({
          resolved: true,
          outcomeCorrect: true
        })
      }
    });
    const leaderboard = await store.getLeaderboard();

    expect(result).toMatchObject({
      status: 'ready',
      reason: null,
      scannedSignals: 1,
      updatedSignals: 1
    });
    expect(leaderboard[0]).toMatchObject({
      resolvedSignals: 1,
      refundedMicroUsdc: 50000,
      slashedMicroUsdc: 0
    });
  });
});
