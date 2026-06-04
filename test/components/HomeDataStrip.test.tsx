import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeDataStrip } from '@/components/HomeDataStrip';

describe('HomeDataStrip', () => {
  const baseProps = {
    activeSignals: 12,
    activeSignalsDelta: 3,
    usdcBondedMicro: 24_580_000_000n,
    usdcBondedDelta24hMicro: 1_200_000_000n,
    accuracyBps: 6840,
    accuracyDeltaPp: 2.1,
    showdownsWon: 47,
    showdownsLeaderName: 'Volatility'
  } as const;

  it('renders all 4 columns with correct labels and values', () => {
    render(<HomeDataStrip {...baseProps} />);

    expect(screen.getByText('ACTIVE SIGNALS')).toBeInTheDocument();
    expect(screen.getByText(/^12$/)).toBeInTheDocument();
    expect(screen.getByText('USDC BONDED')).toBeInTheDocument();
    expect(screen.getByText('24,580')).toBeInTheDocument();
    expect(screen.getByText('AGENT ACCURACY')).toBeInTheDocument();
    expect(screen.getByText('68.4%')).toBeInTheDocument();
    expect(screen.getByText('SHOWDOWNS WON')).toBeInTheDocument();
    expect(screen.getByText(/^47$/)).toBeInTheDocument();
    expect(screen.getByText(/volatility leads/i)).toBeInTheDocument();
  });

  it('marks live cells and the placeholder showdown cell distinctly', () => {
    render(<HomeDataStrip {...baseProps} />);

    expect(screen.getByText('ACTIVE SIGNALS').closest('[data-strip-cell]')).toHaveAttribute(
      'data-source',
      'live'
    );
    expect(screen.getByText('USDC BONDED').closest('[data-strip-cell]')).toHaveAttribute(
      'data-source',
      'live'
    );
    expect(screen.getByText('AGENT ACCURACY').closest('[data-strip-cell]')).toHaveAttribute(
      'data-source',
      'live'
    );
    expect(screen.getByText('SHOWDOWNS WON').closest('[data-strip-cell]')).toHaveAttribute(
      'data-source',
      'placeholder'
    );
  });

  it('formats USDC with thousands separators as whole USDC labels', () => {
    render(<HomeDataStrip {...baseProps} usdcBondedMicro={1_234_567_499_999n} />);
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });
});
