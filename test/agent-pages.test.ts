import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ArenaState, PersistenceStore, ShowdownRecord } from '@/lib/persistence/store';
import { resetRuntimeStoreForTests, setRuntimeStoreForTests } from '@/lib/persistence/store';
import { __setShowdownStoreForTests } from '@/lib/persistence/showdowns';

const navigationMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
}));

vi.mock('next/navigation', () => ({
  notFound: navigationMocks.notFound
}));

import AgentsPage from '@/app/agents/page';
import AgentDetailPage from '@/app/agents/[agentId]/page';

const originalShowdownPersistenceMode = process.env.SHOWDOWN_PERSISTENCE_MODE;

function restoreShowdownPersistenceMode(originalValue: string | undefined) {
  if (originalValue === undefined) {
    delete process.env.SHOWDOWN_PERSISTENCE_MODE;
    return;
  }

  process.env.SHOWDOWN_PERSISTENCE_MODE = originalValue;
}

function createState(): ArenaState {
  return {
    markets: [],
    autonomyRuns: [],
    signals: [
      {
        id: 'vol-1',
        runId: 'run-1',
        marketId: 'btc-1',
        marketQuestion: 'Will BTC close above $110,000 on June 30, 2026?',
        marketUrl: 'https://example.com/btc-1',
        asset: 'BTC',
        conditionType: 'EXPIRY_ABOVE',
        thresholdUsd: 110000,
        expiresAt: '2026-06-30T12:00:00.000Z',
        agentName: 'volatility',
        modelVersion: 'volatility-gbm-v1',
        modelParams: { sigma: 1.1 },
        modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
        dataHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        side: 'YES',
        status: 'resolved_correct',
        confidence: 'HIGH',
        confidenceBps: 7800,
        marketPriceBps: 6000,
        agentProbabilityBps: 7400,
        yesPriceBps: 6000,
        pYesBps: 7400,
        edgeBps: 1400,
        kellyBps: 250,
        stakeMicroUsdc: 40_000_000,
        riskFlags: [],
        arcTxHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        createdAt: '2026-06-01T08:00:00.000Z',
        updatedAt: '2026-06-01T08:00:00.000Z',
        source: 'live',
        resolution: {
          outcomeCorrect: true,
          yesOutcome: true,
          resolvedAt: '2026-06-02T08:00:00.000Z',
          source: 'automatic'
        }
      },
      {
        id: 'vol-2',
        runId: 'run-2',
        marketId: 'eth-1',
        marketQuestion: 'Will ETH close above $5,000 on July 7, 2026?',
        marketUrl: 'https://example.com/eth-1',
        asset: 'ETH',
        conditionType: 'EXPIRY_ABOVE',
        thresholdUsd: 5000,
        expiresAt: '2026-07-07T12:00:00.000Z',
        agentName: 'volatility',
        modelVersion: 'volatility-gbm-v1',
        modelParams: { sigma: 1.4 },
        modelHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
        dataHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        side: 'NO',
        status: 'generated',
        confidence: 'MEDIUM',
        confidenceBps: 6200,
        marketPriceBps: 5100,
        agentProbabilityBps: 4300,
        yesPriceBps: 5100,
        pYesBps: 4300,
        edgeBps: 800,
        kellyBps: 120,
        stakeMicroUsdc: 25_000_000,
        riskFlags: [],
        arcTxHash: null,
        createdAt: '2026-06-03T08:00:00.000Z',
        updatedAt: '2026-06-03T08:00:00.000Z',
        source: 'live',
        resolution: null
      },
      {
        id: 'mom-1',
        runId: 'run-3',
        marketId: 'sol-1',
        marketQuestion: 'Will SOL close above $180 on July 12, 2026?',
        marketUrl: 'https://example.com/sol-1',
        asset: 'SOL',
        conditionType: 'EXPIRY_ABOVE',
        thresholdUsd: 180,
        expiresAt: '2026-07-12T12:00:00.000Z',
        agentName: 'momentum',
        modelVersion: 'momentum-gbm-v1',
        modelParams: { drift: 0.2 },
        modelHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
        dataHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        side: 'YES',
        status: 'resolved_incorrect',
        confidence: 'HIGH',
        confidenceBps: 8100,
        marketPriceBps: 4700,
        agentProbabilityBps: 6600,
        yesPriceBps: 4700,
        pYesBps: 6600,
        edgeBps: 1900,
        kellyBps: 310,
        stakeMicroUsdc: 50_000_000,
        riskFlags: [],
        arcTxHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        createdAt: '2026-06-02T08:00:00.000Z',
        updatedAt: '2026-06-02T08:00:00.000Z',
        source: 'live',
        resolution: {
          outcomeCorrect: false,
          yesOutcome: false,
          resolvedAt: '2026-06-04T08:00:00.000Z',
          source: 'automatic'
        }
      }
    ]
  };
}

function createShowdowns(): ShowdownRecord[] {
  return [
    {
      externalId: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      onchainId: 1,
      marketId: 'btc-1',
      marketQuestion: 'Will BTC close above $110,000 on June 30, 2026?',
      agentA: {
        address: '0x1000000000000000000000000000000000000001',
        name: 'volatility',
        side: 'YES',
        probabilityBps: 7400
      },
      agentB: {
        address: '0x2000000000000000000000000000000000000002',
        name: 'momentum',
        side: 'NO',
        probabilityBps: 4200
      },
      bondPerSideMicroUsdc: 25_000_000,
      deadline: '2026-06-30T12:00:00.000Z',
      status: 'SettledA',
      openedAt: '2026-06-01T09:00:00.000Z',
      settledAt: '2026-06-02T09:00:00.000Z',
      openTxHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
      settleTxHash: '0x5555555555555555555555555555555555555555555555555555555555555555',
      resolvedOutcome: 'YES',
      resolvedPriceLabel: 'BTC settled at $111,200'
    },
    {
      externalId: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      onchainId: 2,
      marketId: 'sol-1',
      marketQuestion: 'Will SOL close above $180 on July 12, 2026?',
      agentA: {
        address: '0x1000000000000000000000000000000000000001',
        name: 'volatility',
        side: 'NO',
        probabilityBps: 4900
      },
      agentB: {
        address: '0x2000000000000000000000000000000000000002',
        name: 'momentum',
        side: 'YES',
        probabilityBps: 6600
      },
      bondPerSideMicroUsdc: 35_000_000,
      deadline: '2026-07-12T12:00:00.000Z',
      status: 'SettledB',
      openedAt: '2026-06-02T09:00:00.000Z',
      settledAt: '2026-06-04T09:00:00.000Z',
      openTxHash: '0x6666666666666666666666666666666666666666666666666666666666666666',
      settleTxHash: '0x7777777777777777777777777777777777777777777777777777777777777777',
      resolvedOutcome: 'YES',
      resolvedPriceLabel: 'SOL settled at $181.50'
    }
  ];
}

function setStores(
  state: ArenaState,
  showdowns: ShowdownRecord[] | Error = createShowdowns()
) {
  setRuntimeStoreForTests({
    getArenaState: vi.fn(async () => state)
  } as unknown as PersistenceStore);

  __setShowdownStoreForTests({
    listAll:
      showdowns instanceof Error
        ? vi.fn(async () => {
            throw showdowns;
          })
        : vi.fn(async () => showdowns)
  } as any);
}

afterEach(() => {
  resetRuntimeStoreForTests();
  __setShowdownStoreForTests(null);
  navigationMocks.notFound.mockClear();
  restoreShowdownPersistenceMode(originalShowdownPersistenceMode);
});

describe('agent routes', () => {
  it('must restore showdown persistence mode to an unset state when the original value is undefined', () => {
    const originalValue = undefined;

    try {
      process.env.SHOWDOWN_PERSISTENCE_MODE = 'supabase';
      restoreShowdownPersistenceMode(originalValue);

      expect(process.env.SHOWDOWN_PERSISTENCE_MODE).toBeUndefined();
      expect(
        Object.prototype.hasOwnProperty.call(process.env, 'SHOWDOWN_PERSISTENCE_MODE')
      ).toBe(false);
    } finally {
      restoreShowdownPersistenceMode(originalShowdownPersistenceMode);
    }
  });

  it('renders one reputation card per known agent and includes showdown win counts', async () => {
    setStores(createState());

    const html = renderToStaticMarkup(await AgentsPage());

    expect(html).toContain('Volatility Agent');
    expect(html).toContain('Momentum Agent');
    expect(html).toContain('/agents/volatility');
    expect(html).toContain('/agents/momentum');
    expect(html).toMatch(/Volatility Agent[\s\S]*Showdowns won[\s\S]*1/);
    expect(html).toMatch(/Momentum Agent[\s\S]*Showdowns won[\s\S]*1/);
  });

  it('degrades to an empty showdown list when showdown store reads fail', async () => {
    setStores(createState(), new Error('store unavailable'));

    const html = renderToStaticMarkup(await AgentsPage());

    expect(html).toContain('Volatility Agent');
    expect(html).toContain('Momentum Agent');
    expect(html).toMatch(/Showdowns won[\s\S]*0/);
  });

  it('degrades to an empty showdown list when getShowdownStore throws synchronously', async () => {
    setRuntimeStoreForTests({
      getArenaState: vi.fn(async () => createState())
    } as unknown as PersistenceStore);
    __setShowdownStoreForTests(null);
    process.env.SHOWDOWN_PERSISTENCE_MODE = 'supabase';

    const html = renderToStaticMarkup(await AgentsPage());

    expect(html).toContain('Volatility Agent');
    expect(html).toContain('Momentum Agent');
    expect(html).toMatch(/Showdowns won[\s\S]*0/);
  });

  it('renders the drill-down panel for a supported agent id and calls notFound for unknown ids', async () => {
    setStores(createState());

    const html = renderToStaticMarkup(
      await AgentDetailPage({
        params: Promise.resolve({ agentId: 'volatility' })
      })
    );

    expect(html).toContain('Volatility Agent');
    expect(html).toContain('Recent signals');
    expect(html).toContain('Best resolved signal');

    await expect(
      AgentDetailPage({
        params: Promise.resolve({ agentId: 'unknown-agent' })
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
    expect(navigationMocks.notFound).toHaveBeenCalledTimes(1);
  });
});
