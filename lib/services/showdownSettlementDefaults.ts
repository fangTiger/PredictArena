import { createArcClients } from '@/lib/arc/client';
import { getServerEnv } from '@/lib/config/env';
import { getShowdownArena, showdownArenaAbi } from '@/lib/contracts/showdownArena';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import { getRuntimeStore, type ShowdownRecord } from '@/lib/persistence/store';
import type { AgentSignal } from '@/lib/polymarket/types';
import { fetchCandles } from '@/lib/prices/fetchCandles';
import { resolveCryptoMarket } from '@/lib/resolution/resolveCryptoMarket';
import type {
  ResolutionResult,
  SettlementDeps
} from '@/lib/services/showdownSettlement';

function readShowdownArenaAddress(): `0x${string}` | null {
  const value = process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS?.trim();
  return value ? (value as `0x${string}`) : null;
}

function inferYesOutcome(signal: AgentSignal): boolean | null {
  if (!signal.resolution) {
    return null;
  }

  if (typeof signal.resolution.yesOutcome === 'boolean') {
    return signal.resolution.yesOutcome;
  }

  if (signal.side === 'AVOID') {
    return null;
  }

  return signal.side === 'YES'
    ? signal.resolution.outcomeCorrect
    : !signal.resolution.outcomeCorrect;
}

function formatUsdPrice(price: number | undefined): string {
  if (typeof price !== 'number' || !Number.isFinite(price)) {
    return 'unknown';
  }

  const safePrice = price;
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: safePrice >= 1000 ? 0 : 2,
    maximumFractionDigits: safePrice >= 1000 ? 0 : 2
  });

  return formatter.format(safePrice);
}

function buildPriceLabel(signal: AgentSignal, settlementPrice?: number): string {
  return `${signal.asset} settled at $${formatUsdPrice(settlementPrice)}`;
}

function selectRuntimeSignal(
  record: ShowdownRecord,
  signals: AgentSignal[]
): AgentSignal | null {
  const matching = signals
    .filter((signal) => signal.marketId === record.marketId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const resolvedSignal = matching.find((signal) => signal.resolution);
  if (resolvedSignal) {
    return resolvedSignal;
  }

  return (
    matching.find(
      (signal) => signal.status === 'committed' && signal.resolution === null
    ) ??
    matching.find(
      (signal) => signal.status === 'generated' && signal.resolution === null
    ) ??
    null
  );
}

function buildResolverSignal(signal: AgentSignal): AgentSignal {
  if (signal.status !== 'generated') {
    return signal;
  }

  // Discovery can open showdowns from generated signals, but the resolver only
  // needs a committed-like view in memory to evaluate the market.
  return {
    ...signal,
    status: 'committed'
  };
}

async function resolveRecordWithRuntimeSignal(
  record: ShowdownRecord,
  signals: AgentSignal[],
  nowMs: number
): Promise<ResolutionResult | null> {
  const signal = selectRuntimeSignal(record, signals);
  if (!signal) {
    return null;
  }

  const existingYesOutcome = inferYesOutcome(signal);
  if (existingYesOutcome !== null) {
    return {
      outcomeYes: existingYesOutcome,
      priceLabel: buildPriceLabel(signal, signal.resolution?.settlementPrice)
    };
  }

  try {
    const candleSeries = await fetchCandles(signal.asset);
    const resolverSignal = buildResolverSignal(signal);
    const resolved = resolveCryptoMarket({
      signal: resolverSignal,
      candles: candleSeries.candles,
      now: new Date(nowMs)
    });

    if (!resolved.ok) {
      return null;
    }

    return {
      outcomeYes: resolved.yesOutcome,
      priceLabel: buildPriceLabel(signal, resolved.settlementPrice)
    };
  } catch {
    return null;
  }
}

export async function buildDefaultSettlementDeps(): Promise<SettlementDeps> {
  const env = getServerEnv();
  const showdownArenaAddress = readShowdownArenaAddress();

  if (!env.admin.privateKey || !showdownArenaAddress) {
    throw new Error('showdown_settlement_config_missing');
  }

  const clients = createArcClients({
    privateKey: env.admin.privateKey,
    rpcUrl: env.arc.rpcUrl
  });
  const contract = getShowdownArena({
    address: showdownArenaAddress,
    publicClient: clients.publicClient,
    walletClient: clients.walletClient
  });
  const showdownStore = getShowdownStore();
  const runtimeStore = getRuntimeStore();

  return {
    showdownStore,
    resolveMarket: async (record) =>
      resolveRecordWithRuntimeSignal(record, await runtimeStore.listSignals(), Date.now()),
    settleOnChain: async (onchainId, agentAWins) => {
      const txHash = await clients.walletClient.writeContract({
        address: showdownArenaAddress,
        abi: showdownArenaAbi,
        functionName: 'settleShowdown',
        args: [BigInt(onchainId), agentAWins]
      });
      await clients.publicClient.waitForTransactionReceipt({
        hash: txHash
      });
      return txHash;
    },
    nowMs: () => Date.now()
  };
}
