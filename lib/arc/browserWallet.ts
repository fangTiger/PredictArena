import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { arcTestnet } from '@/lib/arc/client';
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL
} from '@/lib/config/constants';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { WalletFollowRecord } from '@/lib/persistence/store';
import { isSignalEligibleForCommit } from '@/lib/utils/signal';

export interface BrowserWalletProvider {
  request: <T = unknown>(args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<T>;
  on?: (event: string, listener: (...args: any[]) => void) => void;
  removeListener?: (event: string, listener: (...args: any[]) => void) => void;
}

interface BrowserWalletSource {
  ethereum?: BrowserWalletProvider;
}

export const BROWSER_WALLET_SESSION_EVENT = 'predictarena:wallet-session';
export const BROWSER_WALLET_SESSION_STORAGE_KEY = 'predictarena.walletSession';

export interface BrowserWalletSession {
  walletAddress: `0x${string}`;
  chainId: number | null;
  connectedAt: string;
}

export interface BrowserWalletSessionSource {
  localStorage?: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  dispatchEvent?: (event: Event) => boolean;
  addEventListener?: (event: string, listener: EventListener) => void;
  removeEventListener?: (event: string, listener: EventListener) => void;
}

export type WalletFollowAction =
  | 'install_wallet'
  | 'connect_wallet'
  | 'switch_chain'
  | 'insufficient_balance'
  | 'approve_usdc'
  | 'follow'
  | 'already_followed';

export interface WalletFollowStepInput {
  hasProvider: boolean;
  walletAddress: `0x${string}` | null;
  chainId: number | null;
  requiredChainId: number;
  balanceMicroUsdc: bigint | null;
  allowanceMicroUsdc: bigint | null;
  requiredStakeMicroUsdc: number;
  alreadyFollowed: boolean;
}

export interface WalletFollowStep {
  action: WalletFollowAction;
  label: string;
  disabled: boolean;
}

export function getBrowserWalletProvider(
  source: BrowserWalletSource | undefined = typeof window === 'undefined'
    ? undefined
    : (window as BrowserWalletSource)
): BrowserWalletProvider | null {
  return source?.ethereum?.request ? source.ethereum : null;
}

function defaultSessionSource(): BrowserWalletSessionSource | undefined {
  return typeof window === 'undefined' ? undefined : window;
}

function isWalletAddress(value: unknown): value is `0x${string}` {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function dispatchBrowserWalletSessionChange(
  session: BrowserWalletSession | null,
  source = defaultSessionSource()
): void {
  if (!source?.dispatchEvent || typeof CustomEvent === 'undefined') {
    return;
  }

  source.dispatchEvent(new CustomEvent(BROWSER_WALLET_SESSION_EVENT, { detail: session }));
}

export function readBrowserWalletSession(
  source = defaultSessionSource()
): BrowserWalletSession | null {
  try {
    const raw = source?.localStorage?.getItem(BROWSER_WALLET_SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<BrowserWalletSession>;
    if (!isWalletAddress(parsed.walletAddress)) {
      return null;
    }

    return {
      walletAddress: parsed.walletAddress,
      chainId: typeof parsed.chainId === 'number' ? parsed.chainId : null,
      connectedAt: typeof parsed.connectedAt === 'string' ? parsed.connectedAt : new Date().toISOString()
    };
  } catch {
    return null;
  }
}

export function writeBrowserWalletSession(
  session: BrowserWalletSession,
  source = defaultSessionSource()
): void {
  source?.localStorage?.setItem(BROWSER_WALLET_SESSION_STORAGE_KEY, JSON.stringify(session));
  dispatchBrowserWalletSessionChange(session, source);
}

export function clearBrowserWalletSession(source = defaultSessionSource()): void {
  source?.localStorage?.removeItem(BROWSER_WALLET_SESSION_STORAGE_KEY);
  dispatchBrowserWalletSessionChange(null, source);
}

export function subscribeBrowserWalletSessionChange(
  listener: (session: BrowserWalletSession | null) => void,
  source = defaultSessionSource()
): () => void {
  if (!source?.addEventListener || !source.removeEventListener) {
    return () => undefined;
  }

  const handleSessionEvent: EventListener = (event) => {
    listener((event as CustomEvent<BrowserWalletSession | null>).detail ?? null);
  };
  const handleStorageEvent: EventListener = () => {
    listener(readBrowserWalletSession(source));
  };

  source.addEventListener(BROWSER_WALLET_SESSION_EVENT, handleSessionEvent);
  source.addEventListener('storage', handleStorageEvent);

  return () => {
    source.removeEventListener?.(BROWSER_WALLET_SESSION_EVENT, handleSessionEvent);
    source.removeEventListener?.('storage', handleStorageEvent);
  };
}

export function getWalletFollowStep(input: WalletFollowStepInput): WalletFollowStep {
  if (!input.hasProvider) {
    return { action: 'install_wallet', label: 'Install wallet', disabled: true };
  }

  if (!input.walletAddress) {
    return { action: 'connect_wallet', label: 'Connect wallet', disabled: false };
  }

  if (input.alreadyFollowed) {
    return { action: 'already_followed', label: 'Followed', disabled: true };
  }

  if (input.chainId !== input.requiredChainId) {
    return { action: 'switch_chain', label: 'Switch to Arc', disabled: false };
  }

  const requiredStake = BigInt(input.requiredStakeMicroUsdc);
  if (input.balanceMicroUsdc !== null && input.balanceMicroUsdc < requiredStake) {
    return { action: 'insufficient_balance', label: 'Need USDC', disabled: true };
  }

  if (input.allowanceMicroUsdc !== null && input.allowanceMicroUsdc < requiredStake) {
    return { action: 'approve_usdc', label: 'Approve USDC', disabled: false };
  }

  return { action: 'follow', label: 'Follow with Wallet', disabled: false };
}

export function selectWalletFundableSignal(
  signals: AgentSignal[],
  walletFollows: Array<Pick<WalletFollowRecord, 'signalId' | 'walletAddress'>>,
  walletAddress: `0x${string}` | null
): AgentSignal | null {
  const connectedWallet = walletAddress?.toLowerCase() ?? null;

  return (
    signals.find((signal) => {
      if (!isSignalEligibleForCommit(signal) || signal.arcTxHash) {
        return false;
      }

      if (!connectedWallet) {
        return true;
      }

      return !walletFollows.some(
        (follow) =>
          follow.signalId === signal.id && follow.walletAddress.toLowerCase() === connectedWallet
      );
    }) ?? null
  );
}

export async function requestBrowserWalletAddress(
  provider: BrowserWalletProvider
): Promise<`0x${string}` | null> {
  const accounts = await provider.request<string[]>({ method: 'eth_requestAccounts' });
  return (accounts[0] as `0x${string}` | undefined) ?? null;
}

export async function readBrowserWalletChainId(provider: BrowserWalletProvider): Promise<number | null> {
  const chainId = await provider.request<string>({ method: 'eth_chainId' });
  return chainId ? Number.parseInt(chainId, 16) : null;
}

export async function switchBrowserWalletToArc(provider: BrowserWalletProvider): Promise<void> {
  const chainIdHex = `0x${ARC_TESTNET_CHAIN_ID.toString(16)}`;
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }]
    });
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? Number(error.code) : null;
    if (code !== 4902) {
      throw error;
    }

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: 'Arc Testnet',
          nativeCurrency: {
            decimals: 18,
            name: 'Arc',
            symbol: 'ARC'
          },
          rpcUrls: [ARC_TESTNET_RPC_URL],
          blockExplorerUrls: [ARC_TESTNET_EXPLORER_URL]
        }
      ]
    });
  }
}

export function createBrowserWalletClients(provider: BrowserWalletProvider, account: `0x${string}`) {
  return {
    publicClient: createPublicClient({
      chain: arcTestnet,
      transport: http(ARC_TESTNET_RPC_URL)
    }),
    walletClient: createWalletClient({
      account,
      chain: arcTestnet,
      transport: custom(provider)
    })
  };
}
