import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentSignal } from '@/lib/polymarket/types';

const walletAddress = '0x1000000000000000000000000000000000000001' as const;

const walletMocks = vi.hoisted(() => ({
  provider: { isMetaMask: true },
  requestBrowserWalletAddress: vi.fn(),
  readBrowserWalletChainId: vi.fn(),
  createBrowserWalletClients: vi.fn(),
  switchBrowserWalletToArc: vi.fn(),
  readBrowserWalletSession: vi.fn(() => null),
  subscribeBrowserWalletSessionChange: vi.fn(() => () => {}),
  writeBrowserWalletSession: vi.fn()
}));

const arenaMocks = vi.hoisted(() => ({
  commitArenaSignal: vi.fn()
}));

const usdcMocks = vi.hoisted(() => ({
  readUsdcBalance: vi.fn(),
  readUsdcAllowance: vi.fn(),
  ensureUsdcAllowance: vi.fn()
}));

vi.mock('@/components/PendingFollowsRow', () => ({
  PendingFollowsRow: () => null
}));

vi.mock('@/components/ShowdownGrid', () => ({
  ShowdownGrid: () => <div data-testid="showdown-grid-stub" />
}));

vi.mock('@/lib/arc/browserWallet', async () => {
  const actual = await vi.importActual<typeof import('@/lib/arc/browserWallet')>(
    '@/lib/arc/browserWallet'
  );

  return {
    ...actual,
    getBrowserWalletProvider: vi.fn(() => walletMocks.provider),
    requestBrowserWalletAddress: walletMocks.requestBrowserWalletAddress,
    readBrowserWalletChainId: walletMocks.readBrowserWalletChainId,
    createBrowserWalletClients: walletMocks.createBrowserWalletClients,
    switchBrowserWalletToArc: walletMocks.switchBrowserWalletToArc,
    readBrowserWalletSession: walletMocks.readBrowserWalletSession,
    subscribeBrowserWalletSessionChange: walletMocks.subscribeBrowserWalletSessionChange,
    writeBrowserWalletSession: walletMocks.writeBrowserWalletSession
  };
});

vi.mock('@/lib/arc/signalBondArena', () => ({
  commitArenaSignal: arenaMocks.commitArenaSignal
}));

vi.mock('@/lib/arc/usdc', () => ({
  readUsdcBalance: usdcMocks.readUsdcBalance,
  readUsdcAllowance: usdcMocks.readUsdcAllowance,
  ensureUsdcAllowance: usdcMocks.ensureUsdcAllowance
}));

import { ArenaDashboard } from '@/components/arena-dashboard';

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    id: 'signal-follow-1',
    runId: 'run-follow-1',
    marketId: 'market-follow-1',
    marketQuestion: 'Will BTC close above $100,000 this week?',
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'TOUCH_ABOVE',
    thresholdUsd: 100_000,
    expiresAt: '2026-06-10T12:00:00.000Z',
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
    createdAt: '2026-06-04T00:00:00.000Z',
    updatedAt: '2026-06-04T00:00:00.000Z',
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

function createJsonResponse(payload: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  } as Response;
}

function renderDashboard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ArenaDashboard />
    </SWRConfig>
  );
}

describe('ArenaDashboard', () => {
  beforeEach(() => {
    walletMocks.requestBrowserWalletAddress.mockReset();
    walletMocks.requestBrowserWalletAddress.mockResolvedValue(walletAddress);
    walletMocks.readBrowserWalletChainId.mockReset();
    walletMocks.readBrowserWalletChainId.mockResolvedValue(5042002);
    walletMocks.createBrowserWalletClients.mockReset();
    walletMocks.createBrowserWalletClients.mockReturnValue({
      publicClient: { waitForTransactionReceipt: vi.fn() },
      walletClient: {}
    });
    walletMocks.switchBrowserWalletToArc.mockReset();
    walletMocks.switchBrowserWalletToArc.mockResolvedValue(undefined);
    walletMocks.readBrowserWalletSession.mockReset();
    walletMocks.readBrowserWalletSession.mockReturnValue(null);
    walletMocks.subscribeBrowserWalletSessionChange.mockReset();
    walletMocks.subscribeBrowserWalletSessionChange.mockReturnValue(() => {});
    walletMocks.writeBrowserWalletSession.mockReset();

    arenaMocks.commitArenaSignal.mockReset();
    arenaMocks.commitArenaSignal.mockResolvedValue(`0x${'3'.repeat(64)}`);

    usdcMocks.readUsdcBalance.mockReset();
    usdcMocks.readUsdcBalance.mockResolvedValue(100000n);
    usdcMocks.readUsdcAllowance.mockReset();
    usdcMocks.readUsdcAllowance.mockResolvedValue(100000n);
    usdcMocks.ensureUsdcAllowance.mockReset();
    usdcMocks.ensureUsdcAllowance.mockResolvedValue(undefined);

    const signal = createSignal();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === '/api/showdowns?status=all&limit=50') {
          return createJsonResponse({ showdowns: [] });
        }

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
              latestTxHash: null
            }
          });
        }

        if (url === '/api/run-agents') {
          return createJsonResponse({
            signals: [signal],
            showdowns: {
              discovery: {
                status: 'ok',
                result: {
                  discovered: 1,
                  opened: 0,
                  skips: [{ marketId: signal.marketId, reason: 'existing-open' }]
                },
                reason: null
              }
            }
          });
        }

        if (url === `/api/wallet/${walletAddress}/summary`) {
          return createJsonResponse({
            walletAddress,
            follows: [
              {
                id: 'wallet-follow-1',
                signalId: signal.id,
                walletAddress,
                txHash: `0x${'4'.repeat(64)}`,
                signalRecordId: 1,
                chainId: 5042002,
                arenaAddress: '0x9999999999999999999999999999999999999999',
                stakeMicroUsdc: signal.stakeMicroUsdc,
                agentName: signal.agentName,
                followedAt: '2026-06-04T00:01:00.000Z',
                marketQuestion: signal.marketQuestion,
                status: 'confirmed'
              }
            ],
            walletFollows: [
              {
                id: 'wallet-follow-1',
                signalId: signal.id,
                walletAddress,
                txHash: `0x${'4'.repeat(64)}`,
                signalRecordId: 1,
                chainId: 5042002,
                arenaAddress: '0x9999999999999999999999999999999999999999',
                stakeMicroUsdc: signal.stakeMicroUsdc,
                agentName: signal.agentName,
                followedAt: '2026-06-04T00:01:00.000Z',
                marketQuestion: signal.marketQuestion,
                status: 'confirmed'
              }
            ]
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

  it('checks wallet follow summary before any chain reads when follow starts from a disconnected wallet', async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Run Agents' }));

    await screen.findByText(
      'Generated 1 signal. Automatic discovery found an eligible candidate, but that market already has a live showdown.'
    );
    const directFollowButton = await screen.findByRole('button', { name: 'Connect wallet' });
    await waitFor(() => {
      expect(directFollowButton).toBeEnabled();
    });
    fireEvent.click(directFollowButton);

    await waitFor(() => {
      expect(walletMocks.requestBrowserWalletAddress).toHaveBeenCalledWith(walletMocks.provider);
    });
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => url === `/api/wallet/${walletAddress}/summary`)).toBe(
        true
      );
    });
    await waitFor(() => {
      expect(screen.getByText('This wallet already follows the selected signal.')).toBeInTheDocument();
    });

    expect(walletMocks.readBrowserWalletChainId).not.toHaveBeenCalled();
    expect(walletMocks.switchBrowserWalletToArc).not.toHaveBeenCalled();
    expect(walletMocks.createBrowserWalletClients).not.toHaveBeenCalled();
    expect(arenaMocks.commitArenaSignal).not.toHaveBeenCalled();
  });

  it('revalidates showdowns and reports opened matches after Run Agents', async () => {
    let showdownRequests = 0;
    const signal = createSignal();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === '/api/showdowns?status=all&limit=50') {
          showdownRequests += 1;
          return createJsonResponse({ showdowns: [] });
        }

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
              latestTxHash: null
            }
          });
        }

        if (url === '/api/run-agents') {
          return createJsonResponse({
            signals: [signal],
            showdowns: {
              discovery: {
                status: 'ok',
                result: {
                  discovered: 1,
                  opened: 1,
                  skips: []
                },
                reason: null
              }
            }
          });
        }

        if (url === `/api/wallet/${walletAddress}/summary`) {
          return createJsonResponse({
            walletAddress,
            follows: [],
            walletFollows: []
          });
        }

        throw new Error(`Unhandled fetch request: ${url}`);
      })
    );

    renderDashboard();

    await waitFor(() => {
      expect(showdownRequests).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Agents' }));

    await screen.findByText('Generated 1 signal. Automatic discovery opened 1 showdown. Arena refreshed for live matches.');
    await waitFor(() => {
      expect(showdownRequests).toBeGreaterThanOrEqual(2);
    });
  });

  it('keeps the opened success message when showdown revalidation fails after Run Agents', async () => {
    let showdownRequests = 0;
    const signal = createSignal();
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === '/api/showdowns?status=all&limit=50') {
          showdownRequests += 1;
          if (showdownRequests === 1) {
            return createJsonResponse({ showdowns: [] });
          }

          return createJsonResponse({ reason: 'showdowns_unavailable' }, 503);
        }

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
              latestTxHash: null
            }
          });
        }

        if (url === '/api/run-agents') {
          return createJsonResponse({
            signals: [signal],
            showdowns: {
              discovery: {
                status: 'ok',
                result: {
                  discovered: 1,
                  opened: 1,
                  skips: []
                },
                reason: null
              }
            }
          });
        }

        if (url === `/api/wallet/${walletAddress}/summary`) {
          return createJsonResponse({
            walletAddress,
            follows: [],
            walletFollows: []
          });
        }

        throw new Error(`Unhandled fetch request: ${url}`);
      })
    );

    renderDashboard();

    await waitFor(() => {
      expect(showdownRequests).toBeGreaterThanOrEqual(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Run Agents' }));

    await waitFor(() => {
      expect(showdownRequests).toBeGreaterThanOrEqual(2);
    });
    expect(
      screen.getByText('Generated 1 signal. Automatic discovery opened 1 showdown. Arena refreshed for live matches.')
    ).toBeInTheDocument();
    expect(screen.queryByText('Request failed: 503')).not.toBeInTheDocument();
  });

  it('checks wallet follow summary before chain reads when run agents plus follow starts disconnected', async () => {
    renderDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Run Agents + Follow' }));

    await waitFor(() => {
      expect(walletMocks.requestBrowserWalletAddress).toHaveBeenCalledWith(walletMocks.provider);
    });
    await waitFor(() => {
      expect(vi.mocked(fetch).mock.calls.some(([url]) => url === `/api/wallet/${walletAddress}/summary`)).toBe(
        true
      );
    });
    await waitFor(() => {
      expect(screen.getByText('No wallet-fundable signal was generated in this run.')).toBeInTheDocument();
    });

    expect(walletMocks.readBrowserWalletChainId).not.toHaveBeenCalled();
    expect(walletMocks.switchBrowserWalletToArc).not.toHaveBeenCalled();
    expect(walletMocks.createBrowserWalletClients).not.toHaveBeenCalled();
    expect(arenaMocks.commitArenaSignal).not.toHaveBeenCalled();
  });

  it('guides the user after run agents plus follow confirms a wallet receipt', async () => {
    walletMocks.readBrowserWalletSession.mockReturnValue({
      walletAddress,
      chainId: 5042002,
      connectedAt: '2026-06-04T00:00:00.000Z'
    });
    usdcMocks.readUsdcAllowance.mockResolvedValue(0n);

    const signal = createSignal();
    const confirmedFollow = {
      id: 'wallet-follow-2',
      signalId: signal.id,
      walletAddress,
      txHash: `0x${'3'.repeat(64)}`,
      signalRecordId: 2,
      chainId: 5042002,
      arenaAddress: '0x9999999999999999999999999999999999999999',
      stakeMicroUsdc: signal.stakeMicroUsdc,
      agentName: signal.agentName,
      followedAt: '2026-06-04T00:02:00.000Z',
      marketQuestion: signal.marketQuestion,
      status: 'confirmed' as const
    };
    const historicalSummaryFollow = {
      id: 'wallet-follow-historical',
      signalId: 'historical-signal',
      walletAddress,
      marketId: 'historical-market',
      marketQuestion: 'Will a historical wallet follow stay normalized?',
      side: 'NO' as const,
      bondedMicroUsdc: String(signal.stakeMicroUsdc),
      followTxHash: `0x${'7'.repeat(64)}`,
      status: 'confirmed' as const,
      followedAt: '2026-06-04T00:00:00.000Z',
      resolvedAt: null,
      payoutMicroUsdc: null
    };
    const confirmedSummaryFollow = {
      id: confirmedFollow.id,
      signalId: confirmedFollow.signalId,
      walletAddress,
      marketId: signal.marketId,
      marketQuestion: signal.marketQuestion,
      side: signal.side,
      bondedMicroUsdc: String(signal.stakeMicroUsdc),
      followTxHash: confirmedFollow.txHash,
      status: 'confirmed' as const,
      followedAt: confirmedFollow.followedAt,
      resolvedAt: null,
      payoutMicroUsdc: null
    };

    let walletSummaryRequests = 0;
    let followPersisted = false;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === '/api/showdowns?status=all&limit=50') {
          return createJsonResponse({ showdowns: [] });
        }

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
              latestTxHash: null
            }
          });
        }

        if (url === '/api/run-agents') {
          return createJsonResponse({ signals: [signal] });
        }

        if (url === `/api/wallet/${walletAddress}/summary`) {
          walletSummaryRequests += 1;
          const follows = followPersisted ? [confirmedSummaryFollow, historicalSummaryFollow] : [historicalSummaryFollow];
          return createJsonResponse({
            walletAddress,
            follows,
            walletFollows: follows
          });
        }

        if (url === '/api/wallet/follows' && init?.method === 'POST') {
          followPersisted = true;
          return createJsonResponse({
            follow: {
              ...confirmedFollow,
              marketQuestion: undefined,
              status: undefined
            }
          });
        }

        throw new Error(`Unhandled fetch request: ${url}`);
      })
    );

    renderDashboard();

    let resolveCommit: (hash: `0x${string}`) => void = () => undefined;
    arenaMocks.commitArenaSignal.mockReturnValue(
      new Promise<`0x${string}`>((resolve) => {
        resolveCommit = resolve;
      })
    );
    usdcMocks.ensureUsdcAllowance.mockResolvedValue(`0x${'2'.repeat(64)}`);

    fireEvent.click(screen.getByRole('button', { name: 'Run Agents + Follow' }));

    await waitFor(() => {
      expect(usdcMocks.ensureUsdcAllowance).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(arenaMocks.commitArenaSignal).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(
        screen.getByText(/USDC approved 0x22222222\.\.\.222222\. Submit wallet follow transaction\./i)
      ).toBeInTheDocument();
    });

    resolveCommit(`0x${'3'.repeat(64)}`);

    await waitFor(() => {
      expect(
        screen.getByText(
          /Wallet follow confirmed: .*0x33333333\.\.\.333333\. Check \/my for the saved receipt\. Automatic showdown discovery runs after each agent run, and Arena refreshes when a match opens\./i
        )
      ).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Followed' })).toBeDisabled();
    });

    expect(walletSummaryRequests).toBeGreaterThanOrEqual(3);
  });

  it('keeps the opened success message when mutate rejects during showdown revalidation', async () => {
    vi.resetModules();

    const signal = createSignal();
    const rejectingMutate = vi.fn(async () => {
      throw new Error('showdown_revalidate_failed');
    });

    vi.doMock('swr', async () => {
      const actual = await vi.importActual<typeof import('swr')>('swr');
      return {
        ...actual,
        useSWRConfig: () => ({
          cache: new Map(),
          mutate: rejectingMutate
        })
      };
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

        if (url === '/api/showdowns?status=all&limit=50') {
          return createJsonResponse({ showdowns: [] });
        }

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
              latestTxHash: null
            }
          });
        }

        if (url === '/api/run-agents') {
          return createJsonResponse({
            signals: [signal],
            showdowns: {
              discovery: {
                status: 'ok',
                result: {
                  discovered: 1,
                  opened: 1,
                  skips: []
                },
                reason: null
              }
            }
          });
        }

        if (url === `/api/wallet/${walletAddress}/summary`) {
          return createJsonResponse({
            walletAddress,
            follows: [],
            walletFollows: []
          });
        }

        throw new Error(`Unhandled fetch request: ${url}`);
      })
    );

    const { SWRConfig: DynamicSWRConfig } = await import('swr');
    const { ArenaDashboard: DynamicArenaDashboard } = await import('@/components/arena-dashboard');

    render(
      <DynamicSWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        <DynamicArenaDashboard />
      </DynamicSWRConfig>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Run Agents' }));

    await waitFor(() => {
      expect(rejectingMutate).toHaveBeenCalledWith('/api/showdowns?status=all&limit=50');
    });
    expect(
      screen.getByText('Generated 1 signal. Automatic discovery opened 1 showdown. Arena refreshed for live matches.')
    ).toBeInTheDocument();
    expect(screen.queryByText('showdown_revalidate_failed')).not.toBeInTheDocument();

    vi.doUnmock('swr');
  });
});
