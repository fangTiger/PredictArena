import { privateKeyToAccount } from 'viem/accounts';
import { createArcClients } from '@/lib/arc/client';
import { getServerEnv } from '@/lib/config/env';
import { getShowdownArena, showdownArenaAbi } from '@/lib/contracts/showdownArena';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import { getRuntimeStore } from '@/lib/persistence/store';
import type { AgentSignal } from '@/lib/polymarket/types';
import type {
  DiscoveryDeps,
  OpenOnChainInput,
  OpenOnChainResult
} from '@/lib/services/showdownDiscovery';

const DEFAULT_BOND_PER_SIDE_MICRO_USDC = 250_000_000n;
const DEFAULT_DEADLINE_WINDOW_SEC = 86_400;
const MIN_OPERATOR_GAS_WEI = 100_000_000_000_000n;

function readShowdownArenaAddress(): `0x${string}` | null {
  const value = process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS?.trim();
  return value ? (value as `0x${string}`) : null;
}

function readBondPerSideMicroUsdc(): bigint {
  const raw = process.env.SHOWDOWN_BOND_MICRO_USDC?.trim();
  if (!raw) {
    return DEFAULT_BOND_PER_SIDE_MICRO_USDC;
  }

  try {
    const parsed = BigInt(raw);
    if (parsed <= 0n) {
      throw new Error('non_positive');
    }
    return parsed;
  } catch {
    throw new Error('showdown_discovery_bond_invalid');
  }
}

function readDeadlineWindowSec(): number {
  const raw = process.env.SHOWDOWN_DEADLINE_WINDOW_SEC?.trim();
  if (!raw) {
    return DEFAULT_DEADLINE_WINDOW_SEC;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('showdown_discovery_deadline_invalid');
  }

  return parsed;
}

function toUtcDay(value: string): string {
  return value.slice(0, 10);
}

function calculateRemainingBudget(
  agentName: AgentSignal['agentName'],
  usedMicroUsdc: bigint,
  maxDailyBondMicroUsdc: number
): bigint {
  const maxDaily = BigInt(Math.max(maxDailyBondMicroUsdc, 0));
  return usedMicroUsdc >= maxDaily ? 0n : maxDaily - usedMicroUsdc;
}

export async function buildDefaultDiscoveryDeps(): Promise<DiscoveryDeps> {
  const env = getServerEnv();
  const showdownArenaAddress = readShowdownArenaAddress();

  if (!env.admin.privateKey || !showdownArenaAddress) {
    throw new Error('showdown_discovery_config_missing');
  }

  const clients = createArcClients({
    privateKey: env.admin.privateKey,
    rpcUrl: env.arc.rpcUrl
  });
  const showdownStore = getShowdownStore();
  const runtimeStore = getRuntimeStore();
  const contract = getShowdownArena({
    address: showdownArenaAddress,
    publicClient: clients.publicClient,
    walletClient: clients.walletClient
  });
  const agentAddresses = {
    volatility: env.agentKeys.volatility
      ? privateKeyToAccount(env.agentKeys.volatility).address
      : null,
    momentum: env.agentKeys.momentum
      ? privateKeyToAccount(env.agentKeys.momentum).address
      : null
  };

  return {
    listActiveSignals: () => runtimeStore.listSignals(),
    showdownStore,
    openOnChain: async (input: OpenOnChainInput): Promise<OpenOnChainResult> => {
      const txHash = await clients.walletClient.writeContract({
        address: showdownArenaAddress,
        abi: showdownArenaAbi,
        functionName: 'openShowdown',
        args: [
          input.externalId,
          input.marketId,
          input.marketQuestion,
          input.agentA.address,
          input.agentA.name,
          input.agentA.side === 'YES',
          input.agentA.probabilityBps,
          input.agentB.address,
          input.agentB.name,
          input.agentB.probabilityBps,
          input.bondPerSideMicroUsdc,
          input.deadlineUnix
        ]
      });
      const receipt = await clients.publicClient.waitForTransactionReceipt({
        hash: txHash
      });
      const onchainId = Number(
        await contract.read.lookupByExternalId([input.externalId])
      );
      const block = await clients.publicClient.getBlock({
        blockNumber: receipt.blockNumber
      });

      return {
        onchainId,
        txHash,
        openedAt: new Date(Number(block.timestamp) * 1000).toISOString()
      };
    },
    // Conservative daily budget: count both committed signal stake and same-day showdown bond usage.
    getAgentRemainingBudget: async (agentName) => {
      const nowIso = new Date().toISOString();
      const today = toUtcDay(nowIso);
      const signals = await runtimeStore.listSignals();
      const showdowns = await showdownStore.listAll();
      const committedSpend = signals
        .filter(
          (signal) =>
            signal.agentName === agentName &&
            Boolean(signal.arcTxHash) &&
            toUtcDay(signal.createdAt) === today
        )
        .reduce((sum, signal) => sum + BigInt(signal.stakeMicroUsdc), 0n);
      const showdownSpend = showdowns.reduce((sum, record) => {
        if (toUtcDay(record.openedAt) !== today) {
          return sum;
        }

        let next = sum;
        if (record.agentA.name === agentName) {
          next += BigInt(record.bondPerSideMicroUsdc);
        }
        if (record.agentB.name === agentName) {
          next += BigInt(record.bondPerSideMicroUsdc);
        }
        return next;
      }, 0n);
      const policy = env.autonomy.policies[agentName];

      return calculateRemainingBudget(
        agentName,
        committedSpend + showdownSpend,
        policy.maxDailyBondUsdc6
      );
    },
    bondPerSideMicroUsdc: readBondPerSideMicroUsdc(),
    deadlineWindowSec: readDeadlineWindowSec(),
    nowMs: () => Date.now(),
    isOperatorGasOk: async () => {
      const balance = await clients.publicClient.getBalance({
        address: clients.account.address
      });
      return balance > MIN_OPERATOR_GAS_WEI;
    },
    getAgentAddress(signal) {
      const address = agentAddresses[signal.agentName];
      if (!address) {
        throw new Error(`showdown_discovery_agent_key_missing:${signal.agentName}`);
      }
      return address;
    }
  };
}
