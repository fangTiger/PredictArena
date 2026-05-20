export const ARC_TESTNET_CHAIN_ID = 5_042_002;
export const ARC_TESTNET_RPC_URL = 'https://rpc.testnet.arc.network';
export const ARC_TESTNET_USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const ARC_TESTNET_USDC_DECIMALS = 6;
export const DEFAULT_SIGNAL_BOND_MICRO_USDC = 25_000_000;
export const POLYMARKET_GAMMA_URL = 'https://gamma-api.polymarket.com/markets';
export const POLYMARKET_FETCH_PAGE_SIZE = 100;
export const POLYMARKET_FETCH_MAX_PAGES = 10;

export interface ArcCommitConfig {
  chainId: number;
  rpcUrl: string;
  usdcAddress: `0x${string}`;
  usdcDecimals: number;
  privateKey?: `0x${string}`;
  vaultAddress?: `0x${string}`;
}

export function getArcCommitConfig(): ArcCommitConfig {
  const rawPrivateKey = process.env.ARC_PRIVATE_KEY?.trim();
  const rawVaultAddress = process.env.ARC_SIGNAL_BOND_VAULT_ADDRESS?.trim();

  return {
    chainId: Number(process.env.ARC_CHAIN_ID ?? ARC_TESTNET_CHAIN_ID),
    rpcUrl: process.env.ARC_RPC_URL ?? ARC_TESTNET_RPC_URL,
    usdcAddress: (process.env.ARC_USDC_ADDRESS ??
      ARC_TESTNET_USDC_ADDRESS) as `0x${string}`,
    usdcDecimals: Number(process.env.ARC_USDC_DECIMALS ?? ARC_TESTNET_USDC_DECIMALS),
    privateKey: rawPrivateKey ? (rawPrivateKey as `0x${string}`) : undefined,
    vaultAddress: rawVaultAddress ? (rawVaultAddress as `0x${string}`) : undefined
  };
}

export function getCommitDisabledReason(): string | undefined {
  const config = getArcCommitConfig();

  if (!config.privateKey) {
    return 'Arc commit disabled: missing ARC_PRIVATE_KEY';
  }

  if (!config.vaultAddress) {
    return 'Arc commit disabled: missing ARC_SIGNAL_BOND_VAULT_ADDRESS';
  }

  if (config.chainId !== ARC_TESTNET_CHAIN_ID) {
    return `Arc commit disabled: unsupported chain ${config.chainId}`;
  }

  if (config.usdcDecimals !== ARC_TESTNET_USDC_DECIMALS) {
    return `Arc commit disabled: expected USDC decimals ${ARC_TESTNET_USDC_DECIMALS}`;
  }

  return undefined;
}

export function liveFetchDisabled(): boolean {
  return process.env.PREDICTARENA_DISABLE_LIVE_FETCH === '1';
}
