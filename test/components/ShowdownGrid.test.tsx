import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShowdownGrid } from '@/components/ShowdownGrid';

function createShowdown(
  id: string,
  overrides: Partial<React.ComponentProps<typeof ShowdownGrid>['showdowns'][number]> = {}
) {
  return {
    id,
    onchainId: Number(id.replace(/\D/g, '')) || 1,
    marketId: `market-${id}`,
    marketQuestion: `Question ${id}`,
    agentA: {
      name: 'Volatility',
      side: 'YES',
      probabilityBps: 6500,
      confidence: 'HIGH',
      thesis: `Agent A thesis ${id}`
    },
    agentB: {
      name: 'Momentum',
      side: 'NO',
      probabilityBps: 3500,
      confidence: 'MEDIUM',
      thesis: `Agent B thesis ${id}`
    },
    bondMicroUsdc: '150000000',
    deadline: '2026-06-10T12:00:00.000Z',
    status: 'Open',
    openedAt: `2026-06-${String(10 + (Number(id.replace(/\D/g, '')) || 1)).padStart(2, '0')}T10:00:00.000Z`,
    settledAt: null,
    openTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890cafe',
    settleTxHash: null,
    resolvedOutcome: null,
    resolvedPriceLabel: null,
    ...overrides
  };
}

describe('ShowdownGrid', () => {
  it('renders friendly loading, error, and empty states', () => {
    const { rerender } = render(<ShowdownGrid showdowns={[]} loading />);
    expect(screen.getByText('Loading showdowns...')).toBeInTheDocument();

    rerender(<ShowdownGrid showdowns={[]} error="boom" />);
    expect(screen.getByText('Showdowns are temporarily unavailable')).toBeInTheDocument();

    rerender(<ShowdownGrid showdowns={[]} />);
    expect(screen.getByText('No showdowns are open yet.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Run Agents only generates signals. Showdowns appear after admin or cron discovery opens the onchain match.'
      )
    ).toBeInTheDocument();
  });

  it('shows active above settled, keeps sections as layout containers, and expands both lists via show more', () => {
    const active = Array.from({ length: 6 }, (_, index) =>
      createShowdown(`active-${index + 1}`, {
        marketQuestion: `Active showdown ${index + 1}`,
        deadline: `2026-06-${String(11 + index).padStart(2, '0')}T12:00:00.000Z`,
        openedAt: `2026-06-${String(11 + index).padStart(2, '0')}T10:00:00.000Z`
      })
    );
    const settled = Array.from({ length: 6 }, (_, index) =>
      createShowdown(`settled-${index + 1}`, {
        marketQuestion: `Settled showdown ${index + 1}`,
        status: index % 2 === 0 ? 'SettledA' : 'SettledB',
        settledAt: `2026-06-${String(20 - index).padStart(2, '0')}T14:00:00.000Z`,
        resolvedOutcome: index % 2 === 0 ? 'YES' : 'NO',
        resolvedPriceLabel: `Resolution ${index + 1}`,
        settleTxHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefbeef'
      })
    );

    render(<ShowdownGrid showdowns={[...active, ...settled]} />);

    const activeSection = screen.getByTestId('showdown-grid-active');
    const settledSection = screen.getByTestId('showdown-grid-settled');

    expect(within(activeSection).getByText('Active Showdowns')).toBeInTheDocument();
    expect(within(settledSection).getByText('Settled Showdowns')).toBeInTheDocument();
    expect(activeSection).not.toHaveClass('glass-card');
    expect(settledSection).not.toHaveClass('glass-card');
    expect(within(activeSection).getAllByTestId('showdown-card')).toHaveLength(5);
    expect(within(settledSection).getAllByTestId('showdown-card')).toHaveLength(5);
    expect(within(activeSection).queryByText('Active showdown 6')).not.toBeInTheDocument();
    expect(within(settledSection).queryByText('Settled showdown 6')).not.toBeInTheDocument();

    fireEvent.click(within(activeSection).getByRole('button', { name: 'Show more (1)' }));

    expect(within(activeSection).getAllByTestId('showdown-card')).toHaveLength(6);
    expect(within(activeSection).getByText('Active showdown 6')).toBeInTheDocument();

    fireEvent.click(within(settledSection).getByRole('button', { name: 'Show more (1)' }));

    expect(within(settledSection).getAllByTestId('showdown-card')).toHaveLength(6);
    expect(within(settledSection).getByText('Settled showdown 6')).toBeInTheDocument();
  });
});
