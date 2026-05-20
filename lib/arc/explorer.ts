import { ARC_TESTNET_EXPLORER_URL } from '@/lib/config/constants';

export function getArcExplorerUrl() {
  return (process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || ARC_TESTNET_EXPLORER_URL).replace(/\/+$/, '');
}

export function buildArcTxUrl(hash: `0x${string}`, explorerUrl = getArcExplorerUrl()) {
  const base = explorerUrl.replace(/\/+$/, '');

  return `${base}/tx/${hash}`;
}
