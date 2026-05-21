interface OrderbookLevel {
  price?: string | number;
  size?: string | number;
}

interface OrderbookPayload {
  bids?: OrderbookLevel[];
  asks?: OrderbookLevel[];
}

export interface ClobSpreadDiagnostic {
  status: 'available' | 'unavailable';
  tokenId: string | null;
  bestBidBps: number | null;
  bestAskBps: number | null;
  midpointBps: number | null;
  spreadBps: number | null;
  liquidityUsd: number | null;
  reason: string | null;
}

function parseDecimal(value: string | number | undefined): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function priceToBps(price: number): number {
  return Math.max(0, Math.min(10_000, Math.round(price * 10_000)));
}

function levelNotional(level: OrderbookLevel): number {
  const price = parseDecimal(level.price) ?? 0;
  const size = parseDecimal(level.size) ?? 0;
  return price * size;
}

export async function fetchClobSpreadDiagnostic(
  clobTokenIds: string[],
  fetchImpl: typeof fetch = fetch
): Promise<ClobSpreadDiagnostic> {
  const tokenId = clobTokenIds[0] ?? null;
  if (!tokenId) {
    return {
      status: 'unavailable',
      tokenId: null,
      bestBidBps: null,
      bestAskBps: null,
      midpointBps: null,
      spreadBps: null,
      liquidityUsd: null,
      reason: 'missing_clob_token_id'
    };
  }

  try {
    const url = new URL('https://clob.polymarket.com/book');
    url.searchParams.set('token_id', tokenId);
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(1500)
    });

    if (!response.ok) {
      throw new Error(`clob_${response.status}`);
    }

    const payload = (await response.json()) as OrderbookPayload;
    const bestBid = Math.max(
      ...((payload.bids ?? [])
        .map((level) => parseDecimal(level.price))
        .filter((price): price is number => price !== null))
    );
    const bestAsk = Math.min(
      ...((payload.asks ?? [])
        .map((level) => parseDecimal(level.price))
        .filter((price): price is number => price !== null))
    );

    if (!Number.isFinite(bestBid) || !Number.isFinite(bestAsk) || bestAsk < bestBid) {
      throw new Error('clob_empty_book');
    }

    const liquidityUsd = [...(payload.bids ?? []).slice(0, 5), ...(payload.asks ?? []).slice(0, 5)]
      .reduce((sum, level) => sum + levelNotional(level), 0);
    const bestBidBps = priceToBps(bestBid);
    const bestAskBps = priceToBps(bestAsk);

    return {
      status: 'available',
      tokenId,
      bestBidBps,
      bestAskBps,
      midpointBps: Math.round((bestBidBps + bestAskBps) / 2),
      spreadBps: Math.max(0, bestAskBps - bestBidBps),
      liquidityUsd,
      reason: null
    };
  } catch (error) {
    return {
      status: 'unavailable',
      tokenId,
      bestBidBps: null,
      bestAskBps: null,
      midpointBps: null,
      spreadBps: null,
      liquidityUsd: null,
      reason: error instanceof Error ? error.message : 'clob_orderbook_unavailable'
    };
  }
}
