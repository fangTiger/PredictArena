import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  discoverShowdowns,
  type DiscoveryDeps,
  type OpenOnChainInput,
  type OpenOnChainResult
} from '@/lib/services/showdownDiscovery';
import type { ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';
import type { AgentSignal } from '@/lib/polymarket/types';

const NOW_MS = Date.parse('2026-06-04T12:00:00.000Z');
const VOL_KEY = `0x${'1'.repeat(64)}` as const;
const MOM_KEY = `0x${'2'.repeat(64)}` as const;
const OPEN_TX = `0x${'d'.repeat(64)}` as const;

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    id: `signal-${Math.random().toString(16).slice(2)}`,
    runId: 'run-1',
    marketId: 'market-btc-100k',
    marketQuestion: 'Will BTC close above $100,000?',
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 100000,
    expiresAt: '2026-06-10T00:00:00.000Z',
    agentName: 'volatility',
    modelVersion: 'v1',
    modelParams: {},
    modelHash: `0x${'3'.repeat(64)}`,
    dataHash: `0x${'4'.repeat(64)}`,
    side: 'YES',
    status: 'generated',
    confidence: 'HIGH',
    confidenceBps: 8000,
    marketPriceBps: 5000,
    agentProbabilityBps: 7000,
    yesPriceBps: 5000,
    pYesBps: 7000,
    edgeBps: 2000,
    kellyBps: 300,
    stakeMicroUsdc: 50_000_000,
    riskFlags: [],
    arcTxHash: null,
    createdAt: '2026-06-04T11:00:00.000Z',
    updatedAt: '2026-06-04T11:00:00.000Z',
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

function createShowdownStore(overrides: Partial<ShowdownStore> = {}): ShowdownStore {
  return {
    insert: vi.fn(async () => undefined),
    updateOnSettle: vi.fn(async () => undefined),
    listAll: vi.fn(async () => []),
    findByOnchainId: vi.fn(async () => undefined),
    hasOpenBetween: vi.fn(async () => false),
    ...overrides
  };
}

function makeDeps(overrides: Partial<DiscoveryDeps> = {}): DiscoveryDeps {
  const showdownStore = createShowdownStore();

  return {
    listActiveSignals: async () => [],
    showdownStore,
    openOnChain: vi.fn(async (input: OpenOnChainInput): Promise<OpenOnChainResult> => ({
      onchainId: 11,
      txHash: OPEN_TX,
      openedAt: new Date(NOW_MS).toISOString()
    })),
    getAgentRemainingBudget: vi.fn(async () => 1_000_000_000n),
    bondPerSideMicroUsdc: 250_000_000n,
    deadlineWindowSec: 86_400,
    nowMs: () => NOW_MS,
    isOperatorGasOk: vi.fn(async () => true),
    ...overrides
  };
}

describe('discoverShowdowns', () => {
  let previousVolKey: string | undefined;
  let previousMomentumKey: string | undefined;

  beforeEach(() => {
    previousVolKey = process.env.VOL_AGENT_PRIVATE_KEY;
    previousMomentumKey = process.env.MOMENTUM_AGENT_PRIVATE_KEY;
    process.env.VOL_AGENT_PRIVATE_KEY = VOL_KEY;
    process.env.MOMENTUM_AGENT_PRIVATE_KEY = MOM_KEY;
  });

  afterEach(() => {
    if (previousVolKey === undefined) {
      delete process.env.VOL_AGENT_PRIVATE_KEY;
    } else {
      process.env.VOL_AGENT_PRIVATE_KEY = previousVolKey;
    }

    if (previousMomentumKey === undefined) {
      delete process.env.MOMENTUM_AGENT_PRIVATE_KEY;
    } else {
      process.env.MOMENTUM_AGENT_PRIVATE_KEY = previousMomentumKey;
    }
  });

  it('returns no-active-signals when no usable signals remain after filtering', async () => {
    const result = await discoverShowdowns(
      makeDeps({
        listActiveSignals: async () => [
          createSignal({ id: 'avoid', side: 'AVOID' }),
          createSignal({
            id: 'resolved',
            side: 'NO',
            status: 'resolved_correct',
            resolution: {
              outcomeCorrect: true,
              yesOutcome: false,
              resolvedAt: '2026-06-04T10:00:00.000Z'
            }
          })
        ]
      })
    );

    expect(result).toEqual({
      discovered: 0,
      opened: 0,
      skips: [{ marketId: '*', reason: 'no-active-signals' }]
    });
  });

  it('returns no-pair when a market only has one usable active signal', async () => {
    const result = await discoverShowdowns(
      makeDeps({
        listActiveSignals: async () => [createSignal({ id: 'solo' })]
      })
    );

    expect(result.opened).toBe(0);
    expect(result.skips).toEqual([{ marketId: 'market-btc-100k', reason: 'no-pair' }]);
  });

  it('returns same-side when agents agree on direction', async () => {
    const result = await discoverShowdowns(
      makeDeps({
        listActiveSignals: async () => [
          createSignal({ id: 'vol-yes', agentName: 'volatility', side: 'YES', agentProbabilityBps: 7200 }),
          createSignal({ id: 'mom-yes', agentName: 'momentum', side: 'YES', agentProbabilityBps: 6100 })
        ]
      })
    );

    expect(result.opened).toBe(0);
    expect(result.skips).toEqual([{ marketId: 'market-btc-100k', reason: 'same-side' }]);
  });

  it('returns existing-open when the same market pair already has an open showdown', async () => {
    const showdownStore = createShowdownStore({
      hasOpenBetween: vi.fn(async () => true)
    });

    const result = await discoverShowdowns(
      makeDeps({
        showdownStore,
      listActiveSignals: async () => [
          createSignal({
            id: 'vol',
            agentName: 'volatility',
            side: 'YES',
            confidence: 'HIGH',
            agentProbabilityBps: 7200,
            marketPriceBps: 5200,
            edgeBps: 2000,
            kellyBps: 300
          }),
          createSignal({
            id: 'mom',
            agentName: 'momentum',
            side: 'NO',
            confidence: 'MEDIUM',
            agentProbabilityBps: 3100,
            marketPriceBps: 6900,
            edgeBps: 3800,
            kellyBps: 250
          })
        ]
      })
    );

    expect(result.discovered).toBe(1);
    expect(result.opened).toBe(0);
    expect(result.skips).toEqual([{ marketId: 'market-btc-100k', reason: 'existing-open' }]);
    expect(showdownStore.hasOpenBetween).toHaveBeenCalledOnce();
  });

  it('returns budget-exhausted when either agent cannot cover the bond', async () => {
    const getAgentRemainingBudget = vi.fn(async (agentName: string) =>
      agentName === 'volatility' ? 249_999_999n : 1_000_000_000n
    );

    const result = await discoverShowdowns(
      makeDeps({
        getAgentRemainingBudget,
        listActiveSignals: async () => [
          createSignal({ id: 'vol', agentName: 'volatility', side: 'YES', agentProbabilityBps: 7200 }),
          createSignal({ id: 'mom', agentName: 'momentum', side: 'NO', agentProbabilityBps: 3100 })
        ]
      })
    );

    expect(result.discovered).toBe(1);
    expect(result.opened).toBe(0);
    expect(result.skips).toEqual([{ marketId: 'market-btc-100k', reason: 'budget-exhausted' }]);
  });

  it('returns operator-gas-low before scanning any signals', async () => {
    const listActiveSignals = vi.fn(async () => [
      createSignal({ id: 'vol', agentName: 'volatility' }),
      createSignal({ id: 'mom', agentName: 'momentum', side: 'NO' })
    ]);

    const result = await discoverShowdowns(
      makeDeps({
        listActiveSignals,
        isOperatorGasOk: vi.fn(async () => false)
      })
    );

    expect(result).toEqual({
      discovered: 0,
      opened: 0,
      skips: [{ marketId: '*', reason: 'operator-gas-low' }]
    });
    expect(listActiveSignals).not.toHaveBeenCalled();
  });

  it('opens one showdown for an opposing pair and persists the open record', async () => {
    const showdownStore = createShowdownStore();
    const openOnChain = vi.fn(async (): Promise<OpenOnChainResult> => ({
      onchainId: 15,
      txHash: OPEN_TX,
      openedAt: new Date(NOW_MS).toISOString()
    }));

    const result = await discoverShowdowns(
      makeDeps({
        showdownStore,
        openOnChain,
        listActiveSignals: async () => [
          createSignal({
            id: 'vol',
            agentName: 'volatility',
            side: 'YES',
            confidence: 'HIGH',
            agentProbabilityBps: 7200,
            marketPriceBps: 5200,
            edgeBps: 2000,
            kellyBps: 300
          }),
          createSignal({
            id: 'mom',
            agentName: 'momentum',
            side: 'NO',
            confidence: 'MEDIUM',
            agentProbabilityBps: 3100,
            marketPriceBps: 6900,
            edgeBps: 3800,
            kellyBps: 250
          })
        ]
      })
    );

    expect(result).toEqual({ discovered: 1, opened: 1, skips: [] });
    expect(openOnChain).toHaveBeenCalledOnce();
    expect(showdownStore.insert).toHaveBeenCalledOnce();

    const record = vi.mocked(showdownStore.insert).mock.calls[0]?.[0] as ShowdownRecord;
    expect(record).toMatchObject({
      onchainId: 15,
      marketId: 'market-btc-100k',
      status: 'Open',
      openTxHash: OPEN_TX,
      settledAt: null,
      settleTxHash: null,
      resolvedOutcome: null,
      resolvedPriceLabel: null
    });
    expect([record.agentA, record.agentB]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          confidence: 'HIGH',
          name: 'volatility',
          thesis:
            'The volatility agent expects the market to settle YES. It priced 72% conviction against a 52% market line, producing 20% edge and 3% capped Kelly. No additional risk flags were raised.'
        }),
        expect.objectContaining({
          confidence: 'MEDIUM',
          name: 'momentum',
          thesis:
            'The momentum agent expects the market to settle NO. It priced 31% conviction against a 69% market line, producing 38% edge and 2.5% capped Kelly. No additional risk flags were raised.'
        })
      ])
    );
    expect(record.deadline).toBe('2026-06-05T12:00:00.000Z');
  });

  it('uses a stable externalId for the same market pair across runs while deadline follows nowMs', async () => {
    const firstOpen = vi.fn(async (): Promise<OpenOnChainResult> => ({
      onchainId: 31,
      txHash: OPEN_TX,
      openedAt: new Date(NOW_MS).toISOString()
    }));
    const secondOpen = vi.fn(async (): Promise<OpenOnChainResult> => ({
      onchainId: 32,
      txHash: OPEN_TX,
      openedAt: new Date(NOW_MS + 60_000).toISOString()
    }));
    const listActiveSignals = async () => [
      createSignal({ id: 'vol', agentName: 'volatility', side: 'YES', agentProbabilityBps: 7200 }),
      createSignal({ id: 'mom', agentName: 'momentum', side: 'NO', agentProbabilityBps: 3100 })
    ];

    await discoverShowdowns(
      makeDeps({
        openOnChain: firstOpen,
        listActiveSignals,
        nowMs: () => NOW_MS
      })
    );

    await discoverShowdowns(
      makeDeps({
        openOnChain: secondOpen,
        listActiveSignals,
        nowMs: () => NOW_MS + 60_000
      })
    );

    const firstInput = firstOpen.mock.calls[0]?.[0] as OpenOnChainInput;
    const secondInput = secondOpen.mock.calls[0]?.[0] as OpenOnChainInput;

    expect(firstInput.externalId).toBe(secondInput.externalId);
    expect(firstInput.deadlineUnix).not.toBe(secondInput.deadlineUnix);
    expect(firstInput.deadlineUnix).toBe(BigInt(Math.floor(NOW_MS / 1000) + 86_400));
    expect(secondInput.deadlineUnix).toBe(BigInt(Math.floor((NOW_MS + 60_000) / 1000) + 86_400));
  });

  it('downgrades duplicate external id errors from openOnChain to existing-open without persisting', async () => {
    const showdownStore = createShowdownStore();
    const openOnChain = vi.fn(async () => {
      throw new Error('external id reused');
    });

    const result = await discoverShowdowns(
      makeDeps({
        showdownStore,
        openOnChain,
        listActiveSignals: async () => [
          createSignal({ id: 'vol', agentName: 'volatility', side: 'YES', agentProbabilityBps: 7200 }),
          createSignal({ id: 'mom', agentName: 'momentum', side: 'NO', agentProbabilityBps: 3100 })
        ]
      })
    );

    expect(result).toEqual({
      discovered: 1,
      opened: 0,
      skips: [
        {
          marketId: 'market-btc-100k',
          reason: 'existing-open'
        }
      ]
    });
    expect(showdownStore.insert).not.toHaveBeenCalled();
  });

  it('selects the opposing pair with the largest probability spread', async () => {
    const openOnChain = vi.fn(async (input: OpenOnChainInput): Promise<OpenOnChainResult> => ({
      onchainId: 19,
      txHash: OPEN_TX,
      openedAt: new Date(NOW_MS).toISOString()
    }));

    await discoverShowdowns(
      makeDeps({
        openOnChain,
        listActiveSignals: async () => [
          createSignal({ id: 'vol-low', agentName: 'volatility', side: 'YES', agentProbabilityBps: 6100 }),
          createSignal({ id: 'vol-high', agentName: 'volatility', side: 'YES', agentProbabilityBps: 8400 }),
          createSignal({ id: 'mom-mid', agentName: 'momentum', side: 'NO', agentProbabilityBps: 3300 }),
          createSignal({ id: 'mom-small', agentName: 'momentum', side: 'NO', agentProbabilityBps: 5800 })
        ]
      })
    );

    const input = openOnChain.mock.calls[0]?.[0] as OpenOnChainInput;
    expect(openOnChain).toHaveBeenCalledTimes(1);
    expect(input.marketId).toBe('market-btc-100k');
    expect(Math.abs(input.agentA.probabilityBps - input.agentB.probabilityBps)).toBe(5100);
  });

  it('uses a deterministic tie-break when spreads are equal', async () => {
    const openOnChain = vi.fn(async (input: OpenOnChainInput): Promise<OpenOnChainResult> => ({
      onchainId: 21,
      txHash: OPEN_TX,
      openedAt: new Date(NOW_MS).toISOString()
    }));

    await discoverShowdowns(
      makeDeps({
        openOnChain,
        listActiveSignals: async () => [
          createSignal({ id: 'vol-20', agentName: 'volatility', side: 'YES', agentProbabilityBps: 7000 }),
          createSignal({ id: 'vol-10', agentName: 'volatility', side: 'YES', agentProbabilityBps: 7000 }),
          createSignal({ id: 'mom-30', agentName: 'momentum', side: 'NO', agentProbabilityBps: 4000 }),
          createSignal({ id: 'mom-40', agentName: 'momentum', side: 'NO', agentProbabilityBps: 4000 })
        ],
        getAgentAddress: vi.fn((signal: AgentSignal) => {
          const byId: Record<string, `0x${string}`> = {
            'vol-20': `0x${'0'.repeat(39)}2`,
            'vol-10': `0x${'0'.repeat(39)}1`,
            'mom-30': `0x${'0'.repeat(39)}3`,
            'mom-40': `0x${'0'.repeat(39)}4`
          };

          return byId[signal.id];
        })
      })
    );

    expect(openOnChain).toHaveBeenCalledTimes(1);
    const call = openOnChain.mock.calls[0]?.[0] as OpenOnChainInput;
    const addresses = [call.agentA.address.toLowerCase(), call.agentB.address.toLowerCase()].sort();
    expect(addresses).toEqual([`0x${'0'.repeat(39)}1`, `0x${'0'.repeat(39)}3`]);
  });
});
