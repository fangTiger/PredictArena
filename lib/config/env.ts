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
export type AutonomyMode = 'OFF' | 'DRY_RUN' | 'LIVE';

export interface AgentAutonomyPolicyConfig {
  mode: AutonomyMode;
  maxDailyBondUsdc6: number;
  maxSignalsPerDay: number;
  maxStakePerSignalUsdc6: number;
  maxOpenSignals: number;
  minEdgeBps: number;
}

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

const positiveInteger = z.coerce.number().int().positive();
const nonNegativeInteger = z.coerce.number().int().min(0);
const autonomyModeSchema = z.enum(['OFF', 'DRY_RUN', 'LIVE']);

function buildDefaultAutonomyPolicy(
  overrides: Partial<Omit<AgentAutonomyPolicyConfig, 'mode'>> = {}
) {
  return {
    maxDailyBondUsdc6: 150_000,
    maxSignalsPerDay: 4,
    maxStakePerSignalUsdc6: 50_000,
    maxOpenSignals: 3,
    minEdgeBps: 900,
    ...overrides
  };
}

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
  ADMIN_RESOLVE_TOKEN: emptyStringToUndefined(z.string().min(1)),
  CRON_SECRET: emptyStringToUndefined(z.string().min(1)),
  PROOF_MODE_SECRET: emptyStringToUndefined(z.string().min(1)),
  PROOF_SMOKE_MAX_STAKE_USDC6: nonNegativeInteger.default(0),
  PROOF_SMOKE_MAX_DAILY_USDC6: nonNegativeInteger.default(0),
  PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY: nonNegativeInteger.default(0),
  AUTONOMY_VOL_MODE: autonomyModeSchema.default('DRY_RUN'),
  AUTONOMY_VOL_MAX_DAILY_BOND_USDC6: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxDailyBondUsdc6
  ),
  AUTONOMY_VOL_MAX_SIGNALS_PER_DAY: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxSignalsPerDay
  ),
  AUTONOMY_VOL_MAX_STAKE_USDC6: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxStakePerSignalUsdc6
  ),
  AUTONOMY_VOL_MAX_OPEN_SIGNALS: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxOpenSignals
  ),
  AUTONOMY_VOL_MIN_EDGE_BPS: positiveInteger.default(
    buildDefaultAutonomyPolicy().minEdgeBps
  ),
  AUTONOMY_MOMENTUM_MODE: autonomyModeSchema.default('DRY_RUN'),
  AUTONOMY_MOMENTUM_MAX_DAILY_BOND_USDC6: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxDailyBondUsdc6
  ),
  AUTONOMY_MOMENTUM_MAX_SIGNALS_PER_DAY: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxSignalsPerDay
  ),
  AUTONOMY_MOMENTUM_MAX_STAKE_USDC6: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxStakePerSignalUsdc6
  ),
  AUTONOMY_MOMENTUM_MAX_OPEN_SIGNALS: positiveInteger.default(
    buildDefaultAutonomyPolicy().maxOpenSignals
  ),
  AUTONOMY_MOMENTUM_MIN_EDGE_BPS: positiveInteger.default(
    buildDefaultAutonomyPolicy().minEdgeBps
  )
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
  cron: {
    secret: string | null;
  };
  proof: {
    secret: string | null;
    maxStakePerSignalUsdc6: number;
    maxDailySpendUsdc6: number;
    maxTransactionsPerDay: number;
  };
  autonomy: {
    policies: {
      volatility: AgentAutonomyPolicyConfig;
      momentum: AgentAutonomyPolicyConfig;
    };
  };
}

function buildAutonomyPolicyConfig(
  agentName: 'volatility' | 'momentum',
  parsed: z.infer<typeof envSchema>
): AgentAutonomyPolicyConfig {
  const prefix = agentName === 'volatility' ? 'AUTONOMY_VOL' : 'AUTONOMY_MOMENTUM';
  const policy = {
    mode: parsed[`${prefix}_MODE`] as AutonomyMode,
    maxDailyBondUsdc6: parsed[`${prefix}_MAX_DAILY_BOND_USDC6`],
    maxSignalsPerDay: parsed[`${prefix}_MAX_SIGNALS_PER_DAY`],
    maxStakePerSignalUsdc6: parsed[`${prefix}_MAX_STAKE_USDC6`],
    maxOpenSignals: parsed[`${prefix}_MAX_OPEN_SIGNALS`],
    minEdgeBps: parsed[`${prefix}_MIN_EDGE_BPS`]
  } satisfies AgentAutonomyPolicyConfig;

  if (policy.mode === 'LIVE') {
    if (
      !Number.isFinite(policy.maxDailyBondUsdc6) ||
      !Number.isFinite(policy.maxStakePerSignalUsdc6) ||
      !Number.isFinite(policy.maxSignalsPerDay) ||
      !Number.isFinite(policy.maxOpenSignals) ||
      policy.maxDailyBondUsdc6 <= 0 ||
      policy.maxStakePerSignalUsdc6 <= 0 ||
      policy.maxSignalsPerDay <= 0 ||
      policy.maxOpenSignals <= 0
    ) {
      throw new Error(`autonomy_live_budget_invalid:${agentName}`);
    }
  }

  return policy;
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
    },
    cron: {
      secret: parsed.CRON_SECRET ?? null
    },
    proof: {
      secret: parsed.PROOF_MODE_SECRET ?? null,
      maxStakePerSignalUsdc6: parsed.PROOF_SMOKE_MAX_STAKE_USDC6,
      maxDailySpendUsdc6: parsed.PROOF_SMOKE_MAX_DAILY_USDC6,
      maxTransactionsPerDay: parsed.PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY
    },
    autonomy: {
      policies: {
        volatility: buildAutonomyPolicyConfig('volatility', parsed),
        momentum: buildAutonomyPolicyConfig('momentum', parsed)
      }
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
