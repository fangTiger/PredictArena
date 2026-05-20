import { ARC_TESTNET_CHAIN_ID } from '@/lib/config/constants';
import { parseServerEnv, type ServerEnvConfig } from '@/lib/config/env';
import { createArcClients } from '@/lib/arc/client';
import { resolveArenaSignalsBulk } from '@/lib/arc/signalBondArena';

interface ResolveSignalsDeps {
  env?: ServerEnvConfig;
  createClients?: typeof createArcClients;
}

export async function resolveSignalsOnArena(
  signalRecordIds: number[],
  outcomeCorrectValues: boolean[],
  deps: ResolveSignalsDeps = {}
): Promise<{ txHash: `0x${string}` }> {
  const env = deps.env ?? parseServerEnv(process.env);

  if (!env.arc.signalBondArenaAddress || !env.admin.privateKey) {
    throw new Error('resolve_config_missing');
  }

  if (signalRecordIds.length !== outcomeCorrectValues.length) {
    throw new Error('resolve_length_mismatch');
  }

  const { publicClient, walletClient } = (deps.createClients ?? createArcClients)({
    privateKey: env.admin.privateKey,
    rpcUrl: env.arc.rpcUrl
  });
  const chainId = await publicClient.getChainId();
  if (chainId !== ARC_TESTNET_CHAIN_ID) {
    throw new Error('resolve_chain_mismatch');
  }

  const txHash = await resolveArenaSignalsBulk({
    walletClient,
    arenaAddress: env.arc.signalBondArenaAddress,
    signalRecordIds,
    outcomeCorrectValues
  });
  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return { txHash };
}
