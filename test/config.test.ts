import { describe, expect, it } from 'vitest';

describe('parseServerEnv', () => {
  it('parses Arc defaults, optional Supabase, and server-only secrets', async () => {
    const configModule = await import('@/lib/config/env');

    const config = configModule.parseServerEnv({
      ADMIN_RESOLVE_TOKEN: 'demo-admin-token',
      SIGNAL_BOND_ARENA_ADDRESS: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      VOL_AGENT_PRIVATE_KEY: '0x'.padEnd(66, '1'),
      MOMENTUM_AGENT_PRIVATE_KEY: '0x'.padEnd(66, '2')
    });

    expect(config.arc.chainId).toBe(5_042_002);
    expect(config.arc.rpcUrl).toBe('https://rpc.testnet.arc.network');
    expect(config.arc.usdcAddress).toBe('0x3600000000000000000000000000000000000000');
    expect(config.arc.signalBondArenaAddress).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(config.arc.explorerUrl).toBe('https://testnet.arcscan.app');
    expect(config.supabase).toBeNull();
    expect(config.allowDemoSnapshot).toBe(true);
    expect(config.agentKeys.volatility).toMatch(/^0x1+$/);
    expect(config.agentKeys.momentum).toMatch(/^0x2+$/);
  });

  it('accepts the legacy Arc arena address alias for local compatibility', async () => {
    const configModule = await import('@/lib/config/env');

    const config = configModule.parseServerEnv({
      ARC_SIGNAL_BOND_ARENA_ADDRESS: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    });

    expect(config.arc.signalBondArenaAddress).toBe('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });

  it('rejects secret variables when they use a NEXT_PUBLIC_ prefix', async () => {
    const configModule = await import('@/lib/config/env');

    expect(() =>
      configModule.parseServerEnv({
        ADMIN_RESOLVE_TOKEN: 'demo-admin-token',
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: 'should-not-exist'
      })
    ).toThrow(/NEXT_PUBLIC/i);
  });
});
