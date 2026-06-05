import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const walletAddress = '0x1000000000000000000000000000000000000001' as const;

const walletMocks = vi.hoisted(() => ({
  provider: { isMetaMask: true },
  getBrowserWalletProvider: vi.fn(),
  readBrowserWalletSession: vi.fn(),
  subscribeBrowserWalletSessionChange: vi.fn(),
  requestBrowserWalletAddress: vi.fn(),
  readBrowserWalletChainId: vi.fn(),
  switchBrowserWalletToArc: vi.fn(),
  writeBrowserWalletSession: vi.fn(),
  clearBrowserWalletSession: vi.fn()
}));

const usdcMocks = vi.hoisted(() => ({
  createBrowserWalletClients: vi.fn(),
  readUsdcBalance: vi.fn(),
  readUsdcAllowance: vi.fn()
}));

vi.mock('@/lib/arc/browserWallet', async () => {
  const actual = await vi.importActual<typeof import('@/lib/arc/browserWallet')>(
    '@/lib/arc/browserWallet'
  );

  return {
    ...actual,
    getBrowserWalletProvider: walletMocks.getBrowserWalletProvider,
    readBrowserWalletSession: walletMocks.readBrowserWalletSession,
    subscribeBrowserWalletSessionChange: walletMocks.subscribeBrowserWalletSessionChange,
    requestBrowserWalletAddress: walletMocks.requestBrowserWalletAddress,
    readBrowserWalletChainId: walletMocks.readBrowserWalletChainId,
    switchBrowserWalletToArc: walletMocks.switchBrowserWalletToArc,
    writeBrowserWalletSession: walletMocks.writeBrowserWalletSession,
    clearBrowserWalletSession: walletMocks.clearBrowserWalletSession,
    createBrowserWalletClients: usdcMocks.createBrowserWalletClients
  };
});

vi.mock('@/lib/arc/usdc', () => ({
  readUsdcBalance: usdcMocks.readUsdcBalance,
  readUsdcAllowance: usdcMocks.readUsdcAllowance
}));

import { WalletConnectButton } from '@/components/WalletConnectButton';

function createJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  } as Response;
}

describe('WalletConnectButton', () => {
  beforeEach(() => {
    walletMocks.getBrowserWalletProvider.mockReset();
    walletMocks.getBrowserWalletProvider.mockReturnValue(walletMocks.provider);
    walletMocks.readBrowserWalletSession.mockReset();
    walletMocks.subscribeBrowserWalletSessionChange.mockReset();
    walletMocks.subscribeBrowserWalletSessionChange.mockReturnValue(() => undefined);
    walletMocks.requestBrowserWalletAddress.mockReset();
    walletMocks.readBrowserWalletChainId.mockReset();
    walletMocks.switchBrowserWalletToArc.mockReset();
    walletMocks.switchBrowserWalletToArc.mockResolvedValue(undefined);
    walletMocks.writeBrowserWalletSession.mockReset();
    walletMocks.clearBrowserWalletSession.mockReset();

    usdcMocks.createBrowserWalletClients.mockReset();
    usdcMocks.createBrowserWalletClients.mockReturnValue({
      publicClient: {},
      walletClient: {}
    });
    usdcMocks.readUsdcBalance.mockReset();
    usdcMocks.readUsdcBalance.mockResolvedValue(1_500_000n);
    usdcMocks.readUsdcAllowance.mockReset();
    usdcMocks.readUsdcAllowance.mockResolvedValue(900_000n);

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === '/api/autonomy') {
          return createJsonResponse({
            controlRoom: {
              status: 'ready',
              reason: null,
              chainId: 5042002,
              arenaAddress: '0x9999999999999999999999999999999999999999',
              usdcAddress: '0x8888888888888888888888888888888888888888',
              usdcDecimals: 6,
              commitAvailable: true,
              latestTxHash: '0xabcdef12abcdef12abcdef12abcdef12abcdef12abcdef12abcdef12abcdef12'
            }
          });
        }

        throw new Error(`Unhandled fetch request: ${url}`);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('toggles a wallet readiness popover from the connected address button on Arc', async () => {
    walletMocks.readBrowserWalletSession.mockReturnValue({
      walletAddress,
      chainId: 5042002,
      connectedAt: '2026-06-05T00:00:00.000Z'
    });

    render(<WalletConnectButton />);

    fireEvent.click(screen.getByRole('button', { name: '0x100000...000001' }));

    const popover = await screen.findByRole('dialog', { name: 'Wallet readiness' });
    expect(popover).toHaveTextContent(walletAddress);
    expect(popover).toHaveTextContent('Arc chain');
    expect(popover).toHaveTextContent('5042002');
    expect(popover).toHaveTextContent('USDC balance');
    expect(popover).toHaveTextContent('$1.50');
    expect(popover).toHaveTextContent('Allowance');
    expect(popover).toHaveTextContent('$0.90');
    expect(popover).toHaveTextContent('Contract readiness');
    expect(popover).toHaveTextContent('Ready');
    expect(popover).toHaveTextContent('Latest tx');
    expect(popover).toHaveTextContent('0xabcdef12...cdef12');
    expect(popover).toHaveTextContent('Disconnect');

    fireEvent.click(screen.getByRole('button', { name: '0x100000...000001' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Wallet readiness' })).not.toBeInTheDocument();
    });
  });

  it('keeps the switch flow on the primary button when the stored wallet is on the wrong chain', async () => {
    walletMocks.readBrowserWalletSession.mockReturnValue({
      walletAddress,
      chainId: 1,
      connectedAt: '2026-06-05T00:00:00.000Z'
    });
    walletMocks.readBrowserWalletChainId.mockResolvedValue(5042002);

    render(<WalletConnectButton />);

    fireEvent.click(screen.getByRole('button', { name: 'Switch to Arc' }));

    await waitFor(() => {
      expect(walletMocks.switchBrowserWalletToArc).toHaveBeenCalledWith(walletMocks.provider);
    });
    expect(screen.queryByRole('dialog', { name: 'Wallet readiness' })).not.toBeInTheDocument();
  });

  it('still reads the wallet USDC balance when the arena contract is not configured', async () => {
    walletMocks.readBrowserWalletSession.mockReturnValue({
      walletAddress,
      chainId: 5042002,
      connectedAt: '2026-06-05T00:00:00.000Z'
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === '/api/autonomy') {
          return createJsonResponse({
            controlRoom: {
              status: 'degraded',
              reason: 'showdown_discovery_config_missing',
              chainId: 5042002,
              arenaAddress: null,
              usdcAddress: '0x8888888888888888888888888888888888888888',
              usdcDecimals: 6,
              commitAvailable: false,
              latestTxHash: null
            }
          });
        }

        throw new Error(`Unhandled fetch request: ${url}`);
      })
    );

    render(<WalletConnectButton />);

    fireEvent.click(screen.getByRole('button', { name: '0x100000...000001' }));

    const popover = await screen.findByRole('dialog', { name: 'Wallet readiness' });
    expect(popover).toHaveTextContent('USDC balance');
    expect(popover).toHaveTextContent('$1.50');
    expect(popover).toHaveTextContent('Allowance');
    expect(popover).toHaveTextContent('Unavailable');
    expect(popover).toHaveTextContent('Contract readiness');
    expect(popover).toHaveTextContent('Unavailable');
    expect(usdcMocks.readUsdcBalance).toHaveBeenCalled();
    expect(usdcMocks.readUsdcAllowance).not.toHaveBeenCalled();
  });
});
