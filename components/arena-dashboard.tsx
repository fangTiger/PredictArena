'use client';

import React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import useSWR from 'swr';
import { PendingFollowsRow } from '@/components/PendingFollowsRow';
import { ShowdownGrid } from '@/components/ShowdownGrid';
import type { ShowdownCardData } from '@/components/ShowdownCard';
import {
  createBrowserWalletClients,
  getBrowserWalletProvider,
  getWalletFollowStep,
  readBrowserWalletChainId,
  readBrowserWalletSession,
  requestBrowserWalletAddress,
  selectWalletFundableSignal,
  subscribeBrowserWalletSessionChange,
  switchBrowserWalletToArc,
  writeBrowserWalletSession
} from '@/lib/arc/browserWallet';
import { commitArenaSignal } from '@/lib/arc/signalBondArena';
import { ensureUsdcAllowance, readUsdcAllowance, readUsdcBalance } from '@/lib/arc/usdc';
import { ARC_TESTNET_CHAIN_ID } from '@/lib/config/constants';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { WalletFollowRecord } from '@/lib/persistence/store';

interface ShowdownsResponse {
  showdowns: ShowdownCardData[];
}

interface WalletFollowResponse {
  follow?: WalletFollowRecord;
  reason?: string;
}

interface WalletFollowSummaryItem extends WalletFollowRecord {
  marketQuestion: string;
  status: 'confirmed';
}

interface WalletSummaryResponse {
  walletAddress: string;
  follows?: WalletFollowSummaryItem[];
  walletFollows?: WalletFollowSummaryItem[];
}

interface RunAgentsResponse {
  signals: AgentSignal[];
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

type WalletActionState =
  | 'idle'
  | 'connecting'
  | 'switching'
  | 'approving'
  | 'submitting'
  | 'confirming';

function truncateHash(hash: string | null | undefined) {
  if (!hash) {
    return 'Pending';
  }

  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

function truncateAddress(address: string | null | undefined) {
  if (!address) {
    return 'Not connected';
  }

  return `${address.slice(0, 8)}...${address.slice(-4)}`;
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

function toWalletFollowRecords(payload: WalletSummaryResponse | null | undefined): WalletFollowRecord[] {
  const follows = payload?.walletFollows ?? payload?.follows ?? [];
  return follows.map(({ marketQuestion: _marketQuestion, status: _status, ...follow }) => follow);
}

function hasWalletFollowForSignal(
  follows: Array<Pick<WalletFollowRecord, 'signalId' | 'walletAddress'>>,
  signalId: string | null | undefined,
  address: `0x${string}` | null
) {
  if (!signalId || !address) {
    return false;
  }

  const normalizedAddress = address.toLowerCase();
  return follows.some(
    (follow) => follow.signalId === signalId && follow.walletAddress.toLowerCase() === normalizedAddress
  );
}

function getArenaActionErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Arena action failed.';
  }

  if (error.message === 'wallet_follow_duplicate') {
    return 'This wallet already follows the selected signal.';
  }

  if (error.message === 'wallet_follow_summary_unavailable') {
    return 'Wallet follow history is unavailable. Retry before submitting.';
  }

  return error.message;
}

export function ArenaDashboard() {
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [walletFollows, setWalletFollows] = useState<WalletFollowRecord[]>([]);
  const [walletAddress, setWalletAddress] = useState<`0x${string}` | null>(null);
  const [walletChainId, setWalletChainId] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<bigint | null>(null);
  const [walletAllowance, setWalletAllowance] = useState<bigint | null>(null);
  const [hasWalletProvider, setHasWalletProvider] = useState(false);
  const [walletMessage, setWalletMessage] = useState('Run agents to generate a wallet-fundable signal.');
  const [walletActionState, setWalletActionState] = useState<WalletActionState>('idle');
  const [controlRoom, setControlRoom] = useState<AutonomyResponse['controlRoom'] | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    data: showdownPayload,
    error: showdownError
  } = useSWR<ShowdownsResponse>('/api/showdowns?status=all&limit=50', fetchJson, {
    refreshInterval: 30000,
    revalidateOnFocus: true
  });

  useEffect(() => {
    setHasWalletProvider(Boolean(getBrowserWalletProvider()));

    const initialSession = readBrowserWalletSession();
    if (initialSession) {
      setWalletAddress(initialSession.walletAddress);
      setWalletChainId(initialSession.chainId);
    }

    return subscribeBrowserWalletSessionChange((session) => {
      setWalletAddress(session?.walletAddress ?? null);
      setWalletChainId(session?.chainId ?? null);
      if (!session) {
        setWalletFollows([]);
        setWalletBalance(null);
        setWalletAllowance(null);
      }
    });
  }, []);

  const refreshAutonomy = useCallback(async () => {
    try {
      const payload = await fetchJson<AutonomyResponse>('/api/autonomy');
      setControlRoom(payload.controlRoom);
    } catch (error) {
      setWalletMessage(error instanceof Error ? error.message : 'Autonomy state unavailable.');
    }
  }, []);

  const getWalletControlRoom = useCallback(async () => {
    if (controlRoom?.arenaAddress) {
      return controlRoom;
    }

    const payload = await fetchJson<AutonomyResponse>('/api/autonomy');
    setControlRoom(payload.controlRoom);
    if (!payload.controlRoom.arenaAddress) {
      throw new Error('Signal bond contract is not configured.');
    }

    return payload.controlRoom;
  }, [controlRoom]);

  const refreshWalletReadiness = useCallback(
    async (address = walletAddress) => {
      const provider = getBrowserWalletProvider();
      if (!provider || !address) {
        return;
      }

      const room = await getWalletControlRoom();
      if (!room.arenaAddress) {
        throw new Error('Signal bond contract is not configured.');
      }

      const { publicClient } = createBrowserWalletClients(provider, address);
      const [balance, allowance] = await Promise.all([
        readUsdcBalance({
          publicClient,
          ownerAddress: address,
          usdcAddress: room.usdcAddress
        }),
        readUsdcAllowance({
          publicClient,
          ownerAddress: address,
          spender: room.arenaAddress,
          usdcAddress: room.usdcAddress
        })
      ]);

      setWalletBalance(balance);
      setWalletAllowance(allowance);
    },
    [getWalletControlRoom, walletAddress]
  );

  const refreshWalletFollowSummary = useCallback(
    async (address = walletAddress, options: { failSoft?: boolean } = {}) => {
      if (!address) {
        setWalletFollows([]);
        return [];
      }

      try {
        const payload = await fetchJson<WalletSummaryResponse>(`/api/wallet/${address}/summary`);
        const follows = toWalletFollowRecords(payload);
        setWalletFollows(follows);
        return follows;
      } catch {
        if (options.failSoft) {
          return [];
        }

        throw new Error('wallet_follow_summary_unavailable');
      }
    },
    [walletAddress]
  );

  useEffect(() => {
    void refreshAutonomy();
  }, [refreshAutonomy]);

  useEffect(() => {
    if (!walletAddress) {
      return;
    }

    void refreshWalletReadiness(walletAddress).catch((error) => {
      setWalletMessage(error instanceof Error ? error.message : 'Wallet readiness unavailable.');
    });
  }, [walletAddress, refreshWalletReadiness]);

  useEffect(() => {
    if (!walletAddress) {
      setWalletFollows([]);
      return;
    }

    void refreshWalletFollowSummary(walletAddress, { failSoft: true });
  }, [walletAddress, refreshWalletFollowSummary]);

  async function connectWallet() {
    setWalletActionState('connecting');
    try {
      const provider = getBrowserWalletProvider();
      setHasWalletProvider(Boolean(provider));
      if (!provider) {
        throw new Error('Browser wallet plugin unavailable.');
      }

      const address = await requestBrowserWalletAddress(provider);
      const chainId = await readBrowserWalletChainId(provider);
      if (!address) {
        throw new Error('No wallet account selected.');
      }

      setWalletAddress(address);
      setWalletChainId(chainId);
      writeBrowserWalletSession({
        walletAddress: address,
        chainId,
        connectedAt: new Date().toISOString()
      });
      await Promise.all([
        refreshWalletReadiness(address),
        refreshWalletFollowSummary(address, { failSoft: true })
      ]);
      return address;
    } finally {
      setWalletActionState('idle');
    }
  }

  async function requestWalletAddressOnly(
    provider: NonNullable<ReturnType<typeof getBrowserWalletProvider>>
  ) {
    const address = await requestBrowserWalletAddress(provider);
    if (!address) {
      throw new Error('No wallet account selected.');
    }

    return address;
  }

  async function runAgents() {
    const response = await fetch('/api/run-agents', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ limit: 20 })
    });
    const payload = (await response.json()) as RunAgentsResponse;
    if (!response.ok) {
      throw new Error('Agent run failed.');
    }

    setSignals(payload.signals ?? []);
    setWalletMessage(`Generated ${payload.signals?.length ?? 0} signals from the latest run.`);
    await refreshAutonomy();
    return payload;
  }

  async function runAgentsAndFollowSignal() {
    const payload = await runAgents();
    let address = walletAddress;
    if (!address) {
      const provider = getBrowserWalletProvider();
      setHasWalletProvider(Boolean(provider));
      if (!provider) {
        throw new Error('Browser wallet plugin unavailable.');
      }

      address = await requestWalletAddressOnly(provider);
    }

    const follows = await refreshWalletFollowSummary(address);
    const signal = selectWalletFundableSignal(payload.signals ?? [], follows, address);
    if (!signal) {
      setWalletMessage('No wallet-fundable signal was generated in this run.');
      return;
    }

    await followSignalWithWallet(signal, address);
  }

  async function followSignalWithWallet(
    signal: AgentSignal,
    preferredAddress: `0x${string}` | null = walletAddress
  ) {
    try {
      const provider = getBrowserWalletProvider();
      setHasWalletProvider(Boolean(provider));
      if (!provider) {
        throw new Error('Browser wallet plugin unavailable.');
      }

      let address = preferredAddress;
      if (!address) {
        address = await requestWalletAddressOnly(provider);
      }

      const follows = await refreshWalletFollowSummary(address);
      if (hasWalletFollowForSignal(follows, signal.id, address)) {
        throw new Error('wallet_follow_duplicate');
      }

      let chainId = await readBrowserWalletChainId(provider);
      if (chainId !== ARC_TESTNET_CHAIN_ID) {
        setWalletActionState('switching');
        setWalletMessage('Switching wallet to Arc Testnet.');
        await switchBrowserWalletToArc(provider);
        chainId = await readBrowserWalletChainId(provider);
      }

      setWalletAddress(address);
      setWalletChainId(chainId);
      writeBrowserWalletSession({
        walletAddress: address,
        chainId,
        connectedAt: new Date().toISOString()
      });

      const room = await getWalletControlRoom();
      if (!room.arenaAddress) {
        throw new Error('Signal bond contract is not configured.');
      }

      const { publicClient, walletClient } = createBrowserWalletClients(provider, address);
      const [balance, allowance] = await Promise.all([
        readUsdcBalance({
          publicClient,
          ownerAddress: address,
          usdcAddress: room.usdcAddress
        }),
        readUsdcAllowance({
          publicClient,
          ownerAddress: address,
          spender: room.arenaAddress,
          usdcAddress: room.usdcAddress
        })
      ]);

      setWalletBalance(balance);
      setWalletAllowance(allowance);

      const stake = BigInt(signal.stakeMicroUsdc);
      if (balance < stake) {
        throw new Error('Connected wallet needs more Arc Testnet USDC.');
      }

      if (allowance < stake) {
        setWalletActionState('approving');
        setWalletMessage('Approve USDC in your wallet.');
        await ensureUsdcAllowance({
          publicClient,
          walletClient,
          ownerAddress: address,
          spender: room.arenaAddress,
          usdcAddress: room.usdcAddress,
          amount: stake
        });
      }

      setWalletActionState('submitting');
      setWalletMessage('Submit wallet follow transaction.');
      const txHash = await commitArenaSignal({
        walletClient,
        arenaAddress: room.arenaAddress,
        signal
      });

      setWalletActionState('confirming');
      setWalletMessage('Confirming wallet follow receipt.');
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const response = await fetch('/api/wallet/follows', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          signalId: signal.id,
          walletAddress: address,
          txHash
        })
      });
      const payload = (await response.json()) as WalletFollowResponse;
      if (!response.ok || !payload.follow) {
        throw new Error(payload.reason ?? 'wallet_follow_failed');
      }

      setWalletFollows((current) => [
        payload.follow!,
        ...current.filter((follow) => follow.txHash.toLowerCase() !== txHash.toLowerCase())
      ]);
      setWalletMessage(`Followed ${signal.marketQuestion} with ${truncateAddress(address)}.`);
      await refreshWalletReadiness(address);
      await refreshAutonomy();
    } finally {
      setWalletActionState('idle');
    }
  }

  function runAction(action: () => Promise<unknown>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        setWalletMessage(getArenaActionErrorMessage(error));
      }
    });
  }

  const fundableSignal = selectWalletFundableSignal(signals, walletFollows, walletAddress);
  const walletFollowStep = getWalletFollowStep({
    hasProvider: hasWalletProvider,
    walletAddress,
    chainId: walletChainId,
    requiredChainId: ARC_TESTNET_CHAIN_ID,
    balanceMicroUsdc: walletBalance,
    allowanceMicroUsdc: walletAllowance,
    requiredStakeMicroUsdc: fundableSignal?.stakeMicroUsdc ?? 0,
    alreadyFollowed: hasWalletFollowForSignal(walletFollows, fundableSignal?.id, walletAddress)
  });

  return (
    <section className="arena-dashboard" data-component="arena-dashboard">
      {walletAddress ? <PendingFollowsRow walletAddress={walletAddress} /> : null}

      <header className="arena-dashboard-header">
        <div className="arena-dashboard-copy">
          <p className="arena-dashboard-kicker">Arc operator surface</p>
          <h1 className="arena-dashboard-title">Showdown Arena</h1>
          <p className="arena-dashboard-summary">
            Live operator desk for agent-vs-agent bond matches. Active and settled showdowns stay
            in view while you trigger fresh runs and selectively fund wallet follows.
          </p>
        </div>
        <div className="arena-dashboard-ledger glass-card">
          <div className="arena-ledger-row">
            <span>Showdowns loaded</span>
            <strong>{showdownPayload?.showdowns.length ?? 0}</strong>
          </div>
          <div className="arena-ledger-row">
            <span>Signals in memory</span>
            <strong>{signals.length}</strong>
          </div>
          <div className="arena-ledger-row">
            <span>Wallet follows</span>
            <strong>{walletFollows.length}</strong>
          </div>
        </div>
      </header>

      <div className="arena-dashboard-layout">
        <div className="arena-dashboard-main">
          <ShowdownGrid
            showdowns={showdownPayload?.showdowns ?? []}
            loading={!showdownPayload && !showdownError}
            error={showdownError}
          />
        </div>

        <aside className="arena-dashboard-sidebar">
          <section className="arena-operator-panel glass-card">
            <div className="arena-panel-header">
              <div>
                <p className="arena-panel-kicker">Operator strip</p>
                <h2>Run + fund</h2>
              </div>
              <span className={`arena-chip ${walletAddress ? 'arena-chip-ready' : 'arena-chip-warn'}`}>
                {walletAddress ? truncateAddress(walletAddress) : walletFollowStep.label}
              </span>
            </div>

            <div className="arena-cta-row">
              <button
                type="button"
                className="arena-cta-primary"
                onClick={() => runAction(runAgents)}
                disabled={isPending}
              >
                Run Agents
              </button>
              <button
                type="button"
                className="arena-cta-secondary"
                onClick={() => runAction(runAgentsAndFollowSignal)}
                disabled={isPending}
              >
                Run Agents + Follow
              </button>
              <button
                type="button"
                className="arena-cta-tertiary"
                onClick={() => {
                  if (!fundableSignal) {
                    setWalletMessage('Run agents first to surface a fundable signal.');
                    return;
                  }

                  runAction(() => followSignalWithWallet(fundableSignal));
                }}
                disabled={isPending || !fundableSignal || walletFollowStep.disabled}
              >
                {fundableSignal ? walletFollowStep.label : 'Run agents first'}
              </button>
            </div>

            <div className="arena-fundable-card">
              <span className="arena-mini-label">Selected follow candidate</span>
              {fundableSignal ? (
                <>
                  <strong>{fundableSignal.marketQuestion}</strong>
                  <p>
                    {fundableSignal.agentName} · {fundableSignal.side} · edge {(fundableSignal.edgeBps / 100).toFixed(2)}%
                  </p>
                </>
              ) : (
                <p>No fundable signal is queued yet.</p>
              )}
            </div>

            <p className="arena-status-note">
              {walletActionState === 'idle' ? walletMessage : `${walletActionState}: ${walletMessage}`}
            </p>
          </section>

          <section className="arena-operator-panel glass-card">
            <div className="arena-panel-header">
              <div>
                <p className="arena-panel-kicker">Wallet readiness</p>
                <h2>Arc status</h2>
              </div>
              <span className={`arena-chip ${controlRoom?.commitAvailable ? 'arena-chip-ready' : 'arena-chip-muted'}`}>
                {controlRoom?.status ?? 'loading'}
              </span>
            </div>

            <div className="arena-status-grid">
              <article className="arena-status-card">
                <span>Current wallet</span>
                <strong>{truncateAddress(walletAddress)}</strong>
                <small>{walletAddress ? `Arc chain ${walletChainId ?? 'pending'}` : 'Connect from TopNav or action CTA'}</small>
              </article>
              <article className="arena-status-card">
                <span>USDC balance</span>
                <strong>{formatUsdMicro(walletBalance)}</strong>
                <small>Connected wallet on Arc</small>
              </article>
              <article className="arena-status-card">
                <span>Allowance</span>
                <strong>{formatUsdMicro(walletAllowance)}</strong>
                <small>Approved to SignalBondArena</small>
              </article>
              <article className="arena-status-card">
                <span>Contract readiness</span>
                <strong>{controlRoom?.arenaAddress ? 'Ready' : 'Unavailable'}</strong>
                <small>{controlRoom?.reason ?? truncateAddress(controlRoom?.arenaAddress)}</small>
              </article>
              <article className="arena-status-card">
                <span>Latest tx</span>
                <strong>{truncateHash(controlRoom?.latestTxHash)}</strong>
                <small>{controlRoom?.usdcDecimals ?? 6} decimals · chain {controlRoom?.chainId ?? 'pending'}</small>
              </article>
            </div>
          </section>

          <section className="arena-operator-panel glass-card">
            <div className="arena-panel-header">
              <div>
                <p className="arena-panel-kicker">Run output</p>
                <h2>Latest candidates</h2>
              </div>
              <span className="arena-chip arena-chip-muted">{signals.length}</span>
            </div>

            <div className="arena-run-output">
              {signals.slice(0, 3).map((signal) => (
                <article key={signal.id} className="arena-run-item">
                  <div>
                    <strong>{signal.marketQuestion}</strong>
                    <p>
                      {signal.agentName} · {signal.side} · {signal.confidence}
                    </p>
                  </div>
                  <span>{(signal.agentProbabilityBps / 100).toFixed(2)}%</span>
                </article>
              ))}
              {signals.length === 0 ? <p className="arena-status-note">No agent run loaded yet.</p> : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}
