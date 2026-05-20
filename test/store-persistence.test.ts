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
});
