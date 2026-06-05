'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  clearBrowserWalletSession,
  createBrowserWalletClients,
  getBrowserWalletProvider,
  readBrowserWalletChainId,
  readBrowserWalletSession,
  requestBrowserWalletAddress,
  subscribeBrowserWalletSessionChange,
  switchBrowserWalletToArc,
  writeBrowserWalletSession,
  type BrowserWalletSession
} from '@/lib/arc/browserWallet';
import { readUsdcAllowance, readUsdcBalance } from '@/lib/arc/usdc';
import { ARC_TESTNET_CHAIN_ID } from '@/lib/config/constants';

type WalletConnectStatus = 'idle' | 'connecting' | 'switching' | 'unavailable' | 'error';

interface WalletConnectButtonProps {
  className?: string;
  onConnected?: (session: BrowserWalletSession) => void;
  onDisconnected?: () => void;
}

interface AutonomyResponse {
  controlRoom: {
    status: 'ready' | 'degraded';
    reason: string | null;
    chainId: number;
    arenaAddress: `0x${string}` | null;
    usdcAddress: `0x${string}`;
    usdcDecimals: number;
    commitAvailable: boolean;
    latestTxHash: `0x${string}` | null;
  };
}

interface WalletReadinessState {
  loading: boolean;
  error: string | null;
  controlRoom: AutonomyResponse['controlRoom'] | null;
  balance: bigint | null;
  allowance: bigint | null;
}

const INITIAL_READINESS: WalletReadinessState = {
  loading: false,
  error: null,
  controlRoom: null,
  balance: null,
  allowance: null
};

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function truncateHash(hash: string | null | undefined) {
  if (!hash) {
    return 'Pending';
  }

  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function formatUsdMicro(value: bigint | null) {
  if (value === null) {
    return 'Unavailable';
  }

  return `$${(Number(value) / 1_000_000).toFixed(2)}`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function WalletIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mini-icon"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path d="M16 12h4" />
    </svg>
  );
}

export function WalletConnectButton({
  className,
  onConnected,
  onDisconnected
}: WalletConnectButtonProps) {
  const onConnectedRef = useRef(onConnected);
  const onDisconnectedRef = useRef(onDisconnected);
  const [session, setSession] = useState<BrowserWalletSession | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [status, setStatus] = useState<WalletConnectStatus>('idle');
  const [message, setMessage] = useState('Connect Wallet');
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [readiness, setReadiness] = useState<WalletReadinessState>(INITIAL_READINESS);

  useEffect(() => {
    onConnectedRef.current = onConnected;
    onDisconnectedRef.current = onDisconnected;
  }, [onConnected, onDisconnected]);

  useEffect(() => {
    setHasProvider(Boolean(getBrowserWalletProvider()));
    const storedSession = readBrowserWalletSession();
    setSession(storedSession);
    if (storedSession) {
      onConnectedRef.current?.(storedSession);
    }

    return subscribeBrowserWalletSessionChange((nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setMessage(shortAddress(nextSession.walletAddress));
        onConnectedRef.current?.(nextSession);
        return;
      }

      setMessage('Connect Wallet');
      setIsPopoverOpen(false);
      setReadiness(INITIAL_READINESS);
      onDisconnectedRef.current?.();
    });
  }, []);

  const wrongChain = Boolean(session && session.chainId !== ARC_TESTNET_CHAIN_ID);

  useEffect(() => {
    if (!session || wrongChain) {
      setIsPopoverOpen(false);
    }

    if (!session) {
      setReadiness(INITIAL_READINESS);
    }
  }, [session, wrongChain]);

  async function loadWalletReadiness(activeSession: BrowserWalletSession) {
    const provider = getBrowserWalletProvider();
    if (!provider) {
      setReadiness({
        loading: false,
        error: 'Wallet provider unavailable.',
        controlRoom: null,
        balance: null,
        allowance: null
      });
      return;
    }

    setReadiness((current) => ({
      ...current,
      loading: true,
      error: null
    }));

    try {
      const payload = await fetchJson<AutonomyResponse>('/api/autonomy');
      const { publicClient } = createBrowserWalletClients(provider, activeSession.walletAddress);
      const balance = await readUsdcBalance({
        publicClient,
        ownerAddress: activeSession.walletAddress,
        usdcAddress: payload.controlRoom.usdcAddress
      });
      const allowance = payload.controlRoom.arenaAddress
        ? await readUsdcAllowance({
            publicClient,
            ownerAddress: activeSession.walletAddress,
            spender: payload.controlRoom.arenaAddress,
            usdcAddress: payload.controlRoom.usdcAddress
          })
        : null;

      setReadiness({
        loading: false,
        error: null,
        controlRoom: payload.controlRoom,
        balance,
        allowance
      });
    } catch (error) {
      setReadiness({
        loading: false,
        error: error instanceof Error ? error.message : 'Wallet readiness unavailable.',
        controlRoom: null,
        balance: null,
        allowance: null
      });
    }
  }

  useEffect(() => {
    if (!session || wrongChain || !isPopoverOpen) {
      return;
    }

    void loadWalletReadiness(session);
  }, [isPopoverOpen, session, wrongChain]);

  async function connectWallet() {
    const provider = getBrowserWalletProvider();
    setHasProvider(Boolean(provider));
    if (!provider) {
      setStatus('unavailable');
      setMessage('Install wallet');
      return;
    }

    try {
      setStatus('connecting');
      setMessage('Connecting...');
      const walletAddress = await requestBrowserWalletAddress(provider);
      if (!walletAddress) {
        setStatus('idle');
        setMessage('Connect Wallet');
        return;
      }

      let chainId = await readBrowserWalletChainId(provider);
      if (chainId !== ARC_TESTNET_CHAIN_ID) {
        setStatus('switching');
        setMessage('Switch to Arc');
        await switchBrowserWalletToArc(provider);
        chainId = await readBrowserWalletChainId(provider);
      }

      const nextSession: BrowserWalletSession = {
        walletAddress,
        chainId,
        connectedAt: new Date().toISOString()
      };
      writeBrowserWalletSession(nextSession);
      setSession(nextSession);
      setReadiness(INITIAL_READINESS);
      setIsPopoverOpen(false);
      setStatus('idle');
      setMessage(shortAddress(walletAddress));
      onConnectedRef.current?.(nextSession);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Wallet error');
    }
  }

  async function switchChain() {
    const provider = getBrowserWalletProvider();
    if (!provider || !session) {
      return connectWallet();
    }

    try {
      setStatus('switching');
      setMessage('Switch to Arc');
      await switchBrowserWalletToArc(provider);
      const chainId = await readBrowserWalletChainId(provider);
      const nextSession = {
        ...session,
        chainId
      };
      writeBrowserWalletSession(nextSession);
      setSession(nextSession);
      setReadiness(INITIAL_READINESS);
      setStatus('idle');
      setMessage(shortAddress(session.walletAddress));
      onConnectedRef.current?.(nextSession);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Switch failed');
    }
  }

  function disconnectWallet() {
    clearBrowserWalletSession();
    setSession(null);
    setStatus('idle');
    setMessage('Connect Wallet');
    setIsPopoverOpen(false);
    setReadiness(INITIAL_READINESS);
    onDisconnectedRef.current?.();
  }

  function handlePrimaryClick() {
    if (wrongChain) {
      void switchChain();
      return;
    }

    if (session) {
      setIsPopoverOpen((current) => !current);
      return;
    }

    void connectWallet();
  }

  const busy = status === 'connecting' || status === 'switching';
  const primaryLabel = busy
    ? message
    : wrongChain
      ? 'Switch to Arc'
      : session
        ? shortAddress(session.walletAddress)
        : hasProvider || status !== 'unavailable'
          ? 'Connect Wallet'
          : 'Install wallet';

  return (
    <div className={['wallet-connect-cluster', className].filter(Boolean).join(' ')}>
      <div className="wallet-connect-shell">
        <button
          type="button"
          className={[
            'wallet-connect-button',
            session ? 'wallet-connect-button-connected' : undefined,
            wrongChain ? 'wallet-connect-button-warning' : undefined
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={handlePrimaryClick}
          disabled={busy || (!hasProvider && !session && status === 'unavailable')}
          title={session ? `Connected wallet ${session.walletAddress}` : 'Connect browser wallet'}
          aria-expanded={session && !wrongChain ? isPopoverOpen : undefined}
          aria-haspopup={session && !wrongChain ? 'dialog' : undefined}
        >
          <WalletIcon />
          {primaryLabel}
        </button>

        {isPopoverOpen && session ? (
          <div
            className="wallet-readiness-popover"
            role="dialog"
            aria-label="Wallet readiness"
          >
            <div className="wallet-readiness-header">
              <div>
                <p className="wallet-readiness-kicker">Wallet readiness</p>
                <h2>Arc status</h2>
              </div>
              <button
                type="button"
                className="wallet-popover-close"
                onClick={() => setIsPopoverOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="wallet-readiness-grid">
              <article className="wallet-readiness-card">
                <span>Connected address</span>
                <strong>{session.walletAddress}</strong>
                <small>Read-only wallet snapshot for Arena actions.</small>
              </article>
              <article className="wallet-readiness-card">
                <span>Arc chain</span>
                <strong>{session.chainId ?? 'Pending'}</strong>
                <small>{wrongChain ? 'Switch to Arc Testnet to continue.' : 'Arc Testnet ready.'}</small>
              </article>
              <article className="wallet-readiness-card">
                <span>USDC balance</span>
                <strong>{formatUsdMicro(readiness.balance)}</strong>
                <small>Balance on Arc Testnet.</small>
              </article>
              <article className="wallet-readiness-card">
                <span>Allowance</span>
                <strong>{formatUsdMicro(readiness.allowance)}</strong>
                <small>Approved to SignalBondArena.</small>
              </article>
              <article className="wallet-readiness-card">
                <span>Contract readiness</span>
                <strong>{readiness.controlRoom?.arenaAddress ? 'Ready' : 'Unavailable'}</strong>
                <small>{readiness.controlRoom?.reason ?? truncateHash(readiness.controlRoom?.arenaAddress)}</small>
              </article>
              <article className="wallet-readiness-card">
                <span>Latest tx</span>
                <strong>{truncateHash(readiness.controlRoom?.latestTxHash)}</strong>
                <small>
                  {readiness.controlRoom?.usdcDecimals ?? 6} decimals · chain{' '}
                  {readiness.controlRoom?.chainId ?? 'pending'}
                </small>
              </article>
            </div>

            <p className="wallet-readiness-note">
              {readiness.loading
                ? 'Loading wallet readiness...'
                : readiness.error ?? 'Read-only snapshot. Funding actions still happen from Arena CTAs.'}
            </p>

            <div className="wallet-readiness-actions">
              <button
                type="button"
                className="wallet-disconnect-button"
                onClick={disconnectWallet}
              >
                Disconnect
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {session && wrongChain ? (
        <button type="button" className="wallet-disconnect-button" onClick={disconnectWallet}>
          Disconnect
        </button>
      ) : null}
    </div>
  );
}
