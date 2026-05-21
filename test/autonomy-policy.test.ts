import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { parseServerEnv } from '@/lib/config/env';
import { createLocalStore } from '@/lib/persistence/localStore';
import type { AgentSignal, ParsedCryptoMarket } from '@/lib/polymarket/types';

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    id: 'signal-1',
    runId: 'run-1',
    marketId: 'market-1',
    marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
    marketUrl: 'https://polymarket.com/event/market-1',
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 105000,
    expiresAt: '2026-05-30T23:59:00.000Z',
    agentName: 'volatility',
    modelVersion: 'volatility-gbm-v1',
    modelParams: { sigma: 0.7, recentReturn7d: 0.08 },
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

function createMarket(overrides: Partial<ParsedCryptoMarket> = {}): ParsedCryptoMarket {
  return {
    id: 'market-1',
    eventId: 'event-1',
    slug: 'market-1',
    question: 'Will BTC be above $105,000 on May 30, 2026?',
    source: 'demo_snapshot',
    endDate: '2026-05-30T23:59:00.000Z',
    yesPriceBps: 5400,
    noPriceBps: 4600,
    liquidity: 200000,
    volume: 10000,
    active: true,
    closed: false,
    clobTokenIds: ['1', '2'],
    url: 'https://polymarket.com/event/market-1',
    rawPayload: {},
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 105000,
    expiresAt: '2026-05-30T23:59:00.000Z',
    yesMeaning: 'YES means BTC closes above $105,000 at expiry.',
    parseConfidence: 0.92,
    scoutScoreBps: 7800,
    ...overrides
  };
}

describe('autonomy policy and runner', () => {
  it('parses CRON_SECRET and finite autonomy budgets from server env', async () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_APP_NAME: 'PredictArena',
      NEXT_PUBLIC_ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
      ALLOW_DEMO_SNAPSHOT: 'true',
      POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com/markets',
      ARC_CHAIN_ID: '5042002',
      ARC_RPC_URL: 'https://rpc.testnet.arc.network',
      ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
      ARC_USDC_DECIMALS: '6',
      CRON_SECRET: 'cron-secret',
      AUTONOMY_VOL_MODE: 'LIVE',
      AUTONOMY_VOL_MAX_DAILY_BOND_USDC6: '120000',
      AUTONOMY_VOL_MAX_SIGNALS_PER_DAY: '2',
      AUTONOMY_VOL_MAX_STAKE_USDC6: '60000',
      AUTONOMY_VOL_MAX_OPEN_SIGNALS: '1',
      AUTONOMY_VOL_MIN_EDGE_BPS: '950'
    });

    expect(env.cron.secret).toBe('cron-secret');
    expect(env.autonomy.policies.volatility).toMatchObject({
      mode: 'LIVE',
      maxDailyBondUsdc6: 120000,
      maxSignalsPerDay: 2,
      maxStakePerSignalUsdc6: 60000,
      maxOpenSignals: 1,
      minEdgeBps: 950
    });
    expect(env.autonomy.policies.momentum.maxDailyBondUsdc6).toBeGreaterThan(0);
  });

  it('blocks autonomy queue entries that exceed daily bond or open-signal policy budgets', async () => {
    const { evaluateAutonomyCandidate } = await import('@/lib/autonomy/policy');

    const decision = evaluateAutonomyCandidate(
      createSignal({ stakeMicroUsdc: 60000, edgeBps: 1400 }),
      {
        mode: 'LIVE',
        maxDailyBondUsdc6: 100000,
        maxSignalsPerDay: 3,
        maxStakePerSignalUsdc6: 60000,
        maxOpenSignals: 1,
        minEdgeBps: 900
      },
      {
        dailyBondUsedUsdc6: 50000,
        signalsUsedToday: 1,
        openSignals: 1
      }
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('max_open_signals_reached');
  });

  it('persists dry-run history and queue results without chain commits', async () => {
    const workdir = path.join(tmpdir(), `predictarena-autonomy-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });
    const store = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });
    const commitSignalToArena = vi.fn().mockResolvedValue({
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signalRecordId: 1
    });
    const { runAutonomousAgents } = await import('@/lib/autonomy/runAutonomousAgents');

    const result = await runAutonomousAgents(store, {
      now: '2026-05-20T12:00:00.000Z',
      env: parseServerEnv({
        NEXT_PUBLIC_APP_NAME: 'PredictArena',
        NEXT_PUBLIC_ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
        ALLOW_DEMO_SNAPSHOT: 'true',
        POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com/markets',
        ARC_CHAIN_ID: '5042002',
        ARC_RPC_URL: 'https://rpc.testnet.arc.network',
        ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
        ARC_USDC_DECIMALS: '6',
        CRON_SECRET: 'cron-secret',
        AUTONOMY_VOL_MODE: 'DRY_RUN',
        AUTONOMY_MOMENTUM_MODE: 'OFF'
      }),
      fetchCandidateMarkets: vi.fn().mockResolvedValue({
        source: 'demo_snapshot',
        fallbackReason: 'network down',
        markets: [createMarket()]
      }),
      fetchPriceSnapshots: vi.fn().mockResolvedValue(new Map()),
      runAgents: vi
        .fn()
        .mockReturnValue([
          createSignal(),
          createSignal({
            id: 'signal-2',
            agentName: 'momentum',
            modelVersion: 'momentum-gbm-v1'
          })
        ]),
      commitSignalToArena
    });

    expect(commitSignalToArena).not.toHaveBeenCalled();
    expect(result.run.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'signal-1',
          status: 'dry_run_eligible'
        }),
        expect.objectContaining({
          signalId: 'signal-2',
          status: 'mode_off'
        })
      ])
    );

    const state = await store.getArenaState();
    expect(state.autonomyRuns).toHaveLength(1);
    expect(state.autonomyRuns[0]?.queue[0]?.txHash ?? null).toBeNull();
  });

  it('blocks LIVE commits when the daily bond budget would be exceeded', async () => {
    const workdir = path.join(tmpdir(), `predictarena-autonomy-live-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });
    const store = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });
    await store.saveAgentRun({
      runId: 'existing-live-run',
      source: 'demo_snapshot',
      generatedAt: '2026-05-20T08:00:00.000Z',
      signals: [
        createSignal({
          id: 'existing-committed-signal',
          status: 'committed',
          arcTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
          stakeMicroUsdc: 50_000,
          createdAt: '2026-05-20T08:00:00.000Z',
          updatedAt: '2026-05-20T08:00:00.000Z'
        })
      ]
    });
    const commitSignalToArena = vi.fn().mockResolvedValue({
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signalRecordId: 2
    });
    const { runAutonomousAgents } = await import('@/lib/autonomy/runAutonomousAgents');

    const result = await runAutonomousAgents(store, {
      now: '2026-05-20T12:00:00.000Z',
      env: parseServerEnv({
        NEXT_PUBLIC_APP_NAME: 'PredictArena',
        NEXT_PUBLIC_ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
        ALLOW_DEMO_SNAPSHOT: 'true',
        POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com/markets',
        ARC_CHAIN_ID: '5042002',
        ARC_RPC_URL: 'https://rpc.testnet.arc.network',
        ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
        ARC_USDC_DECIMALS: '6',
        CRON_SECRET: 'cron-secret',
        AUTONOMY_VOL_MODE: 'LIVE',
        AUTONOMY_VOL_MAX_DAILY_BOND_USDC6: '50000',
        AUTONOMY_VOL_MAX_SIGNALS_PER_DAY: '3',
        AUTONOMY_VOL_MAX_STAKE_USDC6: '50000',
        AUTONOMY_VOL_MAX_OPEN_SIGNALS: '3',
        AUTONOMY_VOL_MIN_EDGE_BPS: '900',
        AUTONOMY_MOMENTUM_MODE: 'OFF'
      }),
      fetchCandidateMarkets: vi.fn().mockResolvedValue({
        source: 'demo_snapshot',
        fallbackReason: 'network down',
        markets: [createMarket()]
      }),
      fetchPriceSnapshots: vi.fn().mockResolvedValue(new Map()),
      runAgents: vi.fn().mockReturnValue([createSignal()]),
      commitSignalToArena
    });

    expect(commitSignalToArena).not.toHaveBeenCalled();
    expect(result.run.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'signal-1',
          status: 'policy_blocked',
          reason: 'max_daily_bond_reached'
        })
      ])
    );
  });

  it('counts a chain commit against LIVE budgets even when persistence fails afterward', async () => {
    const workdir = path.join(tmpdir(), `predictarena-autonomy-persist-fail-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });
    const localStore = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });
    const store = {
      ...localStore,
      markSignalCommitted: vi.fn().mockRejectedValue(new Error('supabase_save_500'))
    };
    const commitSignalToArena = vi
      .fn()
      .mockResolvedValueOnce({
        txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        signalRecordId: 2
      })
      .mockResolvedValueOnce({
        txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        signalRecordId: 3
      });
    const { runAutonomousAgents } = await import('@/lib/autonomy/runAutonomousAgents');

    const result = await runAutonomousAgents(store, {
      now: '2026-05-20T12:00:00.000Z',
      env: parseServerEnv({
        NEXT_PUBLIC_APP_NAME: 'PredictArena',
        NEXT_PUBLIC_ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
        ALLOW_DEMO_SNAPSHOT: 'true',
        POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com/markets',
        ARC_CHAIN_ID: '5042002',
        ARC_RPC_URL: 'https://rpc.testnet.arc.network',
        ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
        ARC_USDC_DECIMALS: '6',
        CRON_SECRET: 'cron-secret',
        AUTONOMY_VOL_MODE: 'LIVE',
        AUTONOMY_VOL_MAX_DAILY_BOND_USDC6: '100000',
        AUTONOMY_VOL_MAX_SIGNALS_PER_DAY: '1',
        AUTONOMY_VOL_MAX_STAKE_USDC6: '50000',
        AUTONOMY_VOL_MAX_OPEN_SIGNALS: '2',
        AUTONOMY_VOL_MIN_EDGE_BPS: '900',
        AUTONOMY_MOMENTUM_MODE: 'OFF'
      }),
      fetchCandidateMarkets: vi.fn().mockResolvedValue({
        source: 'demo_snapshot',
        fallbackReason: 'network down',
        markets: [createMarket()]
      }),
      fetchPriceSnapshots: vi.fn().mockResolvedValue(new Map()),
      runAgents: vi.fn().mockReturnValue([
        createSignal({ id: 'signal-1' }),
        createSignal({ id: 'signal-2' })
      ]),
      commitSignalToArena
    });

    expect(commitSignalToArena).toHaveBeenCalledTimes(1);
    expect(result.run.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'signal-1',
          status: 'commit_failed',
          reason: 'persist_committed_signal_failed:supabase_save_500',
          txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }),
        expect.objectContaining({
          signalId: 'signal-2',
          status: 'policy_blocked',
          reason: 'max_signals_per_day_reached'
        })
      ])
    );
    expect(result.run.budgetSnapshots?.[0]).toMatchObject({
      signalsUsedToday: 1,
      dailyBondUsedUsdc6: 50_000,
      openSignals: 1
    });
  });

  it('does not submit a duplicate LIVE commit after a prior tx became uncertain', async () => {
    const workdir = path.join(tmpdir(), `predictarena-autonomy-claim-block-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });
    const localStore = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });
    const failingStore = {
      ...localStore,
      markSignalCommitted: vi.fn().mockRejectedValue(new Error('supabase_save_500'))
    };
    const commitSignalToArena = vi.fn().mockResolvedValue({
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      signalRecordId: 2
    });
    const { runAutonomousAgents } = await import('@/lib/autonomy/runAutonomousAgents');
    const env = parseServerEnv({
      NEXT_PUBLIC_APP_NAME: 'PredictArena',
      NEXT_PUBLIC_ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
      ALLOW_DEMO_SNAPSHOT: 'true',
      POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com/markets',
      ARC_CHAIN_ID: '5042002',
      ARC_RPC_URL: 'https://rpc.testnet.arc.network',
      ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
      ARC_USDC_DECIMALS: '6',
      SIGNAL_BOND_ARENA_ADDRESS: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      CRON_SECRET: 'cron-secret',
      AUTONOMY_VOL_MODE: 'LIVE',
      AUTONOMY_VOL_MAX_DAILY_BOND_USDC6: '100000',
      AUTONOMY_VOL_MAX_SIGNALS_PER_DAY: '3',
      AUTONOMY_VOL_MAX_STAKE_USDC6: '50000',
      AUTONOMY_VOL_MAX_OPEN_SIGNALS: '3',
      AUTONOMY_VOL_MIN_EDGE_BPS: '900',
      AUTONOMY_MOMENTUM_MODE: 'OFF'
    });

    const first = await runAutonomousAgents(failingStore, {
      now: '2026-05-20T12:00:00.000Z',
      env,
      idempotencyKey: 'cron:2026-05-20T12:00:00.000Z/15m',
      scheduleWindowId: '2026-05-20T12:00:00.000Z/15m',
      fetchCandidateMarkets: vi.fn().mockResolvedValue({
        source: 'demo_snapshot',
        fallbackReason: 'network down',
        markets: [createMarket()]
      }),
      fetchPriceSnapshots: vi.fn().mockResolvedValue(new Map()),
      runAgents: vi.fn().mockReturnValue([createSignal()]),
      commitSignalToArena
    });
    const second = await runAutonomousAgents(localStore, {
      now: '2026-05-20T12:20:00.000Z',
      env,
      idempotencyKey: 'cron:2026-05-20T12:15:00.000Z/15m',
      scheduleWindowId: '2026-05-20T12:15:00.000Z/15m',
      fetchCandidateMarkets: vi.fn().mockResolvedValue({
        source: 'demo_snapshot',
        fallbackReason: 'network down',
        markets: [createMarket()]
      }),
      fetchPriceSnapshots: vi.fn().mockResolvedValue(new Map()),
      runAgents: vi.fn().mockReturnValue([createSignal()]),
      commitSignalToArena
    });

    expect(first.run.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'signal-1',
          status: 'commit_failed',
          reason: 'persist_committed_signal_failed:supabase_save_500'
        })
      ])
    );
    expect(second.run.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'signal-1',
          status: 'claim_blocked',
          reason: 'claim_uncertain_reconcile_required'
        })
      ])
    );
    expect(commitSignalToArena).toHaveBeenCalledTimes(1);
  });

  it('marks receipt-wait failures as uncertain instead of retryable failed claims', async () => {
    const workdir = path.join(tmpdir(), `predictarena-autonomy-receipt-fail-${randomUUID()}`);
    await fs.mkdir(workdir, { recursive: true });
    const store = createLocalStore({
      storagePath: path.join(workdir, 'predictarena-store.json')
    });
    const txHash = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
    const commitSignalToArena = vi
      .fn()
      .mockRejectedValue(Object.assign(new Error('commit_receipt_unconfirmed'), { txHash }));
    const { runAutonomousAgents } = await import('@/lib/autonomy/runAutonomousAgents');
    const env = parseServerEnv({
      NEXT_PUBLIC_APP_NAME: 'PredictArena',
      NEXT_PUBLIC_ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
      ALLOW_DEMO_SNAPSHOT: 'true',
      POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com/markets',
      ARC_CHAIN_ID: '5042002',
      ARC_RPC_URL: 'https://rpc.testnet.arc.network',
      ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
      ARC_USDC_DECIMALS: '6',
      SIGNAL_BOND_ARENA_ADDRESS: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      CRON_SECRET: 'cron-secret',
      AUTONOMY_VOL_MODE: 'LIVE',
      AUTONOMY_VOL_MAX_DAILY_BOND_USDC6: '100000',
      AUTONOMY_VOL_MAX_SIGNALS_PER_DAY: '3',
      AUTONOMY_VOL_MAX_STAKE_USDC6: '50000',
      AUTONOMY_VOL_MAX_OPEN_SIGNALS: '3',
      AUTONOMY_VOL_MIN_EDGE_BPS: '900',
      AUTONOMY_MOMENTUM_MODE: 'OFF'
    });

    const result = await runAutonomousAgents(store, {
      now: '2026-05-20T12:00:00.000Z',
      env,
      fetchCandidateMarkets: vi.fn().mockResolvedValue({
        source: 'demo_snapshot',
        fallbackReason: 'network down',
        markets: [createMarket()]
      }),
      fetchPriceSnapshots: vi.fn().mockResolvedValue(new Map()),
      runAgents: vi.fn().mockReturnValue([createSignal()]),
      commitSignalToArena
    });
    const ops = await store.getOperationsState();

    expect(result.run.queue).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          signalId: 'signal-1',
          status: 'commit_failed',
          reason: 'commit_receipt_unconfirmed',
          txHash
        })
      ])
    );
    expect(ops.autonomous.claims[0]).toMatchObject({
      status: 'uncertain',
      txHash,
      reasonCode: 'commit_receipt_unconfirmed'
    });
  });
});
