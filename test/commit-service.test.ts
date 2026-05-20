import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInMemoryStore } from '@/lib/server/store/memory-store';
import { commitSignalAndLoadDashboardState } from '@/lib/services/commit-service';
import type { ArenaSignal, ParsedMarket, ScanRecord } from '@/types/predictarena';

const scan: ScanRecord = {
  id: 'scan-1',
  source: 'live',
  liveMarketCount: 1,
  parsedMarketCount: 1,
  skippedMarketCount: 0,
  createdAt: '2026-05-20T00:00:00.000Z'
};

const market: ParsedMarket = {
  id: 'market-eth-4k',
  eventId: 'event-eth-4k',
  slug: 'eth-above-4k',
  question: 'Will ETH be above $4,000 on July 1, 2026?',
  asset: 'ETH',
  direction: 'ABOVE',
  thresholdCents: 400_000,
  expiryAt: '2026-07-01T23:59:00.000Z',
  yesPriceBps: 5600,
  noPriceBps: 4400,
  liquidityScoreBps: 8300,
  parseConfidenceBps: 9400,
  source: 'live',
  rawPayload: { origin: 'test' }
};

function createCommittedSignal(
  overrides: Partial<ArenaSignal> = {}
): ArenaSignal {
  return {
    id: 'signal-market-eth-4k',
    marketId: market.id,
    decision: 'BUY_YES',
    yesProbabilityBps: 7800,
    noProbabilityBps: 2200,
    confidenceBps: 7800,
    edgeBps: 1800,
    eligibleForCommit: true,
    bondAmountMicroUsdc: 25_000_000,
    agentScoreBps: 7800,
    reasons: ['test reason'],
    createdAt: '2026-05-20T01:00:00.000Z',
    commitmentStatus: 'committed',
    ...overrides
  };
}

describe('commitSignalAndLoadDashboardState', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns disabled result when the signal status is already committed', async () => {
    vi.stubEnv('ARC_PRIVATE_KEY', '');
    vi.stubEnv('ARC_SIGNAL_BOND_VAULT_ADDRESS', '');

    const store = createInMemoryStore({
      latestScan: scan,
      markets: [market],
      signals: [
        createCommittedSignal({
          committedTxHash: undefined,
          commitmentStatus: 'committed'
        })
      ]
    });

    const state = await commitSignalAndLoadDashboardState(store, 'signal-market-eth-4k');

    expect(state.lastCommitResult).toEqual({
      status: 'disabled',
      signalId: 'signal-market-eth-4k',
      reason: 'Signal already committed'
    });
  });

  it('returns disabled result when the signal already has a tx hash', async () => {
    vi.stubEnv('ARC_PRIVATE_KEY', '');
    vi.stubEnv('ARC_SIGNAL_BOND_VAULT_ADDRESS', '');

    const store = createInMemoryStore({
      latestScan: scan,
      markets: [market],
      signals: [
        createCommittedSignal({
          committedTxHash: '0xabc123',
          commitmentStatus: 'not_started'
        })
      ]
    });

    const state = await commitSignalAndLoadDashboardState(store, 'signal-market-eth-4k');

    expect(state.lastCommitResult).toEqual({
      status: 'disabled',
      signalId: 'signal-market-eth-4k',
      reason: 'Signal already committed'
    });
  });
});
