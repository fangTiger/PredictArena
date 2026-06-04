import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  mapResolutionToAgentAWins,
  settleEligibleShowdowns,
  type ResolutionResult,
  type SettlementDeps
} from '@/lib/services/showdownSettlement';
import type { ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

const NOW_MS = Date.parse('2026-06-04T12:00:00.000Z');
const SETTLE_TX = `0x${'e'.repeat(64)}` as const;

function createRecord(overrides: Partial<ShowdownRecord> = {}): ShowdownRecord {
  return {
    externalId: `0x${'a'.repeat(64)}`,
    onchainId: 11,
    marketId: 'market-btc-100k',
    marketQuestion: 'Will BTC close above $100,000?',
    agentA: {
      address: `0x${'1'.repeat(40)}`,
      name: 'volatility',
      side: 'YES',
      probabilityBps: 7200
    },
    agentB: {
      address: `0x${'2'.repeat(40)}`,
      name: 'momentum',
      side: 'NO',
      probabilityBps: 3100
    },
    bondPerSideMicroUsdc: 250_000_000,
    deadline: '2026-06-04T11:00:00.000Z',
    status: 'Open',
    openedAt: '2026-06-04T10:00:00.000Z',
    settledAt: null,
    openTxHash: `0x${'b'.repeat(64)}`,
    settleTxHash: null,
    resolvedOutcome: null,
    resolvedPriceLabel: null,
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

function makeDeps(overrides: Partial<SettlementDeps> = {}): SettlementDeps {
  return {
    showdownStore: createShowdownStore(),
    resolveMarket: vi.fn(async () => ({
      outcomeYes: true,
      priceLabel: 'BTC settled at $102,431'
    })),
    settleOnChain: vi.fn(async () => SETTLE_TX),
    nowMs: () => NOW_MS,
    ...overrides
  };
}

describe('mapResolutionToAgentAWins', () => {
  it('returns true when agent A is YES and outcome resolves YES', () => {
    expect(mapResolutionToAgentAWins(createRecord({ agentA: { ...createRecord().agentA, side: 'YES' } }), true)).toBe(true);
  });

  it('returns false when agent A is YES and outcome resolves NO', () => {
    expect(mapResolutionToAgentAWins(createRecord({ agentA: { ...createRecord().agentA, side: 'YES' } }), false)).toBe(false);
  });

  it('returns false when agent A is NO and outcome resolves YES', () => {
    expect(mapResolutionToAgentAWins(createRecord({ agentA: { ...createRecord().agentA, side: 'NO' } }), true)).toBe(false);
  });

  it('returns true when agent A is NO and outcome resolves NO', () => {
    expect(mapResolutionToAgentAWins(createRecord({ agentA: { ...createRecord().agentA, side: 'NO' } }), false)).toBe(true);
  });
});

describe('settleEligibleShowdowns', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('settles past-deadline open showdowns when a YES/NO resolution exists', async () => {
    const showdownStore = createShowdownStore({
      listAll: vi.fn(async () => [createRecord()])
    });
    const deps = makeDeps({ showdownStore });

    const result = await settleEligibleShowdowns(deps);

    expect(result).toEqual({
      inspected: 1,
      settled: 1,
      stuck: 0,
      errors: []
    });
    expect(deps.settleOnChain).toHaveBeenCalledWith(11, true);
    expect(showdownStore.updateOnSettle).toHaveBeenCalledWith(
      11,
      expect.objectContaining({
        status: 'SettledA',
        settleTxHash: SETTLE_TX,
        resolvedOutcome: 'YES',
        resolvedPriceLabel: 'BTC settled at $102,431'
      })
    );
  });

  it('leaves a recently expired showdown open when the resolver still returns null', async () => {
    const showdownStore = createShowdownStore({
      listAll: vi.fn(async () => [createRecord()])
    });
    const deps = makeDeps({
      showdownStore,
      resolveMarket: vi.fn(async (): Promise<ResolutionResult | null> => null)
    });

    const result = await settleEligibleShowdowns(deps);

    expect(result).toEqual({
      inspected: 1,
      settled: 0,
      stuck: 0,
      errors: []
    });
    expect(deps.settleOnChain).not.toHaveBeenCalled();
    expect(showdownStore.updateOnSettle).not.toHaveBeenCalled();
  });

  it('counts a showdown as stuck once it remains unresolved for more than 24 hours past deadline', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const showdownStore = createShowdownStore({
      listAll: vi.fn(async () => [
        createRecord({
          deadline: '2026-06-03T10:59:59.000Z'
        })
      ])
    });
    const deps = makeDeps({
      showdownStore,
      resolveMarket: vi.fn(async (): Promise<ResolutionResult | null> => null)
    });

    const result = await settleEligibleShowdowns(deps);

    expect(result).toEqual({
      inspected: 1,
      settled: 0,
      stuck: 1,
      errors: []
    });
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('showdown 11 stuck')
    );
    expect(showdownStore.updateOnSettle).not.toHaveBeenCalled();
  });

  it('captures per-showdown failures without aborting the rest of the batch', async () => {
    const showdownStore = createShowdownStore({
      listAll: vi.fn(async () => [
        createRecord({ onchainId: 21 }),
        createRecord({
          onchainId: 22,
          marketId: 'market-eth-5k',
          agentA: { ...createRecord().agentA, side: 'NO' }
        })
      ])
    });
    const settleOnChain = vi.fn(async (onchainId: number) => {
      if (onchainId === 21) {
        throw new Error('settlement_reverted');
      }

      return SETTLE_TX;
    });
    const deps = makeDeps({
      showdownStore,
      settleOnChain,
      resolveMarket: vi.fn(async (record: ShowdownRecord) =>
        record.onchainId === 21
          ? {
              outcomeYes: true,
              priceLabel: 'BTC settled at $101,000'
            }
          : {
              outcomeYes: false,
              priceLabel: 'ETH settled at $4,950'
            }
      )
    });

    const result = await settleEligibleShowdowns(deps);

    expect(result.inspected).toBe(2);
    expect(result.settled).toBe(1);
    expect(result.stuck).toBe(0);
    expect(result.errors).toEqual([
      {
        onchainId: 21,
        error: 'settlement_reverted'
      }
    ]);
    expect(showdownStore.updateOnSettle).toHaveBeenCalledTimes(1);
    expect(showdownStore.updateOnSettle).toHaveBeenCalledWith(
      22,
      expect.objectContaining({
        status: 'SettledA',
        resolvedOutcome: 'NO'
      })
    );
  });
});
