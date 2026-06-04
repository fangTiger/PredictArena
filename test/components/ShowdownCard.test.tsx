import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ShowdownCard } from '@/components/ShowdownCard';

function createShowdown(
  overrides: Partial<React.ComponentProps<typeof ShowdownCard>['showdown']> = {}
) {
  return {
    id: 'showdown-btc-1',
    onchainId: 7,
    marketId: 'market-btc-100k',
    marketQuestion: 'Will BTC close above $100,000 on June 6?',
    agentA: {
      name: 'Volatility',
      side: 'YES',
      probabilityBps: 7200,
      confidence: 'HIGH',
      thesis: 'Convex carry into expiry.'
    },
    agentB: {
      name: 'Momentum',
      side: 'NO',
      probabilityBps: 3100,
      confidence: 'MEDIUM',
      thesis: 'Spot exhaustion is already visible.'
    },
    bondMicroUsdc: '250000000',
    deadline: '2099-06-06T12:00:00.000Z',
    status: 'Open',
    openedAt: '2099-06-04T10:00:00.000Z',
    settledAt: null,
    openTxHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890cafe',
    settleTxHash: null,
    resolvedOutcome: null,
    resolvedPriceLabel: null,
    ...overrides
  };
}

describe('ShowdownCard', () => {
  it('renders an open showdown with agent details, utc deadline, and compact tx hash', () => {
    render(<ShowdownCard showdown={createShowdown()} />);

    expect(screen.getByText('Will BTC close above $100,000 on June 6?')).toBeInTheDocument();
    expect(screen.getByText('SHOWDOWN')).toBeInTheDocument();
    const deadlineMetric = screen.getByText('Deadline UTC').closest('.showdown-card-metric');
    expect(deadlineMetric).not.toBeNull();
    expect(deadlineMetric).toHaveTextContent('Deadline UTC');
    expect(deadlineMetric).toHaveTextContent('UTC');
    expect(screen.getByText('Bond per side')).toBeInTheDocument();
    expect(screen.getByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('Combined pot')).toBeInTheDocument();
    expect(screen.getByText('$500.00')).toBeInTheDocument();

    const agentA = screen.getByTestId('showdown-agent-a');
    expect(within(agentA).getByText('Volatility')).toBeInTheDocument();
    expect(within(agentA).getByText('YES')).toBeInTheDocument();
    expect(within(agentA).getByText('HIGH')).toBeInTheDocument();
    expect(within(agentA).getByText('Convex carry into expiry.')).toBeInTheDocument();
    expect(within(agentA).getByText('72.00%')).toHaveStyle({ color: 'var(--color-yes)' });

    const agentB = screen.getByTestId('showdown-agent-b');
    expect(within(agentB).getByText('Momentum')).toBeInTheDocument();
    expect(within(agentB).getByText('NO')).toBeInTheDocument();
    expect(within(agentB).getByText('MEDIUM')).toBeInTheDocument();
    expect(within(agentB).getByText('Spot exhaustion is already visible.')).toBeInTheDocument();
    expect(within(agentB).getByText('31.00%')).toHaveStyle({ color: 'var(--color-no)' });

    const openHash = screen.getByText('0x123456...cafe');
    expect(openHash.tagName).toBe('CODE');
  });

  it('renders settled outcomes with winner payout, loser forfeit, and resolution footer', () => {
    render(
      <ShowdownCard
        showdown={createShowdown({
          status: 'SettledB',
          settledAt: '2099-06-06T12:15:00.000Z',
          settleTxHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefbeef',
          resolvedOutcome: 'NO',
          resolvedPriceLabel: 'BTC settled at $97,000'
        })}
      />
    );

    expect(screen.getByText('RESOLVED')).toBeInTheDocument();
    expect(screen.getByText('BTC settled at $97,000')).toBeInTheDocument();
    expect(screen.getByText('Settlement UTC')).toBeInTheDocument();
    expect(screen.getByText('0xabcdef...beef')).toBeInTheDocument();

    const agentA = screen.getByTestId('showdown-agent-a');
    expect(within(agentA).getByText('- $250.00 USDC')).toBeInTheDocument();
    expect(within(agentA).getByText('Forfeit')).toBeInTheDocument();

    const agentB = screen.getByTestId('showdown-agent-b');
    expect(within(agentB).getByText('+ $500.00 USDC')).toBeInTheDocument();
    expect(within(agentB).getByText('Winner payout')).toBeInTheDocument();
  });
});
