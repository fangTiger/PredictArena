import { NextResponse } from 'next/server';
import { fetchCandidateMarkets } from '@/lib/polymarket/fetchMarkets';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  const store = getRuntimeStore();
  const result = await fetchCandidateMarkets();
  await store.saveMarketScan(result);
  return NextResponse.json(result);
}
