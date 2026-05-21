import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_ADDRESS
} from '@/lib/config/constants';
import { parseServerEnv, type ServerEnvConfig } from '@/lib/config/env';
import { createArcClients } from '@/lib/arc/client';
import { commitArenaSignal, extractSignalRecordIdFromReceipt } from '@/lib/arc/signalBondArena';
import { ensureUsdcAllowance } from '@/lib/arc/usdc';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { PersistenceStore } from '@/lib/persistence/store';

interface CommitSignalDeps {
  env?: ServerEnvConfig;
  createClients?: typeof createArcClients;
}

export class CommitReceiptUnconfirmedError extends Error {
  txHash: `0x${string}`;

  constructor(txHash: `0x${string}`, cause: unknown) {
    super('commit_receipt_unconfirmed', { cause });
    this.name = 'CommitReceiptUnconfirmedError';
    this.txHash = txHash;
  }
}

export function getCommitTxHashFromError(error: unknown): `0x${string}` | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'txHash' in error &&
    typeof error.txHash === 'string' &&
    /^0x[0-9a-fA-F]+$/.test(error.txHash)
  ) {
    return error.txHash as `0x${string}`;
  }

  return null;
}

export async function commitSignalToArena(
  _store: PersistenceStore,
  signal: AgentSignal,
  deps: CommitSignalDeps = {}
): Promise<{ txHash: `0x${string}`; signalRecordId: number | null }> {
  const env = deps.env ?? parseServerEnv(process.env);
  const privateKey =
    signal.agentName === 'volatility' ? env.agentKeys.volatility : env.agentKeys.momentum;

  if (!env.arc.signalBondArenaAddress || !privateKey) {
    throw new Error('commit_config_missing');
  }

  const { account, publicClient, walletClient } = (deps.createClients ?? createArcClients)({
    privateKey,
    rpcUrl: env.arc.rpcUrl
  });
  const chainId = await publicClient.getChainId();
  if (chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error('commit_chain_mismatch');
  }

  await ensureUsdcAllowance({
    publicClient,
    walletClient,
    ownerAddress: account.address,
    spender: env.arc.signalBondArenaAddress,
    usdcAddress: env.arc.usdcAddress ?? ARC_TESTNET_USDC_ADDRESS,
    amount: BigInt(signal.stakeMicroUsdc)
  });

  const txHash = await commitArenaSignal({
    walletClient,
    arenaAddress: env.arc.signalBondArenaAddress,
    signal
  });
  let receipt: unknown;
  try {
    receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  } catch (error) {
    throw new CommitReceiptUnconfirmedError(txHash, error);
  }

  return {
    txHash,
    signalRecordId: extractSignalRecordIdFromReceipt(receipt as never)
  };
}
