import { describe, expect, it } from 'vitest';
import { parseServerEnv } from '@/lib/config/env';
import { buildOperatorHealthView } from '@/lib/ops/operatorHealth';

describe('operator health read model', () => {
  it('returns structured, sanitized degraded states without secrets or raw diagnostics', () => {
    const env = parseServerEnv({
      NEXT_PUBLIC_APP_NAME: 'PredictArena',
      NEXT_PUBLIC_ARC_EXPLORER_URL: 'https://testnet.arcscan.app',
      ALLOW_DEMO_SNAPSHOT: 'true',
      POLYMARKET_GAMMA_URL: 'https://gamma-api.polymarket.com/markets',
      ARC_CHAIN_ID: '5042002',
      ARC_RPC_URL: 'https://rpc.testnet.arc.network',
      ARC_USDC_ADDRESS: '0x3600000000000000000000000000000000000000',
      ARC_USDC_DECIMALS: '6',
      AUTONOMY_VOL_MODE: 'DRY_RUN',
      AUTONOMY_MOMENTUM_MODE: 'OFF',
      PROOF_SMOKE_MAX_STAKE_USDC6: '50000',
      PROOF_SMOKE_MAX_DAILY_USDC6: '50000',
      PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY: '1'
    });

    const view = buildOperatorHealthView({
      env,
      now: '2026-05-20T12:00:00.000Z',
      state: {
        markets: [],
        signals: [],
        autonomyRuns: [
          {
            runId: 'auto-run-failed',
            idempotencyKey: 'cron:window-1',
            scheduleWindowId: '2026-05-20T11:45:00.000Z/15m',
            status: 'failed',
            source: 'demo_snapshot',
            triggeredAt: '2026-05-20T11:45:00.000Z',
            completedAt: '2026-05-20T11:45:05.000Z',
            marketCount: 1,
            generatedSignalCount: 1,
            modeByAgent: {
              volatility: 'DRY_RUN',
              momentum: 'OFF'
            },
            queue: [],
            failureReasonCode: 'autonomous_run_failed'
          }
        ],
        ops: {
          autonomous: {
            lock: {
              scope: 'autonomy',
              token: 'secret-lock-token',
              runId: 'auto-run-active',
              key: 'cron:window-2',
              acquiredAt: '2026-05-20T11:59:00.000Z',
              expiresAt: '2026-05-20T12:04:00.000Z'
            },
            claims: [
              {
                scope: 'autonomy',
                claimKey: 'autonomy:5042002:arena-1:signal-1:volatility',
                signalId: 'signal-1',
                agentName: 'volatility',
                stakeMicroUsdc: 50000,
                chainId: 5_042_002,
                arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                runId: 'auto-run-failed',
                status: 'uncertain',
                reasonCode: 'persist_committed_signal_failed',
                txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                createdAt: '2026-05-20T11:45:00.000Z',
                updatedAt: '2026-05-20T11:45:03.000Z'
              }
            ],
            lastFailure: {
              runId: 'auto-run-failed',
              reasonCode: 'autonomous_run_failed',
              rawDiagnostic:
                'Error: request to https://rpc.internal.example failed with 500 and header x-debug-trace',
              occurredAt: '2026-05-20T11:45:05.000Z'
            }
          },
          proof: {
            lock: null,
            claims: []
          }
        }
      },
      controlRoom: {
        status: 'degraded',
        reason: 'rpc timeout https://rpc.internal.example',
        chainId: 5_042_002,
        arenaAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        usdcAddress: '0x3600000000000000000000000000000000000000',
        usdcDecimals: 6,
        commitAvailable: false,
        latestTxHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        wallets: {
          volatility: {
            publicAddress: '0x1111111111111111111111111111111111111111',
            usdcBalanceMicroUsdc: '25000',
            allowanceMicroUsdc: '10000'
          },
          momentum: {
            publicAddress: '0x2222222222222222222222222222222222222222',
            usdcBalanceMicroUsdc: '25000',
            allowanceMicroUsdc: '10000'
          }
        }
      }
    });

    expect(view.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reasonCode: 'AUTONOMY_DRY_RUN',
          impact: 'autonomy_dry_run_or_off'
        }),
        expect.objectContaining({
          reasonCode: 'LOCK_ACTIVE',
          impact: 'autonomy_blocked'
        }),
        expect.objectContaining({
          reasonCode: 'UNCERTAIN_CLAIM_RECONCILE_REQUIRED',
          impact: 'bounded_tx_blocked'
        }),
        expect.objectContaining({
          reasonCode: 'CHAIN_DEGRADED',
          impact: 'read_only_proof_safe'
        }),
        expect.objectContaining({
          reasonCode: 'ALLOWANCE_LOW',
          impact: 'bounded_tx_blocked'
        })
      ])
    );
    expect(JSON.stringify(view)).not.toContain('secret-lock-token');
    expect(JSON.stringify(view)).not.toContain('https://rpc.internal.example');
    expect(JSON.stringify(view)).not.toContain('x-debug-trace');
  });
});
