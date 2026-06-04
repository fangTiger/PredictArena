import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createLocalShowdownStore } from '@/lib/persistence/showdownsLocal';
import type { ShowdownRecord } from '@/lib/persistence/store';

const OPEN_TX = `0x${'a'.repeat(64)}` as const;
const SETTLE_TX = `0x${'b'.repeat(64)}` as const;
const EXTERNAL_ID = `0x${'1'.repeat(64)}` as const;
const AGENT_A = `0x${'a'.repeat(40)}` as const;
const AGENT_B = `0x${'b'.repeat(40)}` as const;

function createRecord(overrides: Partial<ShowdownRecord> = {}): ShowdownRecord {
  return {
    externalId: EXTERNAL_ID,
    onchainId: 7,
    marketId: 'market-btc-100k',
    marketQuestion: 'Will BTC close above $100,000?',
    agentA: {
      address: AGENT_A,
      name: 'volatility',
      side: 'YES',
      probabilityBps: 7200
    },
    agentB: {
      address: AGENT_B,
      name: 'momentum',
      side: 'NO',
      probabilityBps: 3100
    },
    bondPerSideMicroUsdc: 250_000_000,
    deadline: '2026-06-10T00:00:00.000Z',
    status: 'Open',
    openedAt: '2026-06-04T12:00:00.000Z',
    settledAt: null,
    openTxHash: OPEN_TX,
    settleTxHash: null,
    resolvedOutcome: null,
    resolvedPriceLabel: null,
    ...overrides
  };
}

describe('createLocalShowdownStore', () => {
  let tempDir: string;
  let previousFile: string | undefined;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'predictarena-showdowns-'));
    previousFile = process.env.SHOWDOWN_LOCAL_FILE;
    process.env.SHOWDOWN_LOCAL_FILE = path.join(tempDir, 'showdowns.json');
  });

  afterEach(() => {
    if (previousFile === undefined) {
      delete process.env.SHOWDOWN_LOCAL_FILE;
    } else {
      process.env.SHOWDOWN_LOCAL_FILE = previousFile;
    }

    rmSync(tempDir, { recursive: true, force: true });
  });

  it('inserts and lists records from the local JSON file', async () => {
    const store = createLocalShowdownStore();
    const record = createRecord();

    await store.insert(record);

    await expect(store.listAll()).resolves.toEqual([record]);
  });

  it('rejects duplicate onchain ids', async () => {
    const store = createLocalShowdownStore();
    const record = createRecord();

    await store.insert(record);

    await expect(store.insert(createRecord({ externalId: `0x${'2'.repeat(64)}` }))).rejects.toThrow(
      /already exists/i
    );
  });

  it('updates settlement fields and supports lookup by onchain id', async () => {
    const store = createLocalShowdownStore();
    await store.insert(createRecord());

    await store.updateOnSettle(7, {
      status: 'SettledA',
      settledAt: '2026-06-11T00:00:00.000Z',
      settleTxHash: SETTLE_TX,
      resolvedOutcome: 'YES',
      resolvedPriceLabel: 'BTC settled at $102,431'
    });

    await expect(store.findByOnchainId(7)).resolves.toEqual(
      expect.objectContaining({
        status: 'SettledA',
        settledAt: '2026-06-11T00:00:00.000Z',
        settleTxHash: SETTLE_TX,
        resolvedOutcome: 'YES',
        resolvedPriceLabel: 'BTC settled at $102,431'
      })
    );
  });

  it('detects existing open pairs regardless of address order or case', async () => {
    const store = createLocalShowdownStore();
    await store.insert(createRecord());
    await store.insert(
      createRecord({
        externalId: `0x${'3'.repeat(64)}`,
        onchainId: 8,
        marketId: 'market-eth-4k',
        status: 'SettledB',
        settledAt: '2026-06-06T00:00:00.000Z',
        settleTxHash: SETTLE_TX,
        resolvedOutcome: 'NO',
        resolvedPriceLabel: 'ETH settled below $4,000'
      })
    );

    await expect(store.hasOpenBetween('market-btc-100k', AGENT_A.toUpperCase(), AGENT_B)).resolves.toBe(
      true
    );
    await expect(store.hasOpenBetween('market-btc-100k', AGENT_B, AGENT_A.toUpperCase())).resolves.toBe(
      true
    );
    await expect(store.hasOpenBetween('market-eth-4k', AGENT_A, AGENT_B)).resolves.toBe(false);
    await expect(store.hasOpenBetween('market-sol-250', AGENT_A, AGENT_B)).resolves.toBe(false);
  });
});
