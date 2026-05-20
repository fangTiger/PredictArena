import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveSignalsOnArena } from '@/lib/arc/resolveSignals';

describe('resolveSignalsOnArena', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('rejects missing owner resolution config before any onchain call', async () => {
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', '');
    vi.stubEnv('ADMIN_PRIVATE_KEY', '');

    await expect(resolveSignalsOnArena([1], [true])).rejects.toThrow(/resolve_config_missing/);
  });

  it('calls resolveSignalsBulk with admin wallet on Arc Testnet', async () => {
    vi.stubEnv('SIGNAL_BOND_ARENA_ADDRESS', '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    vi.stubEnv('ADMIN_PRIVATE_KEY', '0x1111111111111111111111111111111111111111111111111111111111111111');

    const getChainId = vi.fn().mockResolvedValue(5_042_002);
    const waitForTransactionReceipt = vi.fn().mockResolvedValue({ status: 'success' });
    const writeContract = vi
      .fn()
      .mockResolvedValue('0xresolve00000000000000000000000000000000000000000000000000000000001');

    const result = await resolveSignalsOnArena([1, 2], [true, false], {
      createClients: () =>
        ({
          account: { address: '0xadmin0000000000000000000000000000000000' },
          publicClient: {
            getChainId,
            waitForTransactionReceipt
          },
          walletClient: {
            writeContract
          }
        }) as never
    });

    expect(result.txHash).toContain('0xresolve');
    expect(writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'resolveSignalsBulk',
        args: [[1n, 2n], [true, false]]
      })
    );
  });
});
