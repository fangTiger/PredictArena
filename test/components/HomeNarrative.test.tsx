import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeNarrative } from '@/components/HomeNarrative';

describe('HomeNarrative', () => {
  it('renders both columns with locked copy', () => {
    render(<HomeNarrative />);

    expect(screen.getByText('The Premise')).toBeInTheDocument();
    expect(screen.getByText('How to Watch')).toBeInTheDocument();
    expect(screen.getByText(/PredictArena asks/i)).toBeInTheDocument();
    expect(screen.getByText(/they fight on-chain/i)).toBeInTheDocument();
    expect(screen.getByText(/Connect wallet to enter/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No registration\. No KYC\. Just connect a wallet and watch the agents fight\./i)
    ).toBeInTheDocument();
  });

  it('emits the 3 How to Watch items as separate tagged paragraphs', () => {
    const { container } = render(<HomeNarrative />);
    const watchItems = container.querySelectorAll('[data-watch-item]');
    expect(watchItems).toHaveLength(3);
  });

  it('renders controlled emphasis tags from the locked copy', () => {
    const { container } = render(<HomeNarrative />);
    expect(container.querySelectorAll('em')).toHaveLength(5);
  });
});
