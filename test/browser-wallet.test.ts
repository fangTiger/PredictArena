import { describe, expect, it } from 'vitest';
import type { AgentSignal } from '@/lib/polymarket/types';

function signal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  const now = '2026-06-02T00:00:00.000Z';
  return {
    id: 'signal-1',
    runId: 'run-1',
    marketId: 'market-1',
    marketQuestion: 'Will BTC trade above 100k?',
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'TOUCH_ABOVE',
    thresholdUsd: 100_000,
    expiresAt: '2026-06-03T00:00:00.000Z',
    agentName: 'volatility',
    modelVersion: 'volatility-gbm-v1',
    modelParams: {},
    modelHash: `0x${'1'.repeat(64)}`,
    dataHash: `0x${'2'.repeat(64)}`,
    side: 'YES',
    status: 'generated',
    confidence: 'HIGH',
    confidenceBps: 8200,
    marketPriceBps: 5200,
    agentProbabilityBps: 7100,
    yesPriceBps: 5200,
    pYesBps: 7100,
    edgeBps: 1900,
    kellyBps: 1200,
    stakeMicroUsdc: 50000,
    riskFlags: [],
    arcTxHash: null,
    createdAt: now,
    updatedAt: now,
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

describe('browser wallet follow helper', () => {
  it('detects when no browser wallet provider is available', async () => {
    const { getBrowserWalletProvider, getWalletFollowStep } = await import('@/lib/arc/browserWallet');

    expect(getBrowserWalletProvider({})).toBeNull();
    expect(
      getWalletFollowStep({
        hasProvider: false,
        walletAddress: null,
        chainId: null,
        requiredChainId: 5042002,
        balanceMicroUsdc: null,
        allowanceMicroUsdc: null,
        requiredStakeMicroUsdc: 50000,
        alreadyFollowed: false
      })
    ).toMatchObject({
      action: 'install_wallet',
      label: 'Install wallet'
    });
  });

  it('keeps the follow action sequence minimal and deterministic', async () => {
    const { getWalletFollowStep } = await import('@/lib/arc/browserWallet');
    const base = {
      hasProvider: true,
      walletAddress: '0x1000000000000000000000000000000000000001' as `0x${string}`,
      chainId: 5042002,
      requiredChainId: 5042002,
      balanceMicroUsdc: 100000n,
      allowanceMicroUsdc: 100000n,
      requiredStakeMicroUsdc: 50000,
      alreadyFollowed: false
    };

    expect(getWalletFollowStep({ ...base, walletAddress: null })).toMatchObject({
      action: 'connect_wallet',
      label: 'Connect wallet'
    });
    expect(getWalletFollowStep({ ...base, chainId: 1 })).toMatchObject({
      action: 'switch_chain',
      label: 'Switch to Arc'
    });
    expect(getWalletFollowStep({ ...base, balanceMicroUsdc: 1000n })).toMatchObject({
      action: 'insufficient_balance',
      label: 'Need USDC'
    });
    expect(getWalletFollowStep({ ...base, allowanceMicroUsdc: 1000n })).toMatchObject({
      action: 'approve_usdc',
      label: 'Approve USDC'
    });
    expect(getWalletFollowStep(base)).toMatchObject({
      action: 'follow',
      label: 'Follow with Wallet'
    });
    expect(getWalletFollowStep({ ...base, alreadyFollowed: true })).toMatchObject({
      action: 'already_followed',
      label: 'Followed'
    });
  });

  it('stores and clears a shared browser wallet session for global navigation', async () => {
    const {
      clearBrowserWalletSession,
      readBrowserWalletSession,
      writeBrowserWalletSession
    } = await import('@/lib/arc/browserWallet');
    const storage = new Map<string, string>();
    const source = {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        }
      },
      dispatchEvent: () => true
    };

    writeBrowserWalletSession(
      {
        walletAddress: '0x1000000000000000000000000000000000000001',
        chainId: 5042002,
        connectedAt: '2026-06-02T00:00:00.000Z'
      },
      source
    );

    expect(readBrowserWalletSession(source)).toEqual({
      walletAddress: '0x1000000000000000000000000000000000000001',
      chainId: 5042002,
      connectedAt: '2026-06-02T00:00:00.000Z'
    });

    clearBrowserWalletSession(source);

    expect(readBrowserWalletSession(source)).toBeNull();
  });

  it('selects the first wallet-fundable signal that the connected wallet has not followed', async () => {
    const { selectWalletFundableSignal } = await import('@/lib/arc/browserWallet');
    const walletAddress = '0x1000000000000000000000000000000000000001' as const;
    const firstEligible = signal({ id: 'first-eligible' });
    const secondEligible = signal({ id: 'second-eligible', asset: 'ETH', marketId: 'market-2' });

    expect(
      selectWalletFundableSignal(
        [
          signal({ id: 'avoid-signal', side: 'AVOID', edgeBps: 0, confidence: 'LOW' }),
          firstEligible,
          secondEligible
        ],
        [{ signalId: 'first-eligible', walletAddress }],
        walletAddress
      )
    ).toBe(secondEligible);

    expect(
      selectWalletFundableSignal(
        [signal({ id: 'already-committed', arcTxHash: `0x${'3'.repeat(64)}` })],
        [],
        walletAddress
      )
    ).toBeNull();
  });
});
