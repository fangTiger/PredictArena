import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  getSummary: vi.fn()
}));

vi.mock('@/lib/persistence/walletBindings', () => ({
  walletBindingsFacade: {
    getSummary: routeMocks.getSummary
  }
}));

describe('GET /api/wallet/[address]/summary', () => {
  beforeEach(() => {
    routeMocks.getSummary.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns exact invalid-address payload for malformed wallet paths', async () => {
    const { GET } = await import('@/app/api/wallet/[address]/summary/route');

    const response = await GET(new Request('http://localhost/api/wallet/not-a-wallet/summary'), {
      params: Promise.resolve({ address: 'not-a-wallet' })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid address' });
    expect(routeMocks.getSummary).not.toHaveBeenCalled();
  });

  it('serializes bigint fields as decimal strings and keeps follows compatibility aliases', async () => {
    vi.stubEnv('VOL_AGENT_PRIVATE_KEY', `0x${'9'.repeat(64)}`);
    routeMocks.getSummary.mockResolvedValue({
      walletAddress: '0x1000000000000000000000000000000000000001',
      usdcBalanceMicro: 1_500_000n,
      usdcAllowanceMicro: 700_000n,
      arcChainSynced: true,
      follows: [
        {
          id: 'follow-1',
          walletAddress: '0x1000000000000000000000000000000000000001',
          signalId: 'signal-1',
          marketId: 'market-1',
          marketQuestion: 'Will BTC close above $100,000 this week?',
          side: 'YES',
          bondedMicroUsdc: 250_000n,
          followTxHash: `0x${'a'.repeat(64)}`,
          status: 'resolved-win',
          followedAt: '2026-06-05T00:00:00.000Z',
          resolvedAt: '2026-06-06T00:00:00.000Z',
          payoutMicroUsdc: 500_000n
        }
      ],
      txHistory: [
        {
          txHash: `0x${'a'.repeat(64)}`,
          blockNumber: null,
          timestamp: '2026-06-05T00:00:00.000Z',
          kind: 'follow-commit',
          amountMicroUsdc: 250_000n,
          status: 'success',
          arcExplorerUrl: `https://testnet.arcscan.app/tx/0x${'a'.repeat(64)}`
        }
      ],
      cumulativeBondedMicro: 250_000n,
      cumulativePayoutMicro: 500_000n,
      currentNetPnlMicro: 250_000n
    });
    const { GET } = await import('@/app/api/wallet/[address]/summary/route');

    const response = await GET(
      new Request('http://localhost/api/wallet/0x1000000000000000000000000000000000000001/summary'),
      {
        params: Promise.resolve({
          address: '0x1000000000000000000000000000000000000001'
        })
      }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      walletAddress: '0x1000000000000000000000000000000000000001',
      usdcBalanceMicro: '1500000',
      usdcAllowanceMicro: '700000',
      arcChainSynced: true,
      follows: [
        {
          bondedMicroUsdc: '250000',
          payoutMicroUsdc: '500000',
          followTxHash: `0x${'a'.repeat(64)}`
        }
      ],
      walletFollows: [
        {
          bondedMicroUsdc: '250000',
          payoutMicroUsdc: '500000',
          txHash: `0x${'a'.repeat(64)}`,
          stakeMicroUsdc: 250_000
        }
      ],
      txHistory: [
        {
          amountMicroUsdc: '250000'
        }
      ],
      cumulativeBondedMicro: '250000',
      cumulativePayoutMicro: '500000',
      currentNetPnlMicro: '250000'
    });
    expect(payload.walletFollows[0]).toMatchObject({
      followTxHash: payload.follows[0].followTxHash,
      txHash: payload.follows[0].followTxHash,
      bondedMicroUsdc: payload.follows[0].bondedMicroUsdc,
      stakeMicroUsdc: 250_000
    });
    expect(JSON.stringify(payload)).not.toContain('PRIVATE_KEY');
    expect(JSON.stringify(payload)).not.toContain('999999');
  });
});
