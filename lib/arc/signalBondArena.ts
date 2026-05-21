import { decodeEventLog } from 'viem';
import type { AgentSignal } from '@/lib/polymarket/types';

export const signalBondArenaAbi = [
  {
    type: 'event',
    name: 'SignalCommitted',
    inputs: [
      { name: 'signalRecordId', type: 'uint256', indexed: true },
      { name: 'externalSignalId', type: 'string', indexed: false },
      { name: 'marketId', type: 'string', indexed: false },
      { name: 'agent', type: 'address', indexed: true },
      { name: 'agentName', type: 'string', indexed: false },
      { name: 'sideYes', type: 'bool', indexed: false },
      { name: 'marketPriceBps', type: 'uint16', indexed: false },
      { name: 'agentProbabilityBps', type: 'uint16', indexed: false },
      { name: 'confidenceBps', type: 'uint16', indexed: false },
      { name: 'edgeBps', type: 'uint16', indexed: false },
      { name: 'stakeMicroUsdc', type: 'uint256', indexed: false },
      { name: 'modelHash', type: 'bytes32', indexed: false },
      { name: 'dataHash', type: 'bytes32', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'SignalResolved',
    inputs: [
      { name: 'signalRecordId', type: 'uint256', indexed: true },
      { name: 'outcomeCorrect', type: 'bool', indexed: false },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'stakeMicroUsdc', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'function',
    name: 'signals',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'externalSignalId', type: 'string' },
      { name: 'marketId', type: 'string' },
      { name: 'agent', type: 'address' },
      { name: 'agentName', type: 'string' },
      { name: 'sideYes', type: 'bool' },
      { name: 'marketPriceBps', type: 'uint16' },
      { name: 'agentProbabilityBps', type: 'uint16' },
      { name: 'confidenceBps', type: 'uint16' },
      { name: 'edgeBps', type: 'uint16' },
      { name: 'stakeMicroUsdc', type: 'uint256' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'dataHash', type: 'bytes32' },
      { name: 'committedAt', type: 'uint64' },
      { name: 'resolved', type: 'bool' },
      { name: 'outcomeCorrect', type: 'bool' }
    ]
  },
  {
    type: 'function',
    name: 'commitSignal',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'externalSignalId', type: 'string' },
      { name: 'marketId', type: 'string' },
      { name: 'agentName', type: 'string' },
      { name: 'sideYes', type: 'bool' },
      { name: 'marketPriceBps', type: 'uint16' },
      { name: 'agentProbabilityBps', type: 'uint16' },
      { name: 'confidenceBps', type: 'uint16' },
      { name: 'edgeBps', type: 'uint16' },
      { name: 'stakeMicroUsdc', type: 'uint256' },
      { name: 'modelHash', type: 'bytes32' },
      { name: 'dataHash', type: 'bytes32' }
    ],
    outputs: [{ name: 'signalRecordId', type: 'uint256' }]
  },
  {
    type: 'function',
    name: 'resolveSignalsBulk',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'signalRecordIds', type: 'uint256[]' },
      { name: 'outcomeCorrectValues', type: 'bool[]' }
    ],
    outputs: []
  }
] as const;

export function extractSignalRecordIdFromReceipt(receipt: {
  logs?: Array<{ data: `0x${string}`; topics: readonly `0x${string}`[] }>;
}): number | null {
  for (const log of receipt.logs ?? []) {
    try {
      const decoded = decodeEventLog({
        abi: signalBondArenaAbi,
        data: log.data,
        topics: [...log.topics] as [`0x${string}`, ...`0x${string}`[]],
        eventName: 'SignalCommitted'
      });
      const signalRecordId = decoded.args.signalRecordId;
      return Number(signalRecordId);
    } catch {
      // Ignore unrelated logs in the same transaction receipt.
    }
  }

  return null;
}

export async function commitArenaSignal({
  walletClient,
  arenaAddress,
  signal
}: {
  walletClient: {
    writeContract: (...args: any[]) => Promise<`0x${string}`>;
  };
  arenaAddress: `0x${string}`;
  signal: AgentSignal;
}): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: arenaAddress,
    abi: signalBondArenaAbi,
    functionName: 'commitSignal',
    args: [
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
  });
}

export async function resolveArenaSignalsBulk({
  walletClient,
  arenaAddress,
  signalRecordIds,
  outcomeCorrectValues
}: {
  walletClient: {
    writeContract: (...args: any[]) => Promise<`0x${string}`>;
  };
  arenaAddress: `0x${string}`;
  signalRecordIds: number[];
  outcomeCorrectValues: boolean[];
}): Promise<`0x${string}`> {
  return walletClient.writeContract({
    address: arenaAddress,
    abi: signalBondArenaAbi,
    functionName: 'resolveSignalsBulk',
    args: [signalRecordIds.map((id) => BigInt(id)), outcomeCorrectValues]
  });
}
