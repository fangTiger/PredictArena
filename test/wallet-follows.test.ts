import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { encodeAbiParameters, encodeEventTopics } from 'viem';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signalBondArenaAbi } from '@/lib/arc/signalBondArena';
import type { AgentSignal } from '@/lib/polymarket/types';

function createSignal(overrides: Partial<AgentSignal> = {}): AgentSignal {
  return {
    id: 'wallet-follow-signal',
    runId: 'run-wallet-follow',
    marketId: 'demo-btc-wallet-follow',
    marketQuestion: 'Will BTC be above $105,000 on May 30, 2026?',
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'EXPIRY_ABOVE',
    thresholdUsd: 105000,
    expiresAt: '2026-05-30T23:59:00.000Z',
    agentName: 'volatility',
    modelVersion: 'volatility-gbm-v1',
    modelParams: { sigma: 0.7 },
    modelHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
    dataHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
    side: 'YES',
    status: 'generated',
    confidence: 'HIGH',
    confidenceBps: 7600,
    marketPriceBps: 5400,
    agentProbabilityBps: 7600,
    yesPriceBps: 5400,
    pYesBps: 7600,
    edgeBps: 2200,
    kellyBps: 300,
    stakeMicroUsdc: 50000,
    riskFlags: [],
    arcTxHash: null,
    createdAt: '2026-05-20T00:00:00.000Z',
    updatedAt: '2026-05-20T00:00:00.000Z',
    source: 'demo_snapshot',
    resolution: null,
    ...overrides
  };
}

const ARENA_ADDRESS = '0x2000000000000000000000000000000000000002';
const FOLLOW_WALLET = '0x1000000000000000000000000000000000000001';
const OTHER_WALLET = '0x3000000000000000000000000000000000000003';
const FOLLOW_TX_HASH = '0xf011000000000000000000000000000000000000000000000000000000000001';

function signalCommittedReceipt({
  signal,
  walletAddress = FOLLOW_WALLET,
  signalRecordId = 42,
  arenaAddress = ARENA_ADDRESS
}: {
  signal: AgentSignal;
  walletAddress?: `0x${string}`;
  signalRecordId?: number;
  arenaAddress?: `0x${string}`;
}) {
  const topics = encodeEventTopics({
    abi: signalBondArenaAbi,
    eventName: 'SignalCommitted',
    args: {
      signalRecordId: BigInt(signalRecordId),
      agent: walletAddress
    }
  });
  const data = encodeAbiParameters(
    [
      { type: 'string' },
      { type: 'string' },
      { type: 'string' },
      { type: 'bool' },
      { type: 'uint16' },
      { type: 'uint16' },
      { type: 'uint16' },
      { type: 'uint16' },
      { type: 'uint256' },
      { type: 'bytes32' },
      { type: 'bytes32' }
    ],
    [
      signal.id,
      signal.marketId,
      signal.agentName,
      signal.side === 'YES',
      signal.marketPriceBps,
      signal.agentProbabilityBps,
      signal.confidenceBps,
      signal.edgeBps,
      BigInt(signal.stakeMicroUsdc),
      signal.modelHash,
      signal.dataHash
    ]
  );

  return {
    logs: [
      {
        address: arenaAddress,
        data,
        topics
      }
    ]
  };
}

async function createStoreWithSignal(signal = createSignal()) {
  const workdir = path.join(tmpdir(), `predictarena-wallet-follows-${randomUUID()}`);
  await fs.mkdir(workdir, { recursive: true });
  const { createLocalStore } = await import('@/lib/persistence/localStore');
  const store = createLocalStore({
    storagePath: path.join(workdir, 'predictarena-store.json')
  });
  await store.saveAgentRun({
    runId: signal.runId,
    source: 'demo_snapshot',
    generatedAt: signal.createdAt,
    signals: [signal]
  });

  return { signal, store };
}

describe('wallet-funded follows', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('stores wallet follows separately from agent commit metrics', async () => {
    const { signal, store } = await createStoreWithSignal();
    await (store as any).saveWalletFollow({
      id: 'wallet-follow-1',
      signalId: signal.id,
      walletAddress: FOLLOW_WALLET,
      txHash: FOLLOW_TX_HASH,
      signalRecordId: 42,
      chainId: 5042002,
      arenaAddress: ARENA_ADDRESS,
      stakeMicroUsdc: signal.stakeMicroUsdc,
      agentName: signal.agentName,
      followedAt: '2026-05-20T00:01:00.000Z'
    });

    const follows = await (store as any).listWalletFollows(signal.id);
    const metrics = await store.getMetrics();
    const leaderboard = await store.getLeaderboard();
    const storedSignal = await store.getSignal(signal.id);

    expect(follows).toEqual([
      expect.objectContaining({
        signalId: signal.id,
        walletAddress: FOLLOW_WALLET,
        txHash: FOLLOW_TX_HASH
      })
    ]);
    expect(storedSignal?.arcTxHash).toBeNull();
    expect(metrics.committedSignals).toBe(0);
    expect(metrics.totalBondedMicroUsdc).toBe(0);
    expect(leaderboard[0]?.committedSignals).toBe(0);
  });

  it('records a wallet follow only after matching the chain receipt event', async () => {
    const { signal, store } = await createStoreWithSignal();
    const { recordWalletFollowReceipt } = await import('@/lib/arc/walletFollows');
    const publicClient = {
      getTransactionReceipt: async () => signalCommittedReceipt({ signal })
    };

    const follow = await recordWalletFollowReceipt({
      store,
      publicClient,
      signalId: signal.id,
      walletAddress: FOLLOW_WALLET,
      txHash: FOLLOW_TX_HASH,
      chainId: 5042002,
      arenaAddress: ARENA_ADDRESS,
      followedAt: '2026-05-20T00:01:00.000Z'
    });

    expect(follow).toMatchObject({
      signalId: signal.id,
      walletAddress: FOLLOW_WALLET,
      txHash: FOLLOW_TX_HASH,
      signalRecordId: 42
    });
    await expect((store as any).listWalletFollows(signal.id)).resolves.toHaveLength(1);
    await expect(store.getSignal(signal.id)).resolves.toMatchObject({
      arcTxHash: null,
      status: 'generated'
    });
  });

  it('rejects a receipt when the committed wallet does not match the requested wallet', async () => {
    const { signal, store } = await createStoreWithSignal();
    const { recordWalletFollowReceipt } = await import('@/lib/arc/walletFollows');
    const publicClient = {
      getTransactionReceipt: async () =>
        signalCommittedReceipt({
          signal,
          walletAddress: OTHER_WALLET
        })
    };

    await expect(
      recordWalletFollowReceipt({
        store,
        publicClient,
        signalId: signal.id,
        walletAddress: FOLLOW_WALLET,
        txHash: FOLLOW_TX_HASH,
        chainId: 5042002,
        arenaAddress: ARENA_ADDRESS,
        followedAt: '2026-05-20T00:01:00.000Z'
      })
    ).rejects.toThrow(/wallet_follow_sender_mismatch/);
    await expect((store as any).listWalletFollows(signal.id)).resolves.toHaveLength(0);
  });

  it('POST /api/wallet/follows confirms a verified wallet receipt without exposing secrets', async () => {
    const { signal, store } = await createStoreWithSignal();
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    const { setWalletFollowPublicClientForTests } = await import('@/lib/arc/walletFollows');
    setRuntimeStoreForTests(store);
    setWalletFollowPublicClientForTests({
      getTransactionReceipt: async () => signalCommittedReceipt({ signal })
    });
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', ARENA_ADDRESS);
    vi.stubEnv('ARC_CHAIN_ID', '5042002');
    vi.stubEnv('VOL_AGENT_PRIVATE_KEY', '0x9999999999999999999999999999999999999999999999999999999999999999');
    const { POST } = await import('@/app/api/wallet/follows/route');

    const response = await POST(
      new Request('http://localhost/api/wallet/follows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          signalId: signal.id,
          walletAddress: FOLLOW_WALLET,
          txHash: FOLLOW_TX_HASH
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.follow).toMatchObject({
      signalId: signal.id,
      walletAddress: FOLLOW_WALLET,
      txHash: FOLLOW_TX_HASH
    });
    expect(JSON.stringify(payload)).not.toContain('PRIVATE_KEY');
    expect(JSON.stringify(payload)).not.toContain('999999');
    await expect((store as any).listWalletFollows(signal.id)).resolves.toHaveLength(1);
  });

  it('POST /api/wallet/follows returns invalid_request for malformed JSON', async () => {
    const { store } = await createStoreWithSignal();
    const { setRuntimeStoreForTests } = await import('@/lib/persistence/store');
    setRuntimeStoreForTests(store);
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', ARENA_ADDRESS);
    const { POST } = await import('@/app/api/wallet/follows/route');

    const response = await POST(
      new Request('http://localhost/api/wallet/follows', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{'
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toMatchObject({
      reason: 'invalid_request'
    });
  });
});
