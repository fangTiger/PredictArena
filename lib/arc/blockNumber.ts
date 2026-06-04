import { createPublicClient, http } from 'viem';
import { arcTestnet } from '@/lib/arc/client';

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function getArcPublicClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: arcTestnet,
      transport: http()
    });
  }

  return cachedClient;
}

export async function readArcLatestBlock(): Promise<number> {
  const blockNumber = await getArcPublicClient().getBlockNumber();
  return Number(blockNumber);
}
