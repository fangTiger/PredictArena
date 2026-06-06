import { describe, expect, it, vi } from 'vitest';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { WalletFollowRecord } from '@/lib/persistence/store';
import { createWalletBindingsFacade } from '@/lib/persistence/walletBindings';

const WALLET = '0x1000000000000000000000000000000000000001' as const;
const OTHER_WALLET = '0x2000000000000000000000000000000000000002' as const;

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    id: 'signal-1',
    runId: 'run-1',
    marketId: 'market-1',
    marketQuestion: 'Will BTC close above $100,000 this week?',
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 100_000,
    expiresAt: '2026-06-10T00:00:00.000Z',
    agentName: 'volatility',
    modelVersion: 'volatility-gbm-v1',
    modelParams: {},
    modelHash: `0x${'1'.repeat(64)}`,
    dataHash: `0x${'2'.repeat(64)}`,
    side: 'YES',
    status: 'committed',
    confidence: 'HIGH',
    confidenceBps: 7800,
    marketPriceBps: 5200,
    agentProbabilityBps: 6900,
    yesPriceBps: 5200,
    pYesBps: 6900,
    edgeBps: 1700,
    kellyBps: 600,
    stakeMicroUsdc: 50_000,
    riskFlags: [],
    arcTxHash: `0x${'3'.repeat(64)}`,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

function createWalletFollowRecord(
  signalId: string,
  overrides: Partial<WalletFollowRecord> = {}
): WalletFollowRecord {
  return {
    id: overrides.id ?? `follow:${signalId}:${overrides.txHash ?? `0x${'4'.repeat(64)}`}`,
    signalId,
    walletAddress: overrides.walletAddress ?? WALLET,
    txHash: overrides.txHash ?? (`0x${'4'.repeat(64)}` as `0x${string}`),
    signalRecordId: overrides.signalRecordId ?? 7,
    chainId: overrides.chainId ?? 5_042_002,
    arenaAddress:
      overrides.arenaAddress ?? (`0x${'5'.repeat(40)}` as `0x${string}`),
    stakeMicroUsdc: overrides.stakeMicroUsdc ?? 50_000,
    agentName: overrides.agentName ?? 'volatility',
    followedAt: overrides.followedAt ?? '2026-06-02T00:00:00.000Z'
  };
}

describe('WalletBindingsFacade', () => {
  it('returns an empty summary for wallets without follows', async () => {
    const facade = createWalletBindingsFacade({
      store: {
        listSignals: vi.fn(async () => []),
        listWalletFollows: vi.fn(async () => [])
      }
    });

    const summary = await facade.getSummary(WALLET.toUpperCase());

    expect(summary.walletAddress).toBe(WALLET);
    expect(summary.follows).toEqual([]);
    expect(summary.txHistory).toEqual([]);
    expect(summary.usdcBalanceMicro).toBe(0n);
    expect(summary.usdcAllowanceMicro).toBe(0n);
    expect(summary.arcChainSynced).toBe(true);
    expect(summary.cumulativeBondedMicro).toBe(0n);
    expect(summary.cumulativePayoutMicro).toBe(0n);
    expect(summary.currentNetPnlMicro).toBe(0n);
  });

  it('joins persisted signals into follows and derives tx history entries', async () => {
    const signal = createSignal();
    const facade = createWalletBindingsFacade({
      store: {
        listSignals: vi.fn(async () => [signal]),
        listWalletFollows: vi.fn(async () => [
          createWalletFollowRecord(signal.id, {
            txHash: `0x${'6'.repeat(64)}` as `0x${string}`,
            stakeMicroUsdc: 125_000,
            followedAt: '2026-06-03T09:30:00.000Z'
          }),
          createWalletFollowRecord(signal.id, {
            walletAddress: OTHER_WALLET
          })
        ])
      },
      readUsdcBalanceMicro: vi.fn(async () => 900_000n),
      readUsdcAllowanceMicro: vi.fn(async () => 450_000n),
      buildExplorerUrl: (txHash) => `https://explorer.test/tx/${txHash}`
    });

    const summary = await facade.getSummary(WALLET);

    expect(summary.follows).toEqual([
      expect.objectContaining({
        signalId: signal.id,
        marketId: signal.marketId,
        marketQuestion: signal.marketQuestion,
        side: 'YES',
        status: 'confirmed',
        bondedMicroUsdc: 125_000n,
        payoutMicroUsdc: null,
        resolvedAt: null
      })
    ]);
    expect(summary.txHistory).toEqual([
      expect.objectContaining({
        txHash: `0x${'6'.repeat(64)}`,
        kind: 'follow-commit',
        amountMicroUsdc: 125_000n,
        status: 'success',
        arcExplorerUrl: `https://explorer.test/tx/0x${'6'.repeat(64)}`
      })
    ]);
    expect(summary.usdcBalanceMicro).toBe(900_000n);
    expect(summary.usdcAllowanceMicro).toBe(450_000n);
  });

  it('derives resolved win and loss payouts and cumulative totals', async () => {
    const winningSignal = createSignal({
      id: 'signal-win',
      resolution: {
        outcomeCorrect: true,
        resolvedAt: '2026-06-04T08:00:00.000Z'
      },
      status: 'resolved_correct'
    });
    const losingSignal = createSignal({
      id: 'signal-loss',
      side: 'NO',
      resolution: {
        outcomeCorrect: false,
        resolvedAt: '2026-06-04T09:00:00.000Z'
      },
      status: 'resolved_incorrect'
    });
    const facade = createWalletBindingsFacade({
      store: {
        listSignals: vi.fn(async () => [winningSignal, losingSignal]),
        listWalletFollows: vi.fn(async () => [
          createWalletFollowRecord(winningSignal.id, {
            stakeMicroUsdc: 200_000,
            followedAt: '2026-06-04T01:00:00.000Z'
          }),
          createWalletFollowRecord(losingSignal.id, {
            id: 'follow-loss',
            txHash: `0x${'7'.repeat(64)}` as `0x${string}`,
            stakeMicroUsdc: 150_000,
            followedAt: '2026-06-04T02:00:00.000Z'
          })
        ])
      }
    });

    const summary = await facade.getSummary(WALLET);

    expect(summary.follows.map((follow) => follow.status)).toEqual([
      'resolved-loss',
      'resolved-win'
    ]);
    expect(summary.follows[0]).toMatchObject({
      side: 'NO',
      payoutMicroUsdc: 0n,
      resolvedAt: '2026-06-04T09:00:00.000Z'
    });
    expect(summary.follows[1]).toMatchObject({
      payoutMicroUsdc: 400_000n,
      resolvedAt: '2026-06-04T08:00:00.000Z'
    });
    expect(summary.cumulativeBondedMicro).toBe(350_000n);
    expect(summary.cumulativePayoutMicro).toBe(400_000n);
    expect(summary.currentNetPnlMicro).toBe(50_000n);
  });

  it('treats persisted follows without resolutions as confirmed even when signals are generated or missing', async () => {
    const generatedSignal = createSignal({
      id: 'signal-generated',
      status: 'generated',
      arcTxHash: null
    });
    const facade = createWalletBindingsFacade({
      store: {
        listSignals: vi.fn(async () => [generatedSignal]),
        listWalletFollows: vi.fn(async () => [
          createWalletFollowRecord(generatedSignal.id, {
            id: 'follow-generated',
            followedAt: '2026-06-05T01:00:00.000Z'
          }),
          createWalletFollowRecord('missing-signal', {
            id: 'follow-missing',
            txHash: `0x${'8'.repeat(64)}` as `0x${string}`,
            followedAt: '2026-06-05T02:00:00.000Z'
          })
        ])
      }
    });

    const follows = await facade.listFollows(WALLET);

    expect(follows).toEqual([
      expect.objectContaining({
        signalId: 'missing-signal',
        marketId: 'missing-signal',
        marketQuestion: '(market unavailable)',
        side: 'YES',
        status: 'pending',
        payoutMicroUsdc: null
      }),
      expect.objectContaining({
        signalId: 'signal-generated',
        status: 'confirmed'
      })
    ]);
  });

  it('orders follows by most recent first and limits follows plus tx history to 50 rows', async () => {
    const signals = Array.from({ length: 52 }, (_, index) =>
      createSignal({
        id: `signal-${index + 1}`,
        marketId: `market-${index + 1}`,
        marketQuestion: `Question ${index + 1}`
      })
    );
    const follows = Array.from({ length: 52 }, (_, index) =>
      createWalletFollowRecord(`signal-${index + 1}`, {
        id: `follow-${index + 1}`,
        txHash: `0x${(index + 10).toString(16).padStart(64, '0')}` as `0x${string}`,
        followedAt: new Date(Date.parse('2026-06-05T00:00:00.000Z') + index * 1000).toISOString()
      })
    );
    const facade = createWalletBindingsFacade({
      store: {
        listSignals: vi.fn(async () => signals),
        listWalletFollows: vi.fn(async () => follows)
      }
    });

    const summary = await facade.getSummary(WALLET);

    expect(summary.follows).toHaveLength(50);
    expect(summary.txHistory).toHaveLength(50);
    expect(summary.follows[0].signalId).toBe('signal-52');
    expect(summary.follows.at(-1)?.signalId).toBe('signal-3');
    expect(summary.txHistory[0].txHash).toBe(`0x${(52 + 9).toString(16).padStart(64, '0')}`);
    expect(summary.txHistory.at(-1)?.txHash).toBe(`0x${(3 + 9).toString(16).padStart(64, '0')}`);
  });
});
