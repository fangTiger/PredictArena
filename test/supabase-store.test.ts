import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseStore } from '@/lib/persistence/supabaseStore';
import type { ArenaState } from '@/lib/persistence/store';

const FALLBACK_PATH = '/tmp/predictarena-supabase-fallback.json';

const remoteState: ArenaState = {
  markets: [],
  lastRun: {
    runId: 'run-remote',
    source: 'demo_snapshot',
    generatedAt: '2026-05-20T00:00:00.000Z'
  },
  signals: [
    {
      id: 'remote-signal',
      runId: 'run-remote',
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
};

describe('Supabase persistence store', () => {
  beforeEach(async () => {
    await fs.rm(FALLBACK_PATH, { force: true });
    vi.unstubAllGlobals();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await fs.rm(FALLBACK_PATH, { force: true });
  });

  it('loads leaderboard and metrics from remote state before reading local fallback', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    fetchMock.mockImplementation(async (_input, init) => {
      if (init?.method === 'POST') {
        return new Response('{}', { status: 201 });
      }

      return new Response(JSON.stringify([{ payload: remoteState }]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const store = createSupabaseStore({
      url: 'https://supabase.example',
      serviceRoleKey: 'service-role-key',
      stateTable: 'arena_state'
    });

    const leaderboard = await store.getLeaderboard();
    const metrics = await store.getMetrics();

    expect(leaderboard).toMatchObject([
      {
        agentName: 'volatility',
        generatedSignals: 1,
        committedSignals: 1,
        totalBondedMicroUsdc: 50000
      }
    ]);
    expect(metrics).toEqual({
      generatedSignals: 1,
      committedSignals: 1,
      resolvedSignals: 0,
      openSignals: 1,
      averageEdgeBps: 2200,
      totalBondedMicroUsdc: 50000
    });
  });
});
