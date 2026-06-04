import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFollowChipKey, PendingFollowsRow } from '@/components/PendingFollowsRow';

function renderRow(walletAddress: string | null) {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <PendingFollowsRow walletAddress={walletAddress} />
    </SWRConfig>
  );
}

describe('PendingFollowsRow', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not render or fetch without a connected wallet', () => {
    renderRow(null);

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByTestId('pending-follows-row')).not.toBeInTheDocument();
  });

  it('fails soft on summary 404 or empty follows', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ reason: 'not_found' })
    } as Response);

    renderRow('0x1000000000000000000000000000000000000001');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/wallet/0x1000000000000000000000000000000000000001/summary'
      );
    });
    expect(screen.queryByTestId('pending-follows-row')).not.toBeInTheDocument();
  });

  it('shows up to three wallet follow chips and links to /my', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        follows: [
          {
            signalId: 'sig-1',
            marketQuestion: 'Will BTC close above $100,000 this week?',
            status: 'pending'
          },
          {
            signalId: 'sig-2',
            marketQuestion: 'Will ETH close above $5,000 this week?',
            status: 'confirmed'
          },
          {
            signalId: 'sig-3',
            marketQuestion: 'Will SOL close above $250 this week after a multi-session breakout confirmation?',
            status: 'pending'
          },
          {
            signalId: 'sig-4',
            marketQuestion: 'Resolved follow should stay hidden',
            status: 'resolved-loss'
          }
        ]
      })
    } as Response);

    renderRow('0x1000000000000000000000000000000000000001');

    const row = await screen.findByTestId('pending-follows-row');
    expect(within(row).getByText('Wallet follows')).toBeInTheDocument();

    const links = within(row).getAllByRole('link');
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveAttribute('href', '/my');
    }
    expect(within(row).getByText(/BTC close above/i)).toBeInTheDocument();
    expect(within(row).getByText(/ETH close above/i)).toBeInTheDocument();
    expect(within(row).getByText(/Will SOL close above \$250 this week after a.../i)).toBeInTheDocument();
    expect(within(row).queryByText(/Resolved follow should stay hidden/i)).not.toBeInTheDocument();
  });

  it('does not emit duplicate-key warnings for repeated historical follows on the same signal', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        follows: [
          {
            signalId: '2370667:momentum',
            marketQuestion: 'Will BTC close above $100,000 this week?',
            status: 'confirmed',
            walletAddress: '0x1000000000000000000000000000000000000001',
            txHash: '0xf011000000000000000000000000000000000000000000000000000000000001',
            followedAt: '2026-06-02T16:02:25.293Z'
          },
          {
            signalId: '2370667:momentum',
            marketQuestion: 'Will BTC close above $100,000 this week?',
            status: 'confirmed',
            walletAddress: '0x1000000000000000000000000000000000000001',
            txHash: '0xf011000000000000000000000000000000000000000000000000000000000002',
            followedAt: '2026-06-02T16:03:55.492Z'
          }
        ]
      })
    } as Response);

    const { unmount } = renderRow('0x1000000000000000000000000000000000000001');

    const row = await screen.findByTestId('pending-follows-row');
    expect(within(row).getAllByRole('link')).toHaveLength(2);
    const duplicateKeyWarnings = consoleError.mock.calls.filter(([message]) =>
      String(message).includes('Encountered two children with the same key')
    );
    expect(duplicateKeyWarnings).toHaveLength(0);
    unmount();
  });

  it('builds distinct stable keys for repeated confirmed follows on the same signal', () => {
    const firstKey = buildFollowChipKey(
      {
        signalId: '2370667:momentum',
        marketQuestion: 'Will BTC close above $100,000 this week?',
        status: 'confirmed',
        walletAddress: '0x1000000000000000000000000000000000000001',
        txHash: '0xf011000000000000000000000000000000000000000000000000000000000001',
        followedAt: '2026-06-02T16:02:25.293Z'
      },
      0
    );
    const secondKey = buildFollowChipKey(
      {
        signalId: '2370667:momentum',
        marketQuestion: 'Will BTC close above $100,000 this week?',
        status: 'confirmed',
        walletAddress: '0x1000000000000000000000000000000000000001',
        txHash: '0xf011000000000000000000000000000000000000000000000000000000000002',
        followedAt: '2026-06-02T16:03:55.492Z'
      },
      1
    );

    expect(firstKey).not.toBe(secondKey);
    expect(firstKey).toContain('confirmed:2370667:momentum');
    expect(secondKey).toContain('confirmed:2370667:momentum');
    expect(firstKey).toContain('0xf011000000000000000000000000000000000000000000000000000000000001');
    expect(secondKey).toContain('0xf011000000000000000000000000000000000000000000000000000000000002');
  });
});
