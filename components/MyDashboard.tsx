'use client';

import React, { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { WalletConnectButton } from '@/components/WalletConnectButton';
import { MyFollowsTable, type MyFollowRow } from '@/components/MyFollowsTable';
import { MyOverviewStrip, type MyOverviewSummary } from '@/components/MyOverviewStrip';
import { MyTxHistoryTable, type MyTxHistoryRow } from '@/components/MyTxHistoryTable';
import {
  clearBrowserWalletSession,
  readBrowserWalletSession,
  subscribeBrowserWalletSessionChange,
  writeBrowserWalletSession
} from '@/lib/arc/browserWallet';

interface EthereumProvider {
  on?: (event: 'accountsChanged', listener: (accounts: string[]) => void) => void;
  removeListener?: (event: 'accountsChanged', listener: (accounts: string[]) => void) => void;
}

interface MyDashboardSummary extends MyOverviewSummary {
  walletAddress: string;
  follows: MyFollowRow[];
  txHistory: MyTxHistoryRow[];
}

async function fetchSummary(url: string): Promise<MyDashboardSummary> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('wallet_summary_unavailable');
  }

  return (await response.json()) as MyDashboardSummary;
}

function normalizeAddress(address: string | null | undefined) {
  return address ? address.toLowerCase() : null;
}

function invalidateWalletCaches() {
  mutate(
    (key) => typeof key === 'string' && key.startsWith('/api/wallet/'),
    undefined,
    { revalidate: false }
  );
}

function browserEthereum(): EthereumProvider | null {
  if (typeof window === 'undefined') {
    return null;
  }

  return ((window as typeof window & { ethereum?: EthereumProvider }).ethereum ?? null);
}

export function MyDashboard() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const swrKey = walletAddress ? `/api/wallet/${walletAddress}/summary` : null;
  const { data, error } = useSWR(swrKey, fetchSummary, {
    refreshInterval: 60_000
  });

  useEffect(() => {
    const initial = readBrowserWalletSession();
    setWalletAddress(normalizeAddress(initial?.walletAddress));

    const unsubscribeSession = subscribeBrowserWalletSessionChange((nextSession) => {
      invalidateWalletCaches();
      setWalletAddress(normalizeAddress(nextSession?.walletAddress));
    });

    const provider = browserEthereum();
    const handleAccountsChanged = (accounts: string[]) => {
      invalidateWalletCaches();
      const nextAddress = normalizeAddress(accounts[0]);

      if (!nextAddress) {
        clearBrowserWalletSession();
        setWalletAddress(null);
        return;
      }

      writeBrowserWalletSession({
        walletAddress: nextAddress as `0x${string}`,
        chainId: initial?.chainId ?? null,
        connectedAt: new Date().toISOString()
      });
      setWalletAddress(nextAddress);
    };

    provider?.on?.('accountsChanged', handleAccountsChanged);

    return () => {
      unsubscribeSession();
      provider?.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, []);

  if (!walletAddress) {
    return (
      <section className="my-connect-shell glass-card">
        <p className="my-kicker">Wallet-bound record</p>
        <h1>Connect to enter My</h1>
        <p>
          Your follows, bonds, payouts, and Arc transactions stay scoped to the connected wallet.
        </p>
        <WalletConnectButton className="my-connect-button" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="my-dashboard">
        <div className="my-identity glass-card">
          <p className="my-kicker">Connected wallet</p>
          <h1>My Dashboard</h1>
          <code>{walletAddress}</code>
        </div>
        <p className="my-error-state">Chain data is still loading. Retrying every minute.</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="my-dashboard">
        <div className="my-identity glass-card">
          <p className="my-kicker">Connected wallet</p>
          <h1>My Dashboard</h1>
          <code>{walletAddress}</code>
        </div>
        <p className="my-loading-state">链上数据获取中...</p>
      </section>
    );
  }

  return (
    <section className="my-dashboard">
      <div className="my-identity glass-card">
        <div>
          <p className="my-kicker">Connected wallet</p>
          <h1>My Dashboard</h1>
        </div>
        <code>{walletAddress}</code>
      </div>

      <MyOverviewStrip data={data} />
      <MyFollowsTable follows={data.follows} />
      <MyTxHistoryTable items={data.txHistory} />
    </section>
  );
}
