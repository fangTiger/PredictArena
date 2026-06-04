import { describe, expect, it, vi } from 'vitest';
import { ensureUsdcAllowance } from '@/lib/arc/usdc';

const OWNER = '0x1000000000000000000000000000000000000001';
const SPENDER = '0x2000000000000000000000000000000000000002';
const USDC = '0x3000000000000000000000000000000000000003';
const APPROVAL_HASH = '0xa000000000000000000000000000000000000000000000000000000000000001';

describe('ensureUsdcAllowance', () => {
  it('returns null when the current allowance already covers the stake', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(100000n),
      waitForTransactionReceipt: vi.fn()
    };
    const walletClient = {
      writeContract: vi.fn()
    };

    await expect(
      ensureUsdcAllowance({
        publicClient,
        walletClient,
        ownerAddress: OWNER,
        spender: SPENDER,
        usdcAddress: USDC,
        amount: 50000n
      })
    ).resolves.toBe(null);

    expect(walletClient.writeContract).not.toHaveBeenCalled();
    expect(publicClient.waitForTransactionReceipt).not.toHaveBeenCalled();
  });

  it('returns the approval transaction hash after the approval receipt is confirmed', async () => {
    const publicClient = {
      readContract: vi.fn().mockResolvedValue(0n),
      waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' })
    };
    const walletClient = {
      writeContract: vi.fn().mockResolvedValue(APPROVAL_HASH)
    };

    await expect(
      ensureUsdcAllowance({
        publicClient,
        walletClient,
        ownerAddress: OWNER,
        spender: SPENDER,
        usdcAddress: USDC,
        amount: 50000n
      })
    ).resolves.toBe(APPROVAL_HASH);

    expect(publicClient.waitForTransactionReceipt).toHaveBeenCalledWith({ hash: APPROVAL_HASH });
  });
});
