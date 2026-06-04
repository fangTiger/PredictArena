import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ArcControlRoomState } from '@/lib/arc/controlRoom';
import type { ServerEnvConfig } from '@/lib/config/env';
import type { AutonomousRunReceiptView } from '@/lib/insights/readModels';
import type { OperatorHealthView } from '@/lib/ops/operatorHealth';
import type { ArenaState } from '@/lib/persistence/store';

const mockState = vi.hoisted(() => ({
  controlRoom: null as ArcControlRoomState | null,
  env: null as ServerEnvConfig | null,
  arenaState: null as ArenaState | null,
  receipts: {} as Record<string, AutonomousRunReceiptView>,
  healthView: null as OperatorHealthView | null
}));

vi.mock('@/lib/arc/controlRoom', () => ({
  getArcControlRoomState: vi.fn(async () => {
    if (!mockState.controlRoom) {
      throw new Error('control room mock not configured');
    }

    return mockState.controlRoom;
  })
}));

vi.mock('@/lib/config/env', () => ({
  getServerEnv: vi.fn(() => {
    if (!mockState.env) {
      throw new Error('env mock not configured');
    }

    return mockState.env;
  })
}));

vi.mock('@/lib/persistence/store', () => ({
  getRuntimeStore: vi.fn(() => ({
    getArenaState: vi.fn(async () => {
      if (!mockState.arenaState) {
        throw new Error('arena state mock not configured');
      }

      return mockState.arenaState;
    })
  }))
}));

vi.mock('@/lib/insights/readModels', () => ({
  buildAutonomousRunReceipt: vi.fn((_state: ArenaState, runId: string) => mockState.receipts[runId] ?? null)
}));

vi.mock('@/lib/ops/operatorHealth', () => ({
  buildOperatorHealthView: vi.fn(() => {
    if (!mockState.healthView) {
      throw new Error('health view mock not configured');
    }

    return mockState.healthView;
  })
}));

vi.mock('@/components/TxLink', () => ({
  TxLink: ({ hash }: { hash: `0x${string}` | null }) =>
    React.createElement('span', null, hash ?? 'Pending')
}));

import AdminControlRoomPage from '@/app/admin/control-room/page';
import AdminReceiptsPage from '@/app/admin/receipts/page';
import AdminHealthPage from '@/app/admin/health/page';

function createEnv(): ServerEnvConfig {
  return {
    appName: 'PredictArena',
    appUrl: 'https://predictarena.example',
    allowDemoSnapshot: true,
    localStorePath: null,
    supabaseStateTable: 'predictarena_state',
    polymarketGammaUrl: 'https://gamma-api.polymarket.com/markets',
    arc: {
      chainId: 5_042_002,
      rpcUrl: 'https://rpc.arc.example',
      usdcAddress: '0x3600000000000000000000000000000000000000',
      usdcDecimals: 6,
      signalBondArenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      treasuryAddress: '0x9999999999999999999999999999999999999999',
      explorerUrl: 'https://arcscan.example'
    },
    supabase: null,
    agentKeys: {
      volatility: '0x1111111111111111111111111111111111111111111111111111111111111111',
      momentum: '0x2222222222222222222222222222222222222222222222222222222222222222'
    },
    admin: {
      privateKey: '0x3333333333333333333333333333333333333333333333333333333333333333',
      resolveToken: 'resolve-token-never-render'
    },
    cron: {
      secret: 'cron-secret-never-render'
    },
    proof: {
      secret: 'proof-secret-never-render',
      maxStakePerSignalUsdc6: 50_000_000,
      maxDailySpendUsdc6: 250_000_000,
      maxTransactionsPerDay: 4
    },
    autonomy: {
      policies: {
        volatility: {
          mode: 'LIVE',
          maxDailyBondUsdc6: 150_000_000,
          maxSignalsPerDay: 4,
          maxStakePerSignalUsdc6: 50_000_000,
          maxOpenSignals: 3,
          minEdgeBps: 900
        },
        momentum: {
          mode: 'DRY_RUN',
          maxDailyBondUsdc6: 150_000_000,
          maxSignalsPerDay: 4,
          maxStakePerSignalUsdc6: 50_000_000,
          maxOpenSignals: 3,
          minEdgeBps: 900
        }
      }
    }
  };
}

function createArenaState(): ArenaState {
  return {
    markets: [],
    signals: [],
    autonomyRuns: [
      {
        runId: 'run-latest',
        status: 'failed',
        source: 'live',
        triggeredAt: '2026-06-05T10:00:00.000Z',
        completedAt: '2026-06-05T10:03:00.000Z',
        marketCount: 5,
        generatedSignalCount: 8,
        modeByAgent: {
          volatility: 'LIVE',
          momentum: 'DRY_RUN'
        },
        queue: [],
        committedCount: 2,
        dryRunCount: 1,
        skippedCount: 1,
        budgetSnapshots: [],
        failureReasonCode: 'autonomous_run_locked'
      },
      {
        runId: 'run-older',
        status: 'completed',
        source: 'demo_snapshot',
        triggeredAt: '2026-06-04T08:00:00.000Z',
        completedAt: '2026-06-04T08:02:00.000Z',
        marketCount: 2,
        generatedSignalCount: 3,
        modeByAgent: {
          volatility: 'DRY_RUN',
          momentum: 'OFF'
        },
        queue: [],
        committedCount: 0,
        dryRunCount: 2,
        skippedCount: 1,
        budgetSnapshots: [],
        failureReasonCode: null
      }
    ],
    ops: {
      autonomous: {
        lock: {
          scope: 'autonomy',
          token: 'lock-token-never-render',
          key: 'cron:10:00',
          owner: 'secret-lock-owner',
          runId: 'run-latest',
          acquiredAt: '2026-06-05T10:00:00.000Z',
          expiresAt: '2026-06-05T10:05:00.000Z'
        },
        claims: [],
        lastFailure: {
          runId: 'run-latest',
          reasonCode: 'autonomous_run_locked',
          rawDiagnostic: 'rpc timeout https://rpc.internal.example',
          occurredAt: '2026-06-05T10:03:00.000Z'
        }
      },
      proof: {
        lock: null,
        claims: []
      }
    }
  };
}

function createControlRoomState(): ArcControlRoomState {
  return {
    status: 'ready',
    reason: null,
    chainId: 5_042_002,
    arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    usdcAddress: '0x3600000000000000000000000000000000000000',
    usdcDecimals: 6,
    commitAvailable: true,
    latestTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    wallets: {
      volatility: {
        publicAddress: '0x4444444444444444444444444444444444444444',
        usdcBalanceMicroUsdc: '125000000',
        allowanceMicroUsdc: '50000000'
      },
      momentum: {
        publicAddress: '0x5555555555555555555555555555555555555555',
        usdcBalanceMicroUsdc: '80000000',
        allowanceMicroUsdc: '25000000'
      }
    }
  };
}

function createReceipts(): Record<string, AutonomousRunReceiptView> {
  return {
    'run-latest': {
      runId: 'run-latest',
      source: 'live',
      triggeredAt: '2026-06-05T10:00:00.000Z',
      completedAt: '2026-06-05T10:03:00.000Z',
      marketCount: 5,
      generatedSignalCount: 8,
      modeByAgent: {
        volatility: 'LIVE',
        momentum: 'DRY_RUN'
      },
      committedCount: 2,
      dryRunCount: 1,
      skippedCount: 1,
      budgetSnapshots: [
        {
          agentName: 'volatility',
          mode: 'LIVE',
          dailyBondUsedUsdc6: 100_000_000,
          signalsUsedToday: 2,
          openSignals: 1,
          policy: {
            mode: 'LIVE',
            maxDailyBondUsdc6: 150_000_000,
            maxSignalsPerDay: 4,
            maxStakePerSignalUsdc6: 50_000_000,
            maxOpenSignals: 3,
            minEdgeBps: 900
          }
        }
      ],
      queue: [
        {
          signalId: 'sig-1',
          agentName: 'volatility',
          status: 'committed',
          reason: null,
          txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
          marketQuestion: 'Will BTC close above $110,000 on June 30, 2026?',
          marketId: 'btc-1',
          side: 'YES',
          signalStatus: 'committed',
          confidence: 'HIGH',
          edgeBps: 1500,
          stakeMicroUsdc: 50_000_000,
          modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
          dataHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        },
        {
          signalId: 'sig-2',
          agentName: 'momentum',
          status: 'dry_run_eligible',
          reason: 'mode_off',
          txHash: null,
          marketQuestion: 'Will ETH close above $5,000 on July 7, 2026?',
          marketId: 'eth-1',
          side: 'NO',
          signalStatus: 'generated',
          confidence: 'MEDIUM',
          edgeBps: 900,
          stakeMicroUsdc: 25_000_000,
          modelHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
          dataHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        }
      ]
    },
    'run-older': {
      runId: 'run-older',
      source: 'demo_snapshot',
      triggeredAt: '2026-06-04T08:00:00.000Z',
      completedAt: '2026-06-04T08:02:00.000Z',
      marketCount: 2,
      generatedSignalCount: 3,
      modeByAgent: {
        volatility: 'DRY_RUN',
        momentum: 'OFF'
      },
      committedCount: 0,
      dryRunCount: 2,
      skippedCount: 1,
      budgetSnapshots: [],
      queue: []
    }
  };
}

function createHealthView(): OperatorHealthView {
  return {
    generatedAt: '2026-06-05T10:05:00.000Z',
    persistenceMode: 'local_atomic',
    latestRun: {
      runId: 'run-latest',
      status: 'failed',
      completedAt: '2026-06-05T10:03:00.000Z',
      failureReasonCode: 'autonomous_run_locked'
    },
    locks: {
      autonomy: {
        active: true,
        zombie: false,
        expiresAt: '2026-06-05T10:05:00.000Z',
        runId: 'run-latest'
      },
      proof: {
        active: false,
        zombie: true,
        expiresAt: '2026-06-05T09:55:00.000Z',
        signalId: 'sig-proof'
      }
    },
    items: [
      {
        reasonCode: 'AUTONOMY_DRY_RUN',
        blockingFact: 'One or more autonomy agents are not in LIVE mode.',
        impact: 'autonomy_dry_run_or_off',
        nextAction: 'Switch both autonomy policies to LIVE after operator review.',
        scope: 'autonomy'
      },
      {
        reasonCode: 'ALLOWANCE_LOW',
        blockingFact: 'At least one public agent wallet allowance is below the configured stake cap.',
        impact: 'bounded_tx_blocked',
        nextAction: 'Increase USDC allowance from the server wallet before any bounded transaction.',
        scope: 'budget'
      },
      {
        reasonCode: 'CHAIN_DEGRADED',
        blockingFact: 'Arc readiness checks are currently unavailable.',
        impact: 'read_only_proof_safe',
        nextAction: 'Use read-only proof data only until Arc readiness returns to a healthy state.',
        scope: 'chain'
      }
    ]
  };
}

beforeEach(() => {
  mockState.env = createEnv();
  mockState.arenaState = createArenaState();
  mockState.controlRoom = createControlRoomState();
  mockState.receipts = createReceipts();
  mockState.healthView = createHealthView();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('admin operator pages', () => {
  it('renders /admin/control-room with Arc readiness facts and wallet funding state', async () => {
    const html = renderToStaticMarkup(await AdminControlRoomPage());

    expect(html).toContain('Control Room');
    expect(html).toContain('Arc Readiness');
    expect(html).toContain('Commit available');
    expect(html).toContain('5042002');
    expect(html).toContain('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(html).toContain('0x3600000000000000000000000000000000000000');
    expect(html).toContain('0x4444444444444444444444444444444444444444');
    expect(html).toContain('0x5555555555555555555555555555555555555555');
    expect(html).toContain('$125.00');
    expect(html).toContain('$50.00');
    expect(html).toContain(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );
    expect(html).not.toContain('Readiness panels incoming.');
  });

  it('renders /admin/receipts from autonomous run receipts and shows an operational empty state', async () => {
    const html = renderToStaticMarkup(await AdminReceiptsPage());

    expect(html).toContain('Autonomous Receipts');
    expect(html).toContain('run-latest');
    expect(html).toContain('live');
    expect(html).toContain('LIVE');
    expect(html).toContain('DRY_RUN');
    expect(html).toContain('Will BTC close above $110,000 on June 30, 2026?');
    expect(html).toContain('mode_off');
    expect(html).toContain('autonomous_run_locked');
    expect(html).toContain(
      '0x1111111111111111111111111111111111111111111111111111111111111111'
    );
    expect(html).toContain(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    );
    expect(html).toContain(
      '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    );
    expect(html).not.toContain('Autonomous run history placeholder.');

    mockState.arenaState = {
      ...createArenaState(),
      autonomyRuns: []
    };
    mockState.receipts = {};

    const emptyHtml = renderToStaticMarkup(await AdminReceiptsPage());

    expect(emptyHtml).toContain('No autonomous receipts yet');
  });

  it('renders /admin/health as a sanitized status grid with structured blockers', async () => {
    if (!mockState.controlRoom) {
      throw new Error('control room mock missing');
    }

    mockState.controlRoom = {
      ...mockState.controlRoom,
      status: 'degraded',
      reason: 'arc_readiness_unavailable',
      commitAvailable: false
    };

    const html = renderToStaticMarkup(await AdminHealthPage());

    expect(html).toContain('Operator Health');
    expect(html).toContain('Last cron');
    expect(html).toContain('failed');
    expect(html).toContain('Lock state');
    expect(html).toContain('Budget warnings');
    expect(html).toContain('Chain readiness');
    expect(html).toContain('Autonomy mode');
    expect(html).toContain('AUTONOMY_DRY_RUN');
    expect(html).toContain('ALLOWANCE_LOW');
    expect(html).toContain('CHAIN_DEGRADED');
    expect(html).toContain('read only proof safe');
    expect(html).toContain('Switch both autonomy policies to LIVE after operator review.');
    expect(html).not.toContain('Operator health placeholder.');
    expect(html).not.toContain('cron-secret-never-render');
    expect(html).not.toContain('proof-secret-never-render');
    expect(html).not.toContain('resolve-token-never-render');
    expect(html).not.toContain('secret-lock-owner');
    expect(html).not.toContain('rpc.internal.example');
  });
});
