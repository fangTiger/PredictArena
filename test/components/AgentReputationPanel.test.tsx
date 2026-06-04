import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentReputationPanel } from '@/components/AgentReputationPanel';
import type {
  AgentReputationProfile,
  ReputationSignalSummary
} from '@/lib/insights/readModels';

function createSignalSummary(
  overrides: Partial<ReputationSignalSummary> = {}
): ReputationSignalSummary {
  return {
    signalId: 'signal-vol-1',
    marketQuestion: 'Will BTC close above $110,000 on June 30, 2026?',
    status: 'resolved_correct',
    side: 'YES',
    confidence: 'HIGH',
    edgeBps: 2200,
    stakeMicroUsdc: 40_000_000,
    txHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    createdAt: '2026-06-01T08:00:00.000Z',
    resolvedAt: '2026-06-02T08:00:00.000Z',
    outcomeCorrect: true,
    brierScoreBps: 1200,
    ...overrides
  };
}

function createProfile(
  overrides: Partial<AgentReputationProfile> = {}
): AgentReputationProfile {
  const bestResolvedSignal = createSignalSummary();
  const worstResolvedSignal = createSignalSummary({
    signalId: 'signal-vol-2',
    marketQuestion: 'Will ETH close above $5,000 on July 7, 2026?',
    side: 'NO',
    confidence: 'MEDIUM',
    edgeBps: 900,
    stakeMicroUsdc: 18_000_000,
    outcomeCorrect: false,
    brierScoreBps: 3800
  });

  return {
    agentName: 'volatility',
    displayName: 'Volatility Agent',
    generatedSignals: 18,
    committedSignals: 11,
    openSignals: 3,
    resolvedSignals: 8,
    accuracyBps: 6250,
    averageEdgeBps: 1715,
    totalBondedMicroUsdc: 240_000_000,
    refundedMicroUsdc: 150_000_000,
    slashedMicroUsdc: 90_000_000,
    paperRoiBps: 840,
    brierScoreBps: 1850,
    confidenceDistribution: {
      low: 3,
      medium: 5,
      high: 10
    },
    recentSignals: [bestResolvedSignal, worstResolvedSignal],
    resolvedTrail: [bestResolvedSignal, worstResolvedSignal],
    bestResolvedSignal,
    worstResolvedSignal,
    ...overrides
  };
}

describe('AgentReputationPanel', () => {
  it('renders core reputation metrics, confidence mix, and signal history for an agent drill-down', () => {
    render(<AgentReputationPanel profile={createProfile()} />);

    expect(screen.getByText('Volatility Agent')).toBeInTheDocument();
    expect(screen.getByText('Generated signals')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('Accuracy')).toBeInTheDocument();
    expect(screen.getByText('62.50%')).toBeInTheDocument();
    expect(screen.getByText('Confidence mix')).toBeInTheDocument();
    expect(screen.getByText('Low confidence')).toBeInTheDocument();
    expect(screen.getByText('Recent signals')).toBeInTheDocument();
    expect(
      screen.getAllByText('Will BTC close above $110,000 on June 30, 2026?').length
    ).toBeGreaterThan(0);
    expect(screen.getByText('Best resolved signal')).toBeInTheDocument();
    expect(screen.getByText('Worst resolved signal')).toBeInTheDocument();
  });
});
