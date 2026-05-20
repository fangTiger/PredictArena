import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  ARC_TESTNET_USDC_DECIMALS,
  DEFAULT_SIGNAL_STAKE_MICRO_USDC,
  POLYMARKET_GAMMA_URL
} from '@/lib/config/constants';
import { getServerEnv } from '@/lib/config/env';

export {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  ARC_TESTNET_USDC_DECIMALS,
  POLYMARKET_GAMMA_URL
};

export const DEFAULT_SIGNAL_BOND_MICRO_USDC = DEFAULT_SIGNAL_STAKE_MICRO_USDC;
export const POLYMARKET_FETCH_PAGE_SIZE = 100;
export const POLYMARKET_FETCH_MAX_PAGES = 10;

export interface ArcCommitConfig {
  chainId: number;
  rpcUrl: string;
  usdcAddress: `0x${string}`;
  usdcDecimals: number;
  volatilityPrivateKey?: `0x${string}`;
  momentumPrivateKey?: `0x${string}`;
  arenaAddress?: `0x${string}`;
}

export function getArcCommitConfig(): ArcCommitConfig {
  const env = getServerEnv();

  return {
    chainId: env.arc.chainId,
    rpcUrl: env.arc.rpcUrl,
    usdcAddress: env.arc.usdcAddress,
    usdcDecimals: env.arc.usdcDecimals,
    volatilityPrivateKey: env.agentKeys.volatility ?? undefined,
    momentumPrivateKey: env.agentKeys.momentum ?? undefined,
    arenaAddress: env.arc.signalBondArenaAddress ?? undefined
  };
}

export function getCommitDisabledReason(): string | undefined {
  const env = getServerEnv();

  if (!env.agentKeys.volatility && !env.agentKeys.momentum) {
    return 'Arc commit disabled: missing agent private keys';
  }

  if (!env.arc.signalBondArenaAddress) {
    return 'Arc commit disabled: missing SIGNAL_BOND_ARENA_ADDRESS';
  }

  if (env.arc.chainId !== ARC_TESTNET_CHAIN_ID) {
    return `Arc commit disabled: unsupported chain ${env.arc.chainId}`;
  }

  if (env.arc.usdcDecimals !== ARC_TESTNET_USDC_DECIMALS) {
    return `Arc commit disabled: expected USDC decimals ${ARC_TESTNET_USDC_DECIMALS}`;
  }

  return undefined;
}

export function liveFetchDisabled(): boolean {
  return process.env.PREDICTARENA_DISABLE_LIVE_FETCH === '1';
}
