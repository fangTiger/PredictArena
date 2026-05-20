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
});
