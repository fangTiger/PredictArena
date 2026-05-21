# Design: Autonomous Agent Runs

## Architecture

Autonomous execution is centralized in `lib/autonomy/runAutonomousAgents.ts`. The runner fetches markets, loads price snapshots, runs the existing Volatility and Momentum agents, applies existing Risk Agent output, evaluates per-agent `AgentPolicy` budgets, and persists an `AutonomousRunRecord`. The API route only handles authorization and request parsing, then delegates to the runner.

`AgentPolicy` is a server-side model keyed by agent name:

- `mode`: `OFF`, `DRY_RUN`, or `LIVE`
- `maxDailyBondUsdc6`
- `maxSignalsPerDay`
- `maxStakePerSignalUsdc6`
- `maxOpenSignals`
- `minEdgeBps`

Default policies are intentionally conservative and finite. Environment variables may override them, but parsing must reject missing or non-finite LIVE spend limits.

## Runner Flow

1. Check `CRON_SECRET` authorization at the route boundary.
2. Fetch/rank candidate markets through `fetchCandidateMarkets`.
3. Fetch candles/snapshots and generate signals through `runAgents`.
4. Save scan and generated signals.
5. Evaluate each medium/high non-AVOID signal against its agent policy and current persisted signals.
6. In `OFF`, do not commit and record `mode_off`.
7. In `DRY_RUN`, persist generated/dry-run queue outcomes without calling Arc.
8. In `LIVE`, call the existing commit service only for policy-eligible signals and persist committed tx hashes or failure reasons.
9. Store run history with counts, skipped reasons, queue rows, and budget snapshots.

Budget checks use persisted local/Supabase state as the public-memory source: daily spend/signals are scoped by `createdAt` UTC date, open signals are committed signals without resolution, and per-signal stake is checked before any chain call.

## Authorization

`CRON_SECRET` is server-only. The route accepts `Authorization: Bearer <CRON_SECRET>` and rejects missing/mismatched values. This matches Vercel Cron's secured invocation behavior while also supporting local `curl -X POST` jobs. The value must never appear in API JSON or UI.

## Arc Control and Sync

`lib/arc/controlRoom.ts` derives public readiness data from configured env and public chain reads:

- Arc chain id and RPC availability.
- `SignalBondArena` address and commit availability.
- Agent wallet public addresses derived server-side from private keys.
- USDC balance and allowance per agent wallet.
- Latest known tx from persisted signals.

`lib/arc/syncLeaderboard.ts` reads `SignalCommitted` / `SignalResolved` logs and getter state when configuration is available, then reconciles matching local signals by external id or record id. If RPC/config is missing, the API returns a degraded status rather than failing the dashboard.

## UI Design System

Design decisions for new panels:

- Color palette: reuse existing `--arc-blue`, `--signal-mint`, `--caution`, `--risk`, neutral surface tokens.
- Typography: existing Space Grotesk / IBM Plex Mono stack.
- Spacing: existing 8/10/12/16px dashboard rhythm.
- Border radius: 8px panels/cards, pill radius only for status chips.
- Shadow hierarchy: reuse `--shadow-panel` and `--shadow-soft`.
- Motion: existing 140-180ms hover/focus feedback plus scan/radar motion; no new decorative gradients or unrelated imagery.

The Autonomy Panel lives inside the existing Arena war-room shell and shows mode, policy budgets, last run, queue outcomes, and dry-run/live status. Signal detail gets an unframed Decision Trace section with deterministic payload and Risk Agent timeline. Control Room uses compact operational cards rather than marketing blocks.

## Admin Demo Resolution

The existing admin-token boundary remains the trust boundary. A hidden admin panel or command entry calls the existing demo/admin route with `ADMIN_RESOLVE_TOKEN`; it labels the action as demo/admin settlement and updates local leaderboard state. If onchain owner resolution is available, it can use the existing owner path, but failure degrades to demo-only metadata rather than claiming oracle finality.

## Validation

Primary validation:

- Targeted Vitest for policy budget decisions and cron route auth/mode behavior.
- Store tests for autonomous run history and dry-run persistence.
- API route tests for `CRON_SECRET`, `DRY_RUN`, `LIVE` no-unlimited-spend guards.
- Existing commit/resolution tests remain green.
- E2E smoke checks for Autonomy Panel, Control Room, run history, and Decision Trace.
