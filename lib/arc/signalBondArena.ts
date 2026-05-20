import type { AgentSignal } from '@/lib/polymarket/types';

export const signalBondArenaAbi = [
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
  }
] as const;

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
