'use client';

import { useEffect, useRef, useState } from 'react';
import {
  clearBrowserWalletSession,
  getBrowserWalletProvider,
  readBrowserWalletChainId,
  readBrowserWalletSession,
  requestBrowserWalletAddress,
  subscribeBrowserWalletSessionChange,
  switchBrowserWalletToArc,
  writeBrowserWalletSession,
  type BrowserWalletSession
} from '@/lib/arc/browserWallet';
import { ARC_TESTNET_CHAIN_ID } from '@/lib/config/constants';

type WalletConnectStatus = 'idle' | 'connecting' | 'switching' | 'unavailable' | 'error';

interface WalletConnectButtonProps {
  className?: string;
  onConnected?: (session: BrowserWalletSession) => void;
  onDisconnected?: () => void;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
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
      onDisconnectedRef.current?.();
    });
  }, []);

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
    onDisconnectedRef.current?.();
  }

  const wrongChain = Boolean(session && session.chainId !== ARC_TESTNET_CHAIN_ID);
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
      <button
        type="button"
        className={[
          'wallet-connect-button',
          session ? 'wallet-connect-button-connected' : undefined,
          wrongChain ? 'wallet-connect-button-warning' : undefined
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={wrongChain ? switchChain : connectWallet}
        disabled={busy || (!hasProvider && !session && status === 'unavailable')}
        title={session ? `Connected wallet ${session.walletAddress}` : 'Connect browser wallet'}
      >
        <WalletIcon />
        {primaryLabel}
      </button>
      {session ? (
        <button type="button" className="wallet-disconnect-button" onClick={disconnectWallet}>
          Disconnect
        </button>
      ) : null}
    </div>
  );
}
