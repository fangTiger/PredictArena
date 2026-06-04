import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PendingFollowsRow } from '@/components/PendingFollowsRow';

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

  it('shows up to three chips for pending or confirmed follows and links to /my', async () => {
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
    expect(within(row).getByText('Pending follows')).toBeInTheDocument();

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
});
