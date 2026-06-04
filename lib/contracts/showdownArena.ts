import { getContract, keccak256, parseAbi, toBytes } from 'viem';
import type { Address, Hex, PublicClient, WalletClient } from 'viem';

export const showdownArenaAbi = parseAbi([
  'event ShowdownOpened(uint256 indexed showdownId, bytes32 indexed externalId, string marketId, address indexed agentA, bool sideAYes, address agentB, uint256 bondPerSideMicroUsdc, uint64 deadline)',
  'event ShowdownSettled(uint256 indexed showdownId, uint8 indexed result, address indexed winner, uint256 payoutMicroUsdc)',
  'function openShowdown(bytes32 externalId, string marketId, string marketQuestion, address agentA, string agentNameA, bool sideAYes, uint16 agentAProbabilityBps, address agentB, string agentNameB, uint16 agentBProbabilityBps, uint256 bondPerSideMicroUsdc, uint64 deadline) external returns (uint256 showdownId)',
  'function settleShowdown(uint256 showdownId, bool agentAWins) external',
  'function getShowdown(uint256 showdownId) external view returns ((uint256 id, bytes32 externalId, string marketId, string marketQuestion, address agentA, string agentNameA, bool sideAYes, uint16 agentAProbabilityBps, address agentB, string agentNameB, uint16 agentBProbabilityBps, uint256 bondPerSideMicroUsdc, uint64 deadline, uint64 openedAt, uint64 settledAt, uint8 status))',
  'function lookupByExternalId(bytes32 externalId) external view returns (uint256 showdownId)',
  'function showdownCount() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function treasury() external view returns (address)',
  'function usdc() external view returns (address)'
]);

export const SHOWDOWN_STATUS = {
  None: 0,
  Open: 1,
  SettledA: 2,
  SettledB: 3
} as const;

export type ShowdownStatus = (typeof SHOWDOWN_STATUS)[keyof typeof SHOWDOWN_STATUS];

export interface ShowdownArenaConfig {
  address: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

export function getShowdownArena({ address, publicClient, walletClient }: ShowdownArenaConfig) {
  return getContract({
    address,
    abi: showdownArenaAbi,
    client: walletClient ? { public: publicClient, wallet: walletClient } : { public: publicClient }
  });
}

export function buildExternalIdHash(rawExternalId: string): Hex {
  return keccak256(toBytes(rawExternalId));
}
