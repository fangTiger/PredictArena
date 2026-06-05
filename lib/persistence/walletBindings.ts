import { buildArcTxUrl } from '@/lib/arc/explorer';
import { getRuntimeStore, type PersistenceStore } from '@/lib/persistence/store';
import type { AgentSignal } from '@/lib/polymarket/types';

export interface WalletFollow {
  id: string;
  walletAddress: string;
  signalId: string;
  marketId: string;
  marketQuestion: string;
  side: 'YES' | 'NO';
  bondedMicroUsdc: bigint;
  followTxHash: string;
  status: 'pending' | 'confirmed' | 'resolved-win' | 'resolved-loss';
  followedAt: string;
  resolvedAt: string | null;
  payoutMicroUsdc: bigint | null;
}

export interface WalletTxHistoryItem {
  txHash: string;
  blockNumber: number | null;
  timestamp: string;
  kind: 'follow-commit';
  amountMicroUsdc: bigint;
  status: 'success';
  arcExplorerUrl: string;
}

export interface WalletSummary {
  walletAddress: string;
  usdcBalanceMicro: bigint;
  usdcAllowanceMicro: bigint;
  arcChainSynced: boolean;
  follows: WalletFollow[];
  txHistory: WalletTxHistoryItem[];
  cumulativeBondedMicro: bigint;
  cumulativePayoutMicro: bigint;
  currentNetPnlMicro: bigint;
}

export interface WalletBindingsFacade {
  getSummary(walletAddress: string): Promise<WalletSummary>;
  listFollows(walletAddress: string, opts?: { limit?: number }): Promise<WalletFollow[]>;
  listTxHistory(walletAddress: string, opts?: { limit?: number }): Promise<WalletTxHistoryItem[]>;
}

interface WalletBindingsDeps {
  store: Pick<PersistenceStore, 'listSignals' | 'listWalletFollows'>;
  readUsdcBalanceMicro: (walletAddress: string) => Promise<bigint>;
  readUsdcAllowanceMicro: (walletAddress: string) => Promise<bigint>;
  checkArcChainSynced: () => Promise<boolean>;
  buildExplorerUrl: (txHash: `0x${string}`) => string;
}

interface WalletBindingsFacadeOptions
  extends Partial<Omit<WalletBindingsDeps, 'store'>> {
  store?: Pick<PersistenceStore, 'listSignals' | 'listWalletFollows'>;
}

const DEFAULT_LIMIT = 50;

function defaultDeps(
  overrides: WalletBindingsFacadeOptions
): Omit<WalletBindingsDeps, 'store'> & {
  getStore: () => Pick<PersistenceStore, 'listSignals' | 'listWalletFollows'>;
} {
  const { store, ...rest } = overrides;

  return {
    getStore: () => store ?? getRuntimeStore(),
    readUsdcBalanceMicro: async () => 0n,
    readUsdcAllowanceMicro: async () => 0n,
    checkArcChainSynced: async () => true,
    buildExplorerUrl: buildArcTxUrl,
    ...rest
  };
}

function normalizeWalletAddress(walletAddress: string): string {
  return walletAddress.toLowerCase();
}

function deriveFollowStatus(
  signal: AgentSignal | undefined
): WalletFollow['status'] {
  if (signal?.resolution) {
    return signal.resolution.outcomeCorrect ? 'resolved-win' : 'resolved-loss';
  }

  return 'confirmed';
}

function toWalletFollow(
  walletAddress: string,
  record: Awaited<ReturnType<PersistenceStore['listWalletFollows']>>[number],
  signalById: Map<string, AgentSignal>
): WalletFollow {
  const signal = signalById.get(record.signalId);
  const status = deriveFollowStatus(signal);
  const bondedMicroUsdc = BigInt(record.stakeMicroUsdc);

  return {
    id: record.id,
    walletAddress,
    signalId: record.signalId,
    marketId: signal?.marketId ?? record.signalId,
    marketQuestion: signal?.marketQuestion ?? '(market unavailable)',
    side: signal?.side === 'NO' ? 'NO' : 'YES',
    bondedMicroUsdc,
    followTxHash: record.txHash,
    status,
    followedAt: record.followedAt,
    resolvedAt: signal?.resolution?.resolvedAt ?? null,
    payoutMicroUsdc:
      status === 'resolved-win'
        ? bondedMicroUsdc * 2n
        : status === 'resolved-loss'
          ? 0n
          : null
  };
}

function buildTxHistoryFromFollows(
  follows: WalletFollow[],
  buildExplorerUrl: (txHash: `0x${string}`) => string,
  limit = DEFAULT_LIMIT
): WalletTxHistoryItem[] {
  return follows.slice(0, limit).map((follow) => ({
    txHash: follow.followTxHash,
    blockNumber: null,
    timestamp: follow.followedAt,
    kind: 'follow-commit',
    amountMicroUsdc: follow.bondedMicroUsdc,
    status: 'success',
    arcExplorerUrl: buildExplorerUrl(follow.followTxHash as `0x${string}`)
  }));
}

export function createWalletBindingsFacade(
  overrides: WalletBindingsFacadeOptions = {}
): WalletBindingsFacade {
  const deps = defaultDeps(overrides);

  return {
    async getSummary(walletAddress) {
      const normalizedAddress = normalizeWalletAddress(walletAddress);
      const [follows, usdcBalanceMicro, usdcAllowanceMicro, arcChainSynced] =
        await Promise.all([
          this.listFollows(normalizedAddress),
          deps.readUsdcBalanceMicro(normalizedAddress).catch(() => 0n),
          deps.readUsdcAllowanceMicro(normalizedAddress).catch(() => 0n),
          deps.checkArcChainSynced().catch(() => true)
        ]);
      const txHistory = buildTxHistoryFromFollows(
        follows,
        deps.buildExplorerUrl
      );
      const cumulativeBondedMicro = follows.reduce(
        (sum, follow) => sum + follow.bondedMicroUsdc,
        0n
      );
      const cumulativePayoutMicro = follows.reduce(
        (sum, follow) => sum + (follow.payoutMicroUsdc ?? 0n),
        0n
      );

      return {
        walletAddress: normalizedAddress,
        usdcBalanceMicro,
        usdcAllowanceMicro,
        arcChainSynced,
        follows,
        txHistory,
        cumulativeBondedMicro,
        cumulativePayoutMicro,
        currentNetPnlMicro: cumulativePayoutMicro - cumulativeBondedMicro
      };
    },

    async listFollows(walletAddress, opts) {
      const normalizedAddress = normalizeWalletAddress(walletAddress);
      const limit = opts?.limit ?? DEFAULT_LIMIT;
      const store = deps.getStore();
      const [records, signals] = await Promise.all([
        store.listWalletFollows(),
        store.listSignals()
      ]);
      const signalById = new Map(signals.map((signal) => [signal.id, signal]));

      return records
        .filter(
          (record) =>
            normalizeWalletAddress(record.walletAddress) === normalizedAddress
        )
        .sort((left, right) => right.followedAt.localeCompare(left.followedAt))
        .slice(0, limit)
        .map((record) =>
          toWalletFollow(normalizedAddress, record, signalById)
        );
    },

    async listTxHistory(walletAddress, opts) {
      const follows = await this.listFollows(walletAddress, {
        limit: opts?.limit ?? DEFAULT_LIMIT
      });

      return buildTxHistoryFromFollows(
        follows,
        deps.buildExplorerUrl,
        opts?.limit ?? DEFAULT_LIMIT
      );
    }
  };
}

export const walletBindingsFacade = createWalletBindingsFacade();
