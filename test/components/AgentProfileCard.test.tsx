import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentProfileCard } from '@/components/AgentProfileCard';
import type { AgentReputationProfile } from '@/lib/insights/readModels';

function createProfile(
  overrides: Partial<AgentReputationProfile> = {}
): AgentReputationProfile {
  return {
    agentName: 'volatility',
    displayName: 'Volatility Agent',
    generatedSignals: 14,
    committedSignals: 9,
    openSignals: 2,
    resolvedSignals: 7,
    accuracyBps: 6745,
    averageEdgeBps: 1820,
    totalBondedMicroUsdc: 125_000_000,
    refundedMicroUsdc: 75_000_000,
    slashedMicroUsdc: 50_000_000,
    paperRoiBps: 420,
    brierScoreBps: 1860,
    confidenceDistribution: {
      low: 2,
      medium: 4,
      high: 8
    },
    recentSignals: [],
    resolvedTrail: [],
    bestResolvedSignal: null,
    worstResolvedSignal: null,
    ...overrides
  };
}

describe('AgentProfileCard', () => {
  it('renders the summary fields required by the agents list and links to the drill-down route', () => {
    render(<AgentProfileCard profile={createProfile()} showdownsWon={3} />);

    const link = screen.getByRole('link', { name: /volatility agent/i });
    expect(link).toHaveAttribute('href', '/agents/volatility');
    expect(screen.getByText('Generated signals')).toBeInTheDocument();
    expect(screen.getByText('14')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('67.45%')).toBeInTheDocument();
    expect(screen.getByText('Bonded')).toBeInTheDocument();
    expect(screen.getByText('$125.00')).toBeInTheDocument();
    expect(screen.getByText('Showdowns won')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});
