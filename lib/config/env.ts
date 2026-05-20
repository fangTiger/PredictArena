import { z } from 'zod';
import {
  ARC_TESTNET_CHAIN_ID,
  ARC_TESTNET_EXPLORER_URL,
  ARC_TESTNET_RPC_URL,
  ARC_TESTNET_USDC_ADDRESS,
  ARC_TESTNET_USDC_DECIMALS,
  DEFAULT_TREASURY_ADDRESS,
  SERVER_ONLY_SECRET_NAMES
} from '@/lib/config/constants';

type EnvSource = Record<string, string | undefined>;

const booleanish = z
  .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
  .transform((value) => value === '1' || value === 'true');

const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (value === '') {
      return undefined;
    }

    return value;
  }, schema.optional());

const hexPrivateKey = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'expected 32-byte hex private key');

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'expected EVM address');

const optionalAddressWithDefault = (defaultValue: `0x${string}`) =>
  z.preprocess((value) => {
    if (value === '') {
      return undefined;
    }

    return value;
  }, addressSchema.default(defaultValue));

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().default('PredictArena'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_ARC_EXPLORER_URL: z.string().url().default(ARC_TESTNET_EXPLORER_URL),
  ALLOW_DEMO_SNAPSHOT: booleanish.default('true'),
  PREDICTARENA_LOCAL_STORE_PATH: emptyStringToUndefined(z.string()),
  SUPABASE_STATE_TABLE: z.string().default('predictarena_state'),
  POLYMARKET_GAMMA_URL: z.string().url().default('https://gamma-api.polymarket.com/markets'),
  ARC_CHAIN_ID: z.coerce.number().default(ARC_TESTNET_CHAIN_ID),
  ARC_RPC_URL: z.string().url().default(ARC_TESTNET_RPC_URL),
  ARC_USDC_ADDRESS: addressSchema.default(ARC_TESTNET_USDC_ADDRESS),
  ARC_USDC_DECIMALS: z.coerce.number().default(ARC_TESTNET_USDC_DECIMALS),
  SIGNAL_BOND_ARENA_ADDRESS: emptyStringToUndefined(addressSchema),
  ARC_SIGNAL_BOND_ARENA_ADDRESS: emptyStringToUndefined(addressSchema),
  ARC_TREASURY_ADDRESS: optionalAddressWithDefault(DEFAULT_TREASURY_ADDRESS),
  SUPABASE_URL: emptyStringToUndefined(z.string().url()),
  SUPABASE_SERVICE_ROLE_KEY: emptyStringToUndefined(z.string().min(1)),
  VOL_AGENT_PRIVATE_KEY: emptyStringToUndefined(hexPrivateKey),
  MOMENTUM_AGENT_PRIVATE_KEY: emptyStringToUndefined(hexPrivateKey),
  ADMIN_PRIVATE_KEY: emptyStringToUndefined(hexPrivateKey),
  ADMIN_RESOLVE_TOKEN: emptyStringToUndefined(z.string().min(1))
});

export interface ServerEnvConfig {
  appName: string;
  appUrl: string | null;
  allowDemoSnapshot: boolean;
  localStorePath: string | null;
  supabaseStateTable: string;
  polymarketGammaUrl: string;
  arc: {
    chainId: number;
    rpcUrl: string;
    usdcAddress: `0x${string}`;
    usdcDecimals: number;
    signalBondArenaAddress: `0x${string}` | null;
    treasuryAddress: `0x${string}`;
    explorerUrl: string;
  };
  supabase: null | {
    url: string;
    serviceRoleKey: string;
  };
  agentKeys: {
    volatility: `0x${string}` | null;
    momentum: `0x${string}` | null;
  };
  admin: {
    privateKey: `0x${string}` | null;
    resolveToken: string | null;
  };
}

export function assertNoPublicSecrets(env: EnvSource): void {
  for (const secretName of SERVER_ONLY_SECRET_NAMES) {
    const publicName = `NEXT_PUBLIC_${secretName}`;
    if (env[publicName]) {
      throw new Error(`Server-only secret must not use public prefix: ${publicName}`);
    }
  }
}

export function parseServerEnv(env: EnvSource = process.env): ServerEnvConfig {
  assertNoPublicSecrets(env);
  const parsed = envSchema.parse(env);

  const supabase =
    parsed.SUPABASE_URL && parsed.SUPABASE_SERVICE_ROLE_KEY
      ? {
          url: parsed.SUPABASE_URL,
          serviceRoleKey: parsed.SUPABASE_SERVICE_ROLE_KEY
        }
      : null;

  return {
    appName: parsed.NEXT_PUBLIC_APP_NAME,
    appUrl: parsed.NEXT_PUBLIC_APP_URL ?? null,
    allowDemoSnapshot: parsed.ALLOW_DEMO_SNAPSHOT,
    localStorePath: parsed.PREDICTARENA_LOCAL_STORE_PATH ?? null,
    supabaseStateTable: parsed.SUPABASE_STATE_TABLE,
    polymarketGammaUrl: parsed.POLYMARKET_GAMMA_URL,
    arc: {
      chainId: parsed.ARC_CHAIN_ID,
      rpcUrl: parsed.ARC_RPC_URL,
      usdcAddress: parsed.ARC_USDC_ADDRESS as `0x${string}`,
      usdcDecimals: parsed.ARC_USDC_DECIMALS,
      signalBondArenaAddress:
        ((parsed.SIGNAL_BOND_ARENA_ADDRESS ?? parsed.ARC_SIGNAL_BOND_ARENA_ADDRESS) as
          | `0x${string}`
          | undefined) ?? null,
      treasuryAddress: parsed.ARC_TREASURY_ADDRESS as `0x${string}`,
      explorerUrl: parsed.NEXT_PUBLIC_ARC_EXPLORER_URL
    },
    supabase,
    agentKeys: {
      volatility: (parsed.VOL_AGENT_PRIVATE_KEY as `0x${string}` | undefined) ?? null,
      momentum: (parsed.MOMENTUM_AGENT_PRIVATE_KEY as `0x${string}` | undefined) ?? null
    },
    admin: {
      privateKey: (parsed.ADMIN_PRIVATE_KEY as `0x${string}` | undefined) ?? null,
      resolveToken: parsed.ADMIN_RESOLVE_TOKEN ?? null
    }
  };
}

let cachedEnv: ServerEnvConfig | null = null;

export function getServerEnv(): ServerEnvConfig {
  cachedEnv ??= parseServerEnv();
  return cachedEnv;
}

export function resetServerEnvForTests(): void {
  cachedEnv = null;
}
