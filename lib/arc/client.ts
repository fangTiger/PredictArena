import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL
} from '@/lib/config/constants';

export const arcTestnet = defineChain({
  id: ARC_TESTNET_CHAIN_ID,
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Arc',
    symbol: 'ARC'
  },
  rpcUrls: {
    default: {
      http: [ARC_TESTNET_RPC_URL]
    }
  },
  blockExplorers: {
    default: {
      name: 'Arc Scan',
      url: ARC_TESTNET_EXPLORER_URL
    }
  },
  testnet: true
});

export function createArcClients({
  privateKey,
  rpcUrl
}: {
  privateKey: `0x${string}`;
  rpcUrl: string;
}) {
  const account = privateKeyToAccount(privateKey);
  const transport = http(rpcUrl);

  return {
    account,
    publicClient: createPublicClient({
      chain: arcTestnet,
      transport
    }),
    walletClient: createWalletClient({
      account,
      chain: arcTestnet,
      transport
    })
  };
}
