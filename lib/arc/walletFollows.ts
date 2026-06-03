import { createPublicClient, decodeEventLog, getAddress, http, isAddressEqual } from 'viem';
import { arcTestnet } from '@/lib/arc/client';
import { signalBondArenaAbi } from '@/lib/arc/signalBondArena';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { PersistenceStore, WalletFollowRecord } from '@/lib/persistence/store';
import { isSignalEligibleForCommit } from '@/lib/utils/signal';

interface WalletFollowPublicClient {
  getTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{
    logs?: Array<{
      address?: `0x${string}`;
      data: `0x${string}`;
      topics: readonly `0x${string}`[];
    }>;
  }>;
}

let walletFollowPublicClientForTests: WalletFollowPublicClient | null = null;

export function setWalletFollowPublicClientForTests(client: WalletFollowPublicClient): void {
  walletFollowPublicClientForTests = client;
}

export function resetWalletFollowPublicClientForTests(): void {
  walletFollowPublicClientForTests = null;
}

export function getWalletFollowPublicClient(rpcUrl: string): WalletFollowPublicClient {
  if (walletFollowPublicClientForTests) {
    return walletFollowPublicClientForTests;
  }

  return createPublicClient({
    chain: arcTestnet,
    transport: http(rpcUrl)
  }) as WalletFollowPublicClient;
}

interface SignalCommittedEvent {
  signalRecordId: bigint;
  externalSignalId: string;
  marketId: string;
  agent: `0x${string}`;
  agentName: AgentSignal['agentName'];
  sideYes: boolean;
  marketPriceBps: number;
  agentProbabilityBps: number;
  confidenceBps: number;
  edgeBps: number;
  stakeMicroUsdc: bigint;
  modelHash: `0x${string}`;
  dataHash: `0x${string}`;
}

interface RecordWalletFollowReceiptInput {
  store: PersistenceStore;
  publicClient: WalletFollowPublicClient;
  signalId: string;
  walletAddress: `0x${string}`;
  txHash: `0x${string}`;
  chainId: number;
  arenaAddress: `0x${string}`;
  followedAt?: string;
}

function decodeSignalCommittedEvent(
  receipt: Awaited<ReturnType<WalletFollowPublicClient['getTransactionReceipt']>>,
  arenaAddress: `0x${string}`
): SignalCommittedEvent | null {
  for (const log of receipt.logs ?? []) {
    if (log.address && !isAddressEqual(log.address, arenaAddress)) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: signalBondArenaAbi,
        data: log.data,
        topics: [...log.topics] as [`0x${string}`, ...`0x${string}`[]],
        eventName: 'SignalCommitted'
      });
      return decoded.args as SignalCommittedEvent;
    } catch {
      // Ignore unrelated logs in the receipt.
    }
  }

  return null;
}

function assertSignalMatchesReceipt(signal: AgentSignal, event: SignalCommittedEvent): void {
  const expectedSideYes = signal.side === 'YES';
  const mismatches = [
    event.externalSignalId !== signal.id && 'external_signal_id',
    event.marketId !== signal.marketId && 'market_id',
    event.agentName !== signal.agentName && 'agent_name',
    event.sideYes !== expectedSideYes && 'side',
    event.marketPriceBps !== signal.marketPriceBps && 'market_price_bps',
    event.agentProbabilityBps !== signal.agentProbabilityBps && 'agent_probability_bps',
    event.confidenceBps !== signal.confidenceBps && 'confidence_bps',
    event.edgeBps !== signal.edgeBps && 'edge_bps',
    event.stakeMicroUsdc !== BigInt(signal.stakeMicroUsdc) && 'stake_micro_usdc',
    event.modelHash.toLowerCase() !== signal.modelHash.toLowerCase() && 'model_hash',
    event.dataHash.toLowerCase() !== signal.dataHash.toLowerCase() && 'data_hash'
  ].filter(Boolean);

  if (mismatches.length > 0) {
    throw new Error(`wallet_follow_signal_mismatch:${mismatches.join(',')}`);
  }
}

export async function recordWalletFollowReceipt({
  store,
  publicClient,
  signalId,
  walletAddress,
  txHash,
  chainId,
  arenaAddress,
  followedAt = new Date().toISOString()
}: RecordWalletFollowReceiptInput): Promise<WalletFollowRecord> {
  const signal = await store.getSignal(signalId);
  if (!signal) {
    throw new Error('signal_not_found');
  }

  if (!isSignalEligibleForCommit(signal)) {
    throw new Error('signal_not_eligible');
  }

  const existingFollows = await store.listWalletFollows(signalId);
  if (existingFollows.some((follow) => follow.txHash.toLowerCase() === txHash.toLowerCase())) {
    throw new Error('wallet_follow_duplicate');
  }

  const receipt = await publicClient.getTransactionReceipt({ hash: txHash });
  if (!receipt) {
    throw new Error('wallet_follow_receipt_missing');
  }

  const event = decodeSignalCommittedEvent(receipt, arenaAddress);
  if (!event) {
    throw new Error('wallet_follow_event_missing');
  }

  const normalizedWalletAddress = getAddress(walletAddress);
  if (!isAddressEqual(event.agent, normalizedWalletAddress)) {
    throw new Error('wallet_follow_sender_mismatch');
  }

  assertSignalMatchesReceipt(signal, event);

  return store.saveWalletFollow({
    id: `wallet-follow:${signal.id}:${txHash}`,
    signalId: signal.id,
    walletAddress: normalizedWalletAddress,
    txHash,
    signalRecordId: Number(event.signalRecordId),
    chainId,
    arenaAddress,
    stakeMicroUsdc: signal.stakeMicroUsdc,
    agentName: signal.agentName,
    followedAt
  });
}
