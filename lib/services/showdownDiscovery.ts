import { keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';
import { buildSignalExplanation } from '@/lib/utils/signal';

export type DiscoverySkipReason =
  | 'no-active-signals'
  | 'no-pair'
  | 'same-side'
  | 'existing-open'
  | 'budget-exhausted'
  | 'operator-gas-low';

export interface DiscoveryResult {
  discovered: number;
  opened: number;
  skips: Array<{
    marketId: string;
    reason: DiscoverySkipReason;
    detail?: string;
  }>;
}

export interface OpenOnChainInput {
  externalId: `0x${string}`;
  marketId: string;
  marketQuestion: string;
  agentA: {
    address: `0x${string}`;
    name: AgentSignal['agentName'];
    side: 'YES' | 'NO';
    probabilityBps: number;
  };
  agentB: {
    address: `0x${string}`;
    name: AgentSignal['agentName'];
    side: 'YES' | 'NO';
    probabilityBps: number;
  };
  bondPerSideMicroUsdc: bigint;
  deadlineUnix: bigint;
}

export interface OpenOnChainResult {
  onchainId: number;
  txHash: `0x${string}`;
  openedAt: string;
}

export interface DiscoveryDeps {
  listActiveSignals(): Promise<AgentSignal[]>;
  showdownStore: ShowdownStore;
  openOnChain(input: OpenOnChainInput): Promise<OpenOnChainResult>;
  getAgentRemainingBudget(agentName: AgentSignal['agentName']): Promise<bigint>;
  bondPerSideMicroUsdc: bigint;
  deadlineWindowSec: number;
  nowMs(): number;
  isOperatorGasOk(): Promise<boolean>;
  getAgentAddress?(signal: AgentSignal): Promise<`0x${string}`> | `0x${string}`;
}

interface SignalWithAddress {
  signal: AgentSignal;
  address: `0x${string}`;
}

interface CandidatePair {
  agentA: SignalWithAddress;
  agentB: SignalWithAddress;
  spread: number;
  addressKey: string;
  signalKey: string;
}

export async function discoverShowdowns(deps: DiscoveryDeps): Promise<DiscoveryResult> {
  if (!(await deps.isOperatorGasOk())) {
    return {
      discovered: 0,
      opened: 0,
      skips: [{ marketId: '*', reason: 'operator-gas-low' }]
    };
  }

  const signals = (await deps.listActiveSignals()).filter(isUsableActiveSignal);
  if (signals.length === 0) {
    return {
      discovered: 0,
      opened: 0,
      skips: [{ marketId: '*', reason: 'no-active-signals' }]
    };
  }

  const grouped = new Map<string, AgentSignal[]>();
  for (const signal of signals) {
    const entries = grouped.get(signal.marketId) ?? [];
    entries.push(signal);
    grouped.set(signal.marketId, entries);
  }

  const skips: DiscoveryResult['skips'] = [];
  let discovered = 0;
  let opened = 0;

  for (const [marketId, marketSignals] of grouped) {
    const signalsWithAddresses = await Promise.all(
      marketSignals.map(async (signal) => ({
        signal,
        address: await resolveAgentAddress(signal, deps)
      }))
    );

    const pairs = buildCandidatePairs(signalsWithAddresses);
    if (pairs.length === 0) {
      skips.push({
        marketId,
        reason: marketSignals.length >= 2 ? 'same-side' : 'no-pair'
      });
      continue;
    }

    pairs.sort(comparePairs);
    const selected = pairs[0]!;
    discovered += 1;

    if (
      await deps.showdownStore.hasOpenBetween(
        marketId,
        selected.agentA.address,
        selected.agentB.address
      )
    ) {
      skips.push({ marketId, reason: 'existing-open' });
      continue;
    }

    const [agentABudget, agentBBudget] = await Promise.all([
      deps.getAgentRemainingBudget(selected.agentA.signal.agentName),
      deps.getAgentRemainingBudget(selected.agentB.signal.agentName)
    ]);

    if (
      agentABudget < deps.bondPerSideMicroUsdc ||
      agentBBudget < deps.bondPerSideMicroUsdc
    ) {
      skips.push({ marketId, reason: 'budget-exhausted' });
      continue;
    }

    const nowMs = deps.nowMs();
    const deadlineUnix = BigInt(Math.floor(nowMs / 1000) + deps.deadlineWindowSec);
    const externalId = buildExternalIdForPair(
      marketId,
      selected.agentA.address,
      selected.agentB.address
    );

    let onchainResult: OpenOnChainResult;
    try {
      onchainResult = await deps.openOnChain({
        externalId,
        marketId,
        marketQuestion: selected.agentA.signal.marketQuestion,
        agentA: toOpenSide(selected.agentA),
        agentB: toOpenSide(selected.agentB),
        bondPerSideMicroUsdc: deps.bondPerSideMicroUsdc,
        deadlineUnix
      });
    } catch (error) {
      if (isExistingOpenError(error)) {
        skips.push({ marketId, reason: 'existing-open' });
        continue;
      }

      throw error;
    }

    const record: ShowdownRecord = {
      externalId,
      onchainId: onchainResult.onchainId,
      marketId,
      marketQuestion: selected.agentA.signal.marketQuestion,
      agentA: {
        address: selected.agentA.address,
        name: selected.agentA.signal.agentName,
        side: toShowdownSide(selected.agentA.signal.side),
        probabilityBps: selected.agentA.signal.agentProbabilityBps,
        confidence: selected.agentA.signal.confidence,
        thesis: buildSignalExplanation(selected.agentA.signal)
      },
      agentB: {
        address: selected.agentB.address,
        name: selected.agentB.signal.agentName,
        side: toShowdownSide(selected.agentB.signal.side),
        probabilityBps: selected.agentB.signal.agentProbabilityBps,
        confidence: selected.agentB.signal.confidence,
        thesis: buildSignalExplanation(selected.agentB.signal)
      },
      bondPerSideMicroUsdc: Number(deps.bondPerSideMicroUsdc),
      deadline: new Date(Number(deadlineUnix) * 1000).toISOString(),
      status: 'Open',
      openedAt: onchainResult.openedAt,
      settledAt: null,
      openTxHash: onchainResult.txHash,
      settleTxHash: null,
      resolvedOutcome: null,
      resolvedPriceLabel: null
    };

    await deps.showdownStore.insert(record);
    opened += 1;
  }

  return {
    discovered,
    opened,
    skips
  };
}

function isUsableActiveSignal(signal: AgentSignal): boolean {
  return (
    signal.source !== 'demo_snapshot' &&
    signal.side !== 'AVOID' &&
    signal.resolution === null &&
    (signal.status === 'generated' || signal.status === 'committed')
  );
}

async function resolveAgentAddress(
  signal: AgentSignal,
  deps: DiscoveryDeps
): Promise<`0x${string}`> {
  if (deps.getAgentAddress) {
    return deps.getAgentAddress(signal);
  }

  const envKey =
    signal.agentName === 'volatility' ? 'VOL_AGENT_PRIVATE_KEY' : 'MOMENTUM_AGENT_PRIVATE_KEY';
  const privateKey = process.env[envKey];
  if (!privateKey) {
    throw new Error(`${envKey} not set`);
  }

  return privateKeyToAccount(privateKey as `0x${string}`).address;
}

function buildCandidatePairs(signals: SignalWithAddress[]): CandidatePair[] {
  const pairs: CandidatePair[] = [];

  for (let leftIndex = 0; leftIndex < signals.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < signals.length; rightIndex += 1) {
      const left = signals[leftIndex]!;
      const right = signals[rightIndex]!;

      if (left.signal.agentName === right.signal.agentName) {
        continue;
      }

      if (left.signal.side === right.signal.side) {
        continue;
      }

      const [agentA, agentB] = orderPair(left, right);
      pairs.push({
        agentA,
        agentB,
        spread: Math.abs(
          agentA.signal.agentProbabilityBps - agentB.signal.agentProbabilityBps
        ),
        addressKey: buildAddressKey(agentA.address, agentB.address),
        signalKey: buildSignalKey(agentA.signal.id, agentB.signal.id)
      });
    }
  }

  return pairs;
}

function orderPair(
  left: SignalWithAddress,
  right: SignalWithAddress
): [SignalWithAddress, SignalWithAddress] {
  const leftAddress = left.address.toLowerCase();
  const rightAddress = right.address.toLowerCase();

  if (leftAddress < rightAddress) {
    return [left, right];
  }

  if (rightAddress < leftAddress) {
    return [right, left];
  }

  return left.signal.id <= right.signal.id ? [left, right] : [right, left];
}

function comparePairs(left: CandidatePair, right: CandidatePair): number {
  if (left.spread !== right.spread) {
    return right.spread - left.spread;
  }

  if (left.addressKey !== right.addressKey) {
    return left.addressKey.localeCompare(right.addressKey);
  }

  return left.signalKey.localeCompare(right.signalKey);
}

function buildAddressKey(addressA: string, addressB: string): string {
  return [addressA.toLowerCase(), addressB.toLowerCase()].sort().join('|');
}

function buildSignalKey(signalIdA: string, signalIdB: string): string {
  return [signalIdA, signalIdB].sort().join('|');
}

function buildExternalIdForPair(
  marketId: string,
  addressA: string,
  addressB: string
): `0x${string}` {
  return keccak256(toBytes(`${marketId}|${buildAddressKey(addressA, addressB)}`));
}

function toOpenSide(signalWithAddress: SignalWithAddress): OpenOnChainInput['agentA'] {
  return {
    address: signalWithAddress.address,
    name: signalWithAddress.signal.agentName,
    side: toShowdownSide(signalWithAddress.signal.side),
    probabilityBps: signalWithAddress.signal.agentProbabilityBps
  };
}

function toShowdownSide(side: AgentSignal['side']): 'YES' | 'NO' {
  if (side === 'AVOID') {
    throw new Error('AVOID signals cannot open showdowns');
  }

  return side;
}

function isExistingOpenError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  return normalized.includes('external id reused') || normalized.includes('already exists');
}
