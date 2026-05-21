import { createPublicClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from '@/lib/arc/client';
import { readUsdcAllowance, readUsdcBalance } from '@/lib/arc/usdc';
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_USDC_DECIMALS } from '@/lib/config/constants';
import { getServerEnv, type ServerEnvConfig } from '@/lib/config/env';
import { getRuntimeStore } from '@/lib/persistence/store';
import type { PersistenceStore } from '@/lib/persistence/store';
import type { AgentSignal } from '@/lib/polymarket/types';

type AgentName = AgentSignal['agentName'];

interface ArcWalletReadiness {
  publicAddress: `0x${string}` | null;
  usdcBalanceMicroUsdc: string | null;
  allowanceMicroUsdc: string | null;
}

export interface ArcControlRoomState {
  status: 'ready' | 'degraded';
  reason: string | null;
  chainId: number;
  arenaAddress: `0x${string}` | null;
  usdcAddress: `0x${string}`;
  usdcDecimals: number;
  commitAvailable: boolean;
  latestTxHash: `0x${string}` | null;
  wallets: Record<AgentName, ArcWalletReadiness>;
}

function derivePublicAddress(privateKey: `0x${string}` | null): `0x${string}` | null {
  return privateKey ? privateKeyToAccount(privateKey).address : null;
}

function getCommitDisabledReason(env: ServerEnvConfig): string | null {
  if (!env.agentKeys.volatility && !env.agentKeys.momentum) {
    return 'missing_agent_private_keys';
  }

  if (!env.arc.signalBondArenaAddress) {
    return 'missing_signal_bond_arena_address';
  }

  if (env.arc.chainId !== ARC_TESTNET_CHAIN_ID) {
    return `unsupported_chain_${env.arc.chainId}`;
  }

  if (env.arc.usdcDecimals !== ARC_TESTNET_USDC_DECIMALS) {
    return `unsupported_usdc_decimals_${env.arc.usdcDecimals}`;
  }

  return null;
}

function sanitizeReadinessReason(reason: string | null): string | null {
  if (!reason) {
    return null;
  }

  if (
    reason === 'missing_agent_private_keys' ||
    reason === 'missing_signal_bond_arena_address' ||
    reason === 'arc_chain_mismatch' ||
    reason === 'arc_readiness_unavailable' ||
    reason.startsWith('unsupported_chain_') ||
    reason.startsWith('unsupported_usdc_decimals_')
  ) {
    return reason;
  }

  return 'arc_readiness_unavailable';
}

async function getLatestTxHash(store: PersistenceStore): Promise<`0x${string}` | null> {
  const signals = await store.listSignals();
  const latestSignal = signals
    .filter((signal) => signal.arcTxHash)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0];

  return latestSignal?.arcTxHash ?? null;
}

async function readWalletReadiness(
  publicClient: {
    getChainId: () => Promise<number>;
    readContract: (...args: any[]) => Promise<unknown>;
  },
  env: ServerEnvConfig,
  agentName: AgentName
): Promise<ArcWalletReadiness> {
  const publicAddress = derivePublicAddress(env.agentKeys[agentName]);
  if (!publicAddress || !env.arc.signalBondArenaAddress) {
    return {
      publicAddress,
      usdcBalanceMicroUsdc: null,
      allowanceMicroUsdc: null
    };
  }

  const [balance, allowance] = await Promise.all([
    readUsdcBalance({
      publicClient,
      ownerAddress: publicAddress,
      usdcAddress: env.arc.usdcAddress
    }),
    readUsdcAllowance({
      publicClient,
      ownerAddress: publicAddress,
      spender: env.arc.signalBondArenaAddress,
      usdcAddress: env.arc.usdcAddress
    })
  ]);

  return {
    publicAddress,
    usdcBalanceMicroUsdc: balance.toString(),
    allowanceMicroUsdc: allowance.toString()
  };
}

export async function getArcControlRoomState(options: {
  env?: ServerEnvConfig;
  store?: PersistenceStore;
} = {}): Promise<ArcControlRoomState> {
  const env = options.env ?? getServerEnv();
  const store = options.store ?? getRuntimeStore();
  const reason = sanitizeReadinessReason(getCommitDisabledReason(env));
  const latestTxHash = await getLatestTxHash(store);
  const baseState: ArcControlRoomState = {
    status: reason ? 'degraded' : 'ready',
    reason,
    chainId: env.arc.chainId,
    arenaAddress: env.arc.signalBondArenaAddress,
    usdcAddress: env.arc.usdcAddress,
    usdcDecimals: env.arc.usdcDecimals,
    commitAvailable: !reason,
    latestTxHash,
    wallets: {
      volatility: {
        publicAddress: derivePublicAddress(env.agentKeys.volatility),
        usdcBalanceMicroUsdc: null,
        allowanceMicroUsdc: null
      },
      momentum: {
        publicAddress: derivePublicAddress(env.agentKeys.momentum),
        usdcBalanceMicroUsdc: null,
        allowanceMicroUsdc: null
      }
    }
  };

  if (reason || !env.arc.signalBondArenaAddress) {
    return baseState;
  }

  try {
    const publicClient = createPublicClient({
      chain: arcTestnet,
      transport: http(env.arc.rpcUrl)
    });
    const chainId = await publicClient.getChainId();
    if (chainId !== env.arc.chainId) {
      return {
        ...baseState,
        status: 'degraded',
        reason: sanitizeReadinessReason('arc_chain_mismatch'),
        commitAvailable: false
      };
    }

    const [volatility, momentum] = await Promise.all([
      readWalletReadiness(publicClient as never, env, 'volatility'),
      readWalletReadiness(publicClient as never, env, 'momentum')
    ]);

    return {
      ...baseState,
      wallets: {
        volatility,
        momentum
      }
    };
  } catch (error) {
    return {
      ...baseState,
      status: 'degraded',
      reason: sanitizeReadinessReason(
        error instanceof Error ? error.message : 'arc_readiness_unavailable'
      ),
      commitAvailable: false
    };
  }
}
