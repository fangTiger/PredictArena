'use client';

import React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { PendingFollowsRow } from '@/components/PendingFollowsRow';
import { ShowdownGrid, type PreviewShowdownCandidate } from '@/components/ShowdownGrid';
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

interface RunAgentsDiscoverySkip {
  marketId: string;
  reason: string;
  detail?: string;
}

interface RunAgentsDiscoveryResult {
  discovered: number;
  opened: number;
  skips: RunAgentsDiscoverySkip[];
}

interface RunAgentsDiscoverySummary {
  status: 'ok' | 'error';
  result: RunAgentsDiscoveryResult | null;
  reason: string | null;
}

interface WalletFollowResponse {
  follow?: WalletFollowRecord;
  reason?: string;
}

interface WalletFollowSummaryItem extends Partial<WalletFollowRecord> {
  id: string;
  signalId: string;
  walletAddress: `0x${string}`;
  marketQuestion: string;
  status: 'pending' | 'confirmed' | 'resolved-win' | 'resolved-loss';
  followTxHash?: `0x${string}`;
  bondedMicroUsdc?: string;
}

interface WalletSummaryResponse {
  walletAddress: string;
  follows?: WalletFollowSummaryItem[];
  walletFollows?: WalletFollowSummaryItem[];
}

interface RunAgentsResponse {
  signals: AgentSignal[];
  showdowns?: {
    discovery?: RunAgentsDiscoverySummary;
  };
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

const SHOWDOWNS_SWR_KEY = '/api/showdowns?status=all&limit=50';
const SIGNALS_PAGE_SIZE = 3;
const PREVIEW_CANDIDATE_LIMIT = 5;
const NO_CANDIDATE_SKIP_REASONS = new Set(['no-active-signals', 'no-pair', 'same-side']);
const WAITING_DISCOVERY_REASONS = new Set([
  'showdown_discovery_config_missing',
  'showdown_discovery_bond_invalid',
  'showdown_discovery_deadline_invalid'
]);

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

function formatPercentFromBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}

function formatSignalTimestamp(value: string) {
  return `${new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
    minute: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric'
  }).format(new Date(value))} UTC`;
}

function formatCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isWaitingDiscoveryReason(reason: string | null | undefined) {
  if (!reason) {
    return false;
  }

  return (
    WAITING_DISCOVERY_REASONS.has(reason) ||
    reason.startsWith('showdown_discovery_agent_key_missing:')
  );
}

function hasSkipReason(result: RunAgentsDiscoveryResult, reason: string) {
  return result.skips.some((skip) => skip.reason === reason);
}

function hasOnlyNoCandidateSkips(result: RunAgentsDiscoveryResult) {
  return (
    result.skips.length > 0 &&
    result.skips.every((skip) => NO_CANDIDATE_SKIP_REASONS.has(skip.reason))
  );
}

function buildRunAgentsMessage(
  signalCount: number,
  discovery: RunAgentsDiscoverySummary | undefined
) {
  const prefix = `Generated ${formatCount(signalCount, 'signal', 'signals')}.`;

  if (!discovery) {
    return `${prefix} Automatic discovery ran after the latest agent run.`;
  }

  if (discovery.status === 'error') {
    if (isWaitingDiscoveryReason(discovery.reason)) {
      return `${prefix} Automatic discovery is waiting on operator configuration before it can open matches.`;
    }

    return `${prefix} Automatic discovery hit a safe operator error, so Arena may stay unchanged for now.`;
  }

  const result = discovery.result;
  if (!result) {
    return `${prefix} Automatic discovery ran after the latest agent run.`;
  }

  if (result.opened > 0) {
    return `${prefix} Automatic discovery opened ${formatCount(
      result.opened,
      'showdown',
      'showdowns'
    )}. Arena refreshed for live matches.`;
  }

  if (hasSkipReason(result, 'operator-gas-low') || hasSkipReason(result, 'budget-exhausted')) {
    return `${prefix} Automatic discovery ran, but budget or gas safeguards kept Arena unchanged.`;
  }

  if (hasSkipReason(result, 'existing-open')) {
    return `${prefix} Automatic discovery found an eligible candidate, but that market already has a live showdown.`;
  }

  if (result.discovered === 0 || hasOnlyNoCandidateSkips(result)) {
    return `${prefix} Automatic discovery did not find an opposing match yet.`;
  }

  return `${prefix} Automatic discovery ran, but no new showdown opened this round.`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

function getWalletSummaryKey(address: string) {
  return `/api/wallet/${address}/summary`;
}

function toWalletFollowRecords(payload: WalletSummaryResponse | null | undefined): WalletFollowRecord[] {
  const follows = payload?.walletFollows ?? payload?.follows ?? [];
  return follows
    .map(({ marketQuestion: _marketQuestion, status: _status, followTxHash, bondedMicroUsdc, ...follow }) => ({
      ...follow,
      txHash: follow.txHash ?? followTxHash,
      stakeMicroUsdc: follow.stakeMicroUsdc ?? (bondedMicroUsdc ? Number(bondedMicroUsdc) : 0)
    }))
    .filter((follow): follow is WalletFollowRecord => Boolean(follow.txHash));
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

function isPreviewEligibleSignal(signal: AgentSignal) {
  return (
    signal.resolution === null &&
    (signal.status === 'generated' || signal.status === 'committed')
  );
}

function buildPreviewShowdownCandidates(signals: AgentSignal[]): PreviewShowdownCandidate[] {
  const signalsByMarket = new Map<string, AgentSignal[]>();

  for (const signal of signals) {
    if (!isPreviewEligibleSignal(signal)) {
      continue;
    }

    const marketSignals = signalsByMarket.get(signal.marketId) ?? [];
    marketSignals.push(signal);
    signalsByMarket.set(signal.marketId, marketSignals);
  }

  return Array.from(signalsByMarket.values())
    .flatMap((marketSignals) => {
      let bestCandidate: PreviewShowdownCandidate | null = null;
      let bestNearMissCandidate: PreviewShowdownCandidate | null = null;

      for (let leftIndex = 0; leftIndex < marketSignals.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < marketSignals.length; rightIndex += 1) {
          const left = marketSignals[leftIndex]!;
          const right = marketSignals[rightIndex]!;

          if (left.agentName === right.agentName) {
            continue;
          }

          const source = left.source === right.source ? left.source : `${left.source} + ${right.source}`;

          if (left.side !== 'AVOID' && right.side !== 'AVOID' && left.side !== right.side) {
            const yesSignal = left.side === 'YES' ? left : right;
            const noSignal = left.side === 'NO' ? left : right;
            const candidate: PreviewShowdownCandidate = {
              kind: 'opposing',
              marketId: left.marketId,
              marketQuestion: left.marketQuestion,
              agentA: {
                name: yesSignal.agentName,
                side: 'YES',
                probabilityBps: yesSignal.agentProbabilityBps
              },
              agentB: {
                name: noSignal.agentName,
                side: 'NO',
                probabilityBps: noSignal.agentProbabilityBps
              },
              spreadBps: Math.abs(yesSignal.agentProbabilityBps - noSignal.agentProbabilityBps),
              source
            };

            if (!bestCandidate || candidate.spreadBps > bestCandidate.spreadBps) {
              bestCandidate = candidate;
            }
            continue;
          }

          const nearMissCandidate: PreviewShowdownCandidate = {
            kind: 'near_miss',
            marketId: left.marketId,
            marketQuestion: left.marketQuestion,
            agentA: {
              name: left.agentName,
              side: left.side,
              probabilityBps: left.agentProbabilityBps
            },
            agentB: {
              name: right.agentName,
              side: right.side,
              probabilityBps: right.agentProbabilityBps
            },
            spreadBps: Math.abs(left.agentProbabilityBps - right.agentProbabilityBps),
            source
          };

          if (!bestNearMissCandidate || nearMissCandidate.spreadBps > bestNearMissCandidate.spreadBps) {
            bestNearMissCandidate = nearMissCandidate;
          }
        }
      }

      return bestCandidate ? [bestCandidate] : bestNearMissCandidate ? [bestNearMissCandidate] : [];
    })
    .sort((left, right) => {
      if (left.spreadBps !== right.spreadBps) {
        return right.spreadBps - left.spreadBps;
      }

      return left.marketId.localeCompare(right.marketId);
    });
}

function shouldShowPreviewCandidates(discovery: RunAgentsDiscoverySummary | null) {
  const result = discovery?.result;
  if (!result) {
    return true;
  }

  if (result.opened > 0 || hasSkipReason(result, 'existing-open')) {
    return false;
  }

  return true;
}

export function ArenaDashboard() {
  const [signals, setSignals] = useState<AgentSignal[]>([]);
  const [signalPage, setSignalPage] = useState(1);
  const [selectedSignalId, setSelectedSignalId] = useState<string | null>(null);
  const [latestDiscovery, setLatestDiscovery] = useState<RunAgentsDiscoverySummary | null>(null);
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
  const { mutate } = useSWRConfig();

  const {
    data: showdownPayload,
    error: showdownError
  } = useSWR<ShowdownsResponse>(SHOWDOWNS_SWR_KEY, fetchJson, {
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
        const payload = await fetchJson<WalletSummaryResponse>(getWalletSummaryKey(address));
        const follows = toWalletFollowRecords(payload);
        setWalletFollows(follows);
        await mutate(getWalletSummaryKey(address), payload, { revalidate: false });
        return follows;
      } catch {
        if (options.failSoft) {
          return [];
        }

        throw new Error('wallet_follow_summary_unavailable');
      }
    },
    [mutate, walletAddress]
  );

  useEffect(() => {
    void refreshAutonomy();
  }, [refreshAutonomy]);

  useEffect(() => {
    if (!walletAddress || walletChainId === null) {
      return;
    }

    void refreshWalletReadiness(walletAddress).catch((error) => {
      setWalletMessage(error instanceof Error ? error.message : 'Wallet status unavailable.');
    });
  }, [walletAddress, walletChainId, refreshWalletReadiness]);

  useEffect(() => {
    if (!walletAddress) {
      setWalletFollows([]);
      return;
    }

    void refreshWalletFollowSummary(walletAddress, { failSoft: true });
  }, [walletAddress, refreshWalletFollowSummary]);

  useEffect(() => {
    setSignalPage(1);
    setSelectedSignalId(null);
  }, [signals]);

  async function ensureWalletConnected() {
    if (walletAddress) {
      return { address: walletAddress, connectedNow: false as const };
    }

    setWalletActionState('connecting');
    try {
      const provider = getBrowserWalletProvider();
      setHasWalletProvider(Boolean(provider));
      if (!provider) {
        throw new Error('Browser wallet plugin unavailable.');
      }

      const address = await requestWalletAddressOnly(provider);
      publishWalletSession(address, null);
      return { address, connectedNow: true as const };
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

  function publishWalletSession(address: `0x${string}`, chainId: number | null) {
    setWalletAddress(address);
    setWalletChainId(chainId);
    writeBrowserWalletSession({
      walletAddress: address,
      chainId,
      connectedAt: new Date().toISOString()
    });
  }

  async function syncConnectedWallet(address: `0x${string}`) {
    const provider = getBrowserWalletProvider();
    setHasWalletProvider(Boolean(provider));
    if (!provider) {
      throw new Error('Browser wallet plugin unavailable.');
    }

    const chainId = await readBrowserWalletChainId(provider);
    publishWalletSession(address, chainId);
  }

  async function executeAgentRun() {
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
    setLatestDiscovery(payload.showdowns?.discovery ?? null);
    setWalletMessage(
      buildRunAgentsMessage(payload.signals?.length ?? 0, payload.showdowns?.discovery)
    );
    await Promise.all([
      refreshAutonomy(),
      mutate(SHOWDOWNS_SWR_KEY).catch(() => undefined)
    ]);
    return payload;
  }

  async function runAgents() {
    const { address, connectedNow } = await ensureWalletConnected();
    const payload = await executeAgentRun();
    if (connectedNow || walletChainId === null) {
      await syncConnectedWallet(address);
    }
    return payload;
  }

  async function runAgentsAndFollowSignal() {
    const { address, connectedNow } = await ensureWalletConnected();
    const payload = await executeAgentRun();
    const follows = await refreshWalletFollowSummary(address);
    const signal = selectWalletFundableSignal(payload.signals ?? [], follows, address);
    if (!signal) {
      setWalletMessage('No wallet-fundable signal was generated in this run.');
      if (connectedNow || walletChainId === null) {
        await syncConnectedWallet(address);
      }
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

      let approvalHash: `0x${string}` | null = null;
      if (allowance < stake) {
        setWalletActionState('approving');
        setWalletMessage('Approve USDC in your wallet.');
        approvalHash = await ensureUsdcAllowance({
          publicClient,
          walletClient,
          ownerAddress: address,
          spender: room.arenaAddress,
          usdcAddress: room.usdcAddress,
          amount: stake
        });
        setWalletAllowance(stake);
      }

      setWalletActionState('submitting');
      setWalletMessage(
        approvalHash
          ? `USDC approved ${truncateHash(approvalHash)}. Submit wallet follow transaction.`
          : 'Submit wallet follow transaction.'
      );
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
      const refreshedFollows = await refreshWalletFollowSummary(address, { failSoft: true });
      if (refreshedFollows.length > 0) {
        setWalletFollows(refreshedFollows);
      }
      setWalletMessage(
        `Wallet follow confirmed: ${signal.marketQuestion} · ${truncateHash(payload.follow.txHash ?? txHash)}. Check /my for the saved receipt. Automatic showdown discovery runs after each agent run, and Arena refreshes when a match opens.`
      );
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
  const followedSignal =
    signals.find((signal) => hasWalletFollowForSignal(walletFollows, signal.id, walletAddress)) ?? null;
  const displayedFollowSignal = fundableSignal ?? followedSignal;
  const walletFollowStep = getWalletFollowStep({
    hasProvider: hasWalletProvider,
    walletAddress,
    chainId: walletChainId,
    requiredChainId: ARC_TESTNET_CHAIN_ID,
    balanceMicroUsdc: walletBalance,
    allowanceMicroUsdc: walletAllowance,
    requiredStakeMicroUsdc: displayedFollowSignal?.stakeMicroUsdc ?? 0,
    alreadyFollowed: hasWalletFollowForSignal(walletFollows, displayedFollowSignal?.id, walletAddress)
  });
  const showdowns = showdownPayload?.showdowns ?? [];
  const previewCandidates =
    showdowns.length === 0 && shouldShowPreviewCandidates(latestDiscovery)
      ? buildPreviewShowdownCandidates(signals).slice(0, PREVIEW_CANDIDATE_LIMIT)
      : [];
  const totalSignalPages = Math.max(1, Math.ceil(signals.length / SIGNALS_PAGE_SIZE));
  const boundedSignalPage = Math.min(signalPage, totalSignalPages);
  const signalSliceStart = (boundedSignalPage - 1) * SIGNALS_PAGE_SIZE;
  const visibleSignals = signals.slice(signalSliceStart, signalSliceStart + SIGNALS_PAGE_SIZE);
  const selectedSignal = signals.find((signal) => signal.id === selectedSignalId) ?? null;

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
            showdowns={showdowns}
            previewCandidates={previewCandidates}
            loading={!showdownPayload && !showdownError}
            error={showdownError}
          />

          <section className="arena-signal-browser glass-card">
            <div className="arena-panel-header">
              <div>
                <p className="arena-panel-kicker">Run output</p>
                <h2>Signal browser</h2>
              </div>
              <span className="arena-chip arena-chip-muted">{signals.length}</span>
            </div>

            {signals.length > 0 ? (
              <>
                <div className="arena-signal-browser-toolbar">
                  <p>
                    Showing {signalSliceStart + 1}-{Math.min(signalSliceStart + visibleSignals.length, signals.length)} of{' '}
                    {signals.length} signals. Click any row for read-only detail.
                  </p>
                  <div className="arena-signal-browser-pagination">
                    <button
                      type="button"
                      className="showdown-grid-more"
                      onClick={() => setSignalPage((current) => Math.max(1, current - 1))}
                      disabled={boundedSignalPage === 1}
                    >
                      Previous page
                    </button>
                    <span>Page {boundedSignalPage} of {totalSignalPages}</span>
                    <button
                      type="button"
                      className="showdown-grid-more"
                      onClick={() => setSignalPage((current) => Math.min(totalSignalPages, current + 1))}
                      disabled={boundedSignalPage === totalSignalPages}
                    >
                      Next page
                    </button>
                  </div>
                </div>

                <div className="arena-signal-browser-layout">
                  <div className="arena-signal-list" role="list">
                    {visibleSignals.map((signal) => (
                      <button
                        key={signal.id}
                        type="button"
                        className={[
                          'arena-signal-row',
                          selectedSignalId === signal.id ? 'arena-signal-row-active' : undefined
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        onClick={() => setSelectedSignalId(signal.id)}
                      >
                        <div className="arena-signal-row-copy">
                          <strong>{signal.marketQuestion}</strong>
                          <p>
                            {signal.agentName} · {signal.side} · {signal.confidence}
                          </p>
                        </div>
                        <div className="arena-signal-row-metrics">
                          <span>{formatPercentFromBps(signal.agentProbabilityBps)}</span>
                          <small>edge {formatPercentFromBps(signal.edgeBps)}</small>
                        </div>
                      </button>
                    ))}
                  </div>

                  <section className="arena-signal-detail" data-testid="signal-detail-panel">
                    <div className="arena-signal-detail-header">
                      <div>
                        <p className="arena-panel-kicker">Read-only detail</p>
                        <h3>Signal detail</h3>
                      </div>
                      {selectedSignal ? (
                        <span className="arena-chip arena-chip-ready">{selectedSignal.side}</span>
                      ) : (
                        <span className="arena-chip arena-chip-muted">Select a signal</span>
                      )}
                    </div>

                    {selectedSignal ? (
                      <dl className="arena-signal-detail-grid">
                        <div>
                          <dt>Market question</dt>
                          <dd>{selectedSignal.marketQuestion}</dd>
                        </div>
                        <div>
                          <dt>Agent</dt>
                          <dd>{selectedSignal.agentName}</dd>
                        </div>
                        <div>
                          <dt>Side</dt>
                          <dd>{selectedSignal.side}</dd>
                        </div>
                        <div>
                          <dt>Probability</dt>
                          <dd>{formatPercentFromBps(selectedSignal.agentProbabilityBps)}</dd>
                        </div>
                        <div>
                          <dt>Market price</dt>
                          <dd>{formatPercentFromBps(selectedSignal.marketPriceBps)}</dd>
                        </div>
                        <div>
                          <dt>Edge</dt>
                          <dd>{formatPercentFromBps(selectedSignal.edgeBps)}</dd>
                        </div>
                        <div>
                          <dt>Confidence</dt>
                          <dd>{selectedSignal.confidence}</dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>{selectedSignal.source}</dd>
                        </div>
                        <div>
                          <dt>Model hash</dt>
                          <dd>
                            <code>{truncateHash(selectedSignal.modelHash)}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Data hash</dt>
                          <dd>
                            <code>{truncateHash(selectedSignal.dataHash)}</code>
                          </dd>
                        </div>
                        <div>
                          <dt>Risk flags</dt>
                          <dd>
                            {selectedSignal.riskFlags.length > 0
                              ? selectedSignal.riskFlags.join(', ')
                              : 'none'}
                          </dd>
                        </div>
                        <div>
                          <dt>Timestamp</dt>
                          <dd>{formatSignalTimestamp(selectedSignal.createdAt)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="arena-status-note">
                        No detail selected yet. Run Agents, then click a signal to inspect its
                        market, hashes, and risk flags without triggering any wallet or admin
                        action.
                      </p>
                    )}
                  </section>
                </div>
              </>
            ) : (
              <p className="arena-status-note">No agent run loaded yet.</p>
            )}
          </section>
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
                    setWalletMessage(
                      followedSignal
                        ? 'This wallet already follows the selected signal.'
                        : 'Run agents first to surface a fundable signal.'
                    );
                    return;
                  }

                  runAction(() => followSignalWithWallet(fundableSignal));
                }}
                disabled={isPending || !displayedFollowSignal || walletFollowStep.disabled}
              >
                {displayedFollowSignal ? walletFollowStep.label : 'Run agents first'}
              </button>
            </div>

            <div className="arena-fundable-card">
              <span className="arena-mini-label">Selected follow candidate</span>
              {displayedFollowSignal ? (
                <>
                  <strong>{displayedFollowSignal.marketQuestion}</strong>
                  <p>
                    {displayedFollowSignal.agentName} · {displayedFollowSignal.side} · edge{' '}
                    {(displayedFollowSignal.edgeBps / 100).toFixed(2)}%
                    {followedSignal ? ' · followed' : ''}
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
        </aside>
      </div>
    </section>
  );
}
