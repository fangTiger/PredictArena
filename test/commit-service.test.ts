import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalStore } from '@/lib/persistence/localStore';
import { commitSignalToArena } from '@/lib/arc/commitSignal';
import type { AgentSignal } from '@/lib/polymarket/types';

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

describe('commitSignalToArena', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('rejects missing config before any onchain call', async () => {
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', '');
    vi.stubEnv('VOL_AGENT_PRIVATE_KEY', '');

    const store = createLocalStore({ storagePath: '/tmp/predictarena-commit-test.json' });

    await expect(commitSignalToArena(store, createSignal())).rejects.toThrow(
      /commit_config_missing/
    );
  });

  it('checks allowance, approves if needed, and commits with the matching agent wallet', async () => {
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    vi.stubEnv('VOL_AGENT_PRIVATE_KEY', '0x1111111111111111111111111111111111111111111111111111111111111111');
    vi.stubEnv('MOMENTUM_AGENT_PRIVATE_KEY', '0x2222222222222222222222222222222222222222222222222222222222222222');

    const readContract = vi
      .fn()
      .mockResolvedValueOnce(5_042_002)
      .mockResolvedValueOnce(0n);
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });
    const writeContract = vi
      .fn()
      .mockResolvedValueOnce('0xapprove000000000000000000000000000000000000000000000000000000000001')
      .mockResolvedValueOnce('0xcommit0000000000000000000000000000000000000000000000000000000000001');

    const store = createLocalStore({ storagePath: '/tmp/predictarena-commit-flow.json' });

    const result = await commitSignalToArena(store, createSignal(), {
      createClients: ({ privateKey }) => ({
        account: {
          address:
            privateKey === '0x1111111111111111111111111111111111111111111111111111111111111111'
              ? '0xvolatility0000000000000000000000000000000'
              : '0xmomentum00000000000000000000000000000000'
        } as never,
        publicClient: {
          getChainId: readContract,
          readContract,
          waitForTransactionReceipt
        } as never,
        walletClient: {
          writeContract
        } as never
      })
    });

    expect(readContract).toHaveBeenCalled();
    expect(writeContract).toHaveBeenCalledTimes(2);
    expect(String(writeContract.mock.calls[0]?.[0]?.address)).toContain('3600000000000000000000000000000000000000');
    expect(String(writeContract.mock.calls[1]?.[0]?.address)).toContain('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(result.txHash).toContain('0xcommit');
  });

  it('preserves the commit tx hash when receipt waiting fails', async () => {
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    vi.stubEnv('VOL_AGENT_PRIVATE_KEY', '0x1111111111111111111111111111111111111111111111111111111111111111');

    const txHash = '0xcommit0000000000000000000000000000000000000000000000000000000000002';
    const waitForTransactionReceipt = vi.fn().mockRejectedValue(new Error('receipt_timeout'));
    const writeContract = vi.fn().mockResolvedValue(txHash);
    const store = createLocalStore({ storagePath: '/tmp/predictarena-commit-receipt-fail.json' });

    await expect(
      commitSignalToArena(store, createSignal(), {
        createClients: () => ({
          account: {
            address: '0xvolatility0000000000000000000000000000000'
          } as never,
          publicClient: {
            getChainId: vi.fn().mockResolvedValue(5_042_002),
            readContract: vi.fn().mockResolvedValue(100_000n),
            waitForTransactionReceipt
          } as never,
          walletClient: {
            writeContract
          } as never
        })
      })
    ).rejects.toMatchObject({
      message: 'commit_receipt_unconfirmed',
      txHash
    });
  });
});
