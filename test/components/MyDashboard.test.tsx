import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const WALLET_A = '0x1000000000000000000000000000000000000001' as const;
const WALLET_B = '0x2000000000000000000000000000000000000002' as const;

const browserWalletMocks = vi.hoisted(() => ({
  readBrowserWalletSession: vi.fn(),
  subscribeBrowserWalletSessionChange: vi.fn(),
  writeBrowserWalletSession: vi.fn(),
  clearBrowserWalletSession: vi.fn()
}));

const swrMocks = vi.hoisted(() => ({
  mutate: vi.fn()
}));

vi.mock('swr', async () => {
  const actual = await vi.importActual<typeof import('swr')>('swr');

  return {
    ...actual,
    mutate: swrMocks.mutate
  };
});

vi.mock('@/lib/arc/browserWallet', async () => {
  const actual = await vi.importActual<typeof import('@/lib/arc/browserWallet')>(
    '@/lib/arc/browserWallet'
  );

  return {
    ...actual,
    readBrowserWalletSession: browserWalletMocks.readBrowserWalletSession,
    subscribeBrowserWalletSessionChange: browserWalletMocks.subscribeBrowserWalletSessionChange,
    writeBrowserWalletSession: browserWalletMocks.writeBrowserWalletSession,
    clearBrowserWalletSession: browserWalletMocks.clearBrowserWalletSession
  };
});

vi.mock('@/components/WalletConnectButton', () => ({
  WalletConnectButton: ({ className }: { className?: string }) => (
    <button className={className}>Connect Wallet</button>
  )
}));

import { MyDashboard } from '@/components/MyDashboard';

function createSummaryPayload(walletAddress: string) {
  return {
    walletAddress,
    usdcBalanceMicro: '1200000',
    usdcAllowanceMicro: '800000',
    follows: [
      {
        id: `follow:${walletAddress}`,
        walletAddress,
        signalId: 'signal-1',
        marketId: 'market-1',
        marketQuestion: 'Will BTC close above $100,000 this week?',
        side: 'YES',
        bondedMicroUsdc: '250000',
        followTxHash: `0x${'1'.repeat(64)}`,
        status: 'confirmed',
        followedAt: '2026-06-05T00:00:00.000Z',
        resolvedAt: null,
        payoutMicroUsdc: null
      }
    ],
    txHistory: [
      {
        txHash: `0x${'1'.repeat(64)}`,
        blockNumber: null,
        timestamp: '2026-06-05T00:00:00.000Z',
        kind: 'follow-commit',
        amountMicroUsdc: '250000',
        status: 'success',
        arcExplorerUrl: `https://testnet.arcscan.app/tx/0x${'1'.repeat(64)}`
      }
    ],
    cumulativeBondedMicro: '250000',
    cumulativePayoutMicro: '0',
    currentNetPnlMicro: '-250000'
  };
}

function renderDashboard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <MyDashboard />
    </SWRConfig>
  );
}

describe('MyDashboard', () => {
  beforeEach(() => {
    swrMocks.mutate.mockReset();
    browserWalletMocks.readBrowserWalletSession.mockReset();
    browserWalletMocks.subscribeBrowserWalletSessionChange.mockReset();
    browserWalletMocks.subscribeBrowserWalletSessionChange.mockReturnValue(() => undefined);
    browserWalletMocks.writeBrowserWalletSession.mockReset();
    browserWalletMocks.clearBrowserWalletSession.mockReset();
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url === `/api/wallet/${WALLET_A}/summary`) {
        return {
          ok: true,
          status: 200,
          json: async () => createSummaryPayload(WALLET_A)
        } as Response;
      }

      if (url === `/api/wallet/${WALLET_B}/summary`) {
        return {
          ok: true,
          status: 200,
          json: async () => createSummaryPayload(WALLET_B)
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    }));

    const providerListeners = new Map<string, (...args: any[]) => void>();
    Object.defineProperty(window, 'ethereum', {
      configurable: true,
      value: {
        on: vi.fn((event: string, listener: (...args: any[]) => void) => {
          providerListeners.set(event, listener);
        }),
        removeListener: vi.fn((event: string) => {
          providerListeners.delete(event);
        }),
        __listeners: providerListeners
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as typeof window & { ethereum?: unknown }).ethereum;
  });

  it('shows only a centered connect CTA and does not fetch when no wallet session exists', () => {
    browserWalletMocks.readBrowserWalletSession.mockReturnValue(null);

    renderDashboard();

    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument();
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('renders overview, follows, and tx history for the connected wallet summary key', async () => {
    browserWalletMocks.readBrowserWalletSession.mockReturnValue({
      walletAddress: WALLET_A.toUpperCase(),
      chainId: 5_042_002,
      connectedAt: '2026-06-05T00:00:00.000Z'
    });

    renderDashboard();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(`/api/wallet/${WALLET_A}/summary`);
    });

    expect(await screen.findByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Follow History')).toBeInTheDocument();
    expect(screen.getByText('Transaction History')).toBeInTheDocument();
    expect(screen.getByText(WALLET_A)).toBeInTheDocument();
  });

  it('invalidates wallet SWR keys and refetches when accountsChanged fires', async () => {
    browserWalletMocks.readBrowserWalletSession.mockReturnValue({
      walletAddress: WALLET_A,
      chainId: 5_042_002,
      connectedAt: '2026-06-05T00:00:00.000Z'
    });

    renderDashboard();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(`/api/wallet/${WALLET_A}/summary`);
    });

    const handler = (
      window as typeof window & {
        ethereum: { __listeners: Map<string, (...args: any[]) => void> };
      }
    ).ethereum.__listeners.get('accountsChanged');

    await act(async () => {
      handler?.([WALLET_B.toUpperCase()]);
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(`/api/wallet/${WALLET_B}/summary`);
    });
    expect(screen.getByText(WALLET_B)).toBeInTheDocument();
    expect(browserWalletMocks.writeBrowserWalletSession).toHaveBeenCalledWith(
      expect.objectContaining({
        walletAddress: WALLET_B
      })
    );
    expect(swrMocks.mutate).toHaveBeenCalledWith(
      expect.any(Function),
      undefined,
      { revalidate: false }
    );

    const invalidateFilter = swrMocks.mutate.mock.calls[0]?.[0];
    expect(invalidateFilter('/api/wallet/abc/summary')).toBe(true);
    expect(invalidateFilter('/api/showdowns?status=all&limit=50')).toBe(false);
  });
});
