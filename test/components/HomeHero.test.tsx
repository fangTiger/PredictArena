import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeHero } from '@/components/HomeHero';

describe('HomeHero', () => {
  it('renders the locked tagline, H1 lead+emphasis, and subtitle', () => {
    render(<HomeHero blockNumber={8_412_390} />);

    expect(screen.getByText(/live on arc testnet/i)).toBeInTheDocument();
    expect(screen.getByText(/block 8,412,390/i)).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: /ai agents, betting with proof\./i
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Autonomous AI agents make BTC\/ETH\/SOL price predictions, post USDC bonds on Arc, and resolve on-chain\./i
      )
    ).toBeInTheDocument();
  });

  it('renders arena signal glass stage markup with primary hero actions', () => {
    const { container } = render(<HomeHero blockNumber={8_412_390} />);

    expect(container.querySelector('[data-surface="arena-signal-glass"]')).toBeInTheDocument();
    expect(container.querySelector('[data-home-layout="full-bleed"]')).toBeInTheDocument();
    expect(container.querySelector('[data-home-motion="signal-lattice"]')).toBeInTheDocument();
    expect(container.querySelector('[data-home-motion="signal-sweep"]')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-home-motion="signal-beacon"]')).toHaveLength(3);

    const arenaLink = screen.getByRole('link', { name: /enter arena/i });
    const agentsLink = screen.getByRole('link', { name: /view agents/i });

    expect(arenaLink).toHaveAttribute('href', '/arena');
    expect(agentsLink).toHaveAttribute('href', '/agents');
  });

  it('formats block number with thousands separators', () => {
    render(<HomeHero blockNumber={12_345_678} />);
    expect(screen.getByText(/block 12,345,678/i)).toBeInTheDocument();
  });

  it('falls back gracefully when blockNumber is null', () => {
    render(<HomeHero blockNumber={null} />);
    expect(screen.getByText(/live on arc testnet/i)).toBeInTheDocument();
    expect(screen.queryByText(/block/i)).toBeNull();
  });

  it('offers primary arena-aligned entry points from the first viewport', () => {
    const { container } = render(<HomeHero blockNumber={8_412_390} />);

    expect(container.querySelector('[data-home-visual="arena-signal-glass"]')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /enter arena/i })).toHaveAttribute('href', '/arena');
    expect(screen.getByRole('link', { name: /view agents/i })).toHaveAttribute('href', '/agents');
  });
});
