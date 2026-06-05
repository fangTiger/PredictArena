import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ArcControlRoomState } from '@/lib/arc/controlRoom';

const mockState = vi.hoisted(() => ({
  controlRoom: null as ArcControlRoomState | null
}));

vi.mock('@/lib/arc/controlRoom', () => ({
  getArcControlRoomState: vi.fn(async () => {
    if (!mockState.controlRoom) {
      throw new Error('control room mock not configured');
    }

    return mockState.controlRoom;
  })
}));

vi.mock('@/components/TxLink', () => ({
  TxLink: ({ hash }: { hash: `0x${string}` | null }) =>
    React.createElement('span', null, hash ?? 'Pending')
}));

import AdminControlRoomPage from '@/app/admin/control-room/page';
import { ShowdownDiscoveryConsole } from '@/app/admin/control-room/ShowdownDiscoveryConsole';

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

function createJsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      'content-type': 'application/json'
    },
    ...init
  });
}

beforeEach(() => {
  mockState.controlRoom = createControlRoomState();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('ShowdownDiscoveryConsole', () => {
  it('renders the Discover Showdowns entry inside /admin/control-room', async () => {
    const html = renderToStaticMarkup(await AdminControlRoomPage());

    expect(html).toContain('Discover Showdowns');
    expect(html).toContain('Operator Open Trigger');
    expect(html).toContain('Automatic discovery already runs after Run Agents');
    expect(html).toContain('manual diagnostic/override');
  });

  it('posts showdown discovery and renders opened, discovered, and skip summaries', async () => {
    const fetchMock = vi.fn(async () =>
      createJsonResponse({
        discovered: 3,
        opened: 2,
        skips: [
          { marketId: 'btc-1', reason: 'existing-open' },
          { marketId: 'eth-1', reason: 'budget-exhausted' },
          { marketId: 'eth-2', reason: 'budget-exhausted', detail: 'momentum wallet at cap' }
        ]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ShowdownDiscoveryConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'Discover Showdowns' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/showdowns/discover',
      expect.objectContaining({
        method: 'POST'
      })
    );
    await waitFor(() => {
      expect(screen.getByText('Discovery complete')).toBeInTheDocument();
    });

    expect(screen.getByRole('link', { name: 'Open Arena' })).toHaveAttribute('href', '/arena');
    expect(screen.getByText('Back to /arena to review opened showdowns.')).toBeInTheDocument();

    const discoveredMetric = screen.getByText('Discovered').closest('div');
    const openedMetric = screen.getByText('Opened').closest('div');
    const skipsMetric = screen.getByText('Skips').closest('div');

    expect(discoveredMetric).toHaveTextContent('3');
    expect(openedMetric).toHaveTextContent('2');
    expect(skipsMetric).toHaveTextContent('3');
    expect(screen.getByText('existing-open')).toBeInTheDocument();
    expect(screen.getByText('budget-exhausted')).toBeInTheDocument();
    expect(
      screen.getByText('2 skipped markets. Latest: eth-2. momentum wallet at cap')
    ).toBeInTheDocument();
  });

  it('surfaces the discovery failure reason when the admin endpoint rejects the request', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        createJsonResponse(
          {
            reason: 'admin_access_not_configured'
          },
          { status: 503 }
        )
      )
    );

    render(<ShowdownDiscoveryConsole />);

    fireEvent.click(screen.getByRole('button', { name: 'Discover Showdowns' }));

    await waitFor(() => {
      expect(screen.getByText('Discovery blocked')).toBeInTheDocument();
    });

    expect(screen.getByText('admin_access_not_configured')).toBeInTheDocument();
  });
});
