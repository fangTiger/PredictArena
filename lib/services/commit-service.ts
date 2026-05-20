import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_USDC_DECIMALS,
  getArcCommitConfig,
  getCommitDisabledReason
} from '@/lib/config/predictarena';
import { erc20Abi, signalBondVaultAbi } from '@/lib/contracts/abi';
import type { PredictArenaStore } from '@/lib/server/store/types';
import type { DashboardState } from '@/types/predictarena';
import { loadDashboardState } from '@/lib/services/arena-service';
import { createPublicClient, createWalletClient, http, keccak256, stringToHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export async function commitSignalAndLoadDashboardState(
  store: PredictArenaStore,
  signalId: string
): Promise<DashboardState> {
  const signal = await store.getSignal(signalId);
  if (!signal) {
    throw new Error(`Unknown signal ${signalId}`);
  }

  if (signal.committedTxHash || signal.commitmentStatus === 'committed') {
    return {
      ...(await loadDashboardState(store)),
      lastCommitResult: {
        status: 'disabled',
        signalId,
        reason: 'Signal already committed'
      }
    };
  }

  const globalDisableReason = getCommitDisabledReason();
  const disabledReason =
    !signal.eligibleForCommit
      ? signal.disabledReason ?? 'Signal is not eligible for Arc commitment'
      : globalDisableReason;

  if (disabledReason) {
    return {
      ...(await loadDashboardState(store)),
      lastCommitResult: {
        status: 'disabled',
        signalId,
        reason: disabledReason
      }
    };
  }

  const config = getArcCommitConfig();
  const market = await store.getMarket(signal.marketId);
  if (!market || !config.privateKey || !config.vaultAddress) {
    return {
      ...(await loadDashboardState(store)),
      lastCommitResult: {
        status: 'disabled',
        signalId,
        reason: 'Arc commit disabled: missing market or configuration'
      }
    };
  }

  const account = privateKeyToAccount(config.privateKey);
  const publicClient = createPublicClient({
    transport: http(config.rpcUrl)
  });
  const walletClient = createWalletClient({
    account,
    transport: http(config.rpcUrl)
  });

  const [remoteChainId, remoteDecimals] = await Promise.all([
    publicClient.getChainId(),
    publicClient.readContract({
      address: config.usdcAddress,
      abi: erc20Abi,
      functionName: 'decimals'
    })
  ]);

  if (remoteChainId !== ARC_TESTNET_CHAIN_ID) {
    return {
      ...(await loadDashboardState(store)),
      lastCommitResult: {
        status: 'disabled',
        signalId,
        reason: `Arc commit disabled: chain id ${remoteChainId} mismatch`
      }
    };
  }

  if (remoteDecimals !== ARC_TESTNET_USDC_DECIMALS) {
    return {
      ...(await loadDashboardState(store)),
      lastCommitResult: {
        status: 'disabled',
        signalId,
        reason: `Arc commit disabled: decimals ${remoteDecimals} mismatch`
      }
    };
  }

  const allowance = await publicClient.readContract({
    address: config.usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [account.address, config.vaultAddress]
  });

  if (allowance < BigInt(signal.bondAmountMicroUsdc)) {
    const approvalHash = await walletClient.writeContract({
      account,
      chain: undefined,
      address: config.usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [config.vaultAddress, BigInt(signal.bondAmountMicroUsdc)]
    });

    await publicClient.waitForTransactionReceipt({ hash: approvalHash });
  }

  const txHash = await walletClient.writeContract({
    account,
    chain: undefined,
    address: config.vaultAddress,
    abi: signalBondVaultAbi,
    functionName: 'commitSignal',
    args: [
      signal.id,
      market.id,
      signal.decision === 'BUY_YES',
      signal.confidenceBps,
      BigInt(signal.bondAmountMicroUsdc),
      keccak256(stringToHex(signal.id))
    ]
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });
  await store.saveCommitment({
    signalId,
    txHash,
    bondAmountMicroUsdc: signal.bondAmountMicroUsdc,
    chainId: ARC_TESTNET_CHAIN_ID,
    committedAt: new Date().toISOString()
  });

  return {
    ...(await loadDashboardState(store)),
    lastCommitResult: {
      status: 'committed',
      signalId,
      txHash
    }
  };
}
