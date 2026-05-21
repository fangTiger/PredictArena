# Change: Add run receipts, agent reputation profiles, and resolution demo script

## Why

PredictArena now supports autonomous dry-run/live runs, budget policies, Arc readiness, and decision traces, but demo observers still need a clearer end-to-end audit trail: what each run saw, why each signal was allowed or blocked, how each agent is performing over time, and how the demo resolution loop should be executed.

## What Changes

- Add an autonomous run receipt surface that summarizes run inputs, deterministic hashes, generated signals, policy/risk decisions, dry-run/live commit outcomes, and chain transaction references.
- Add per-agent reputation profiles that expand leaderboard rows into agent-level generated/committed/open/resolved performance, confidence buckets, Brier score, bonded/refunded/slashed USDC, and best/worst resolved signals.
- Add a guided resolution demo script page that walks the operator through run, commit/readiness, admin/demo settlement, leaderboard sync, and verification states without presenting demo settlement as an oracle.
- Add public API helpers for receipts and reputation data without exposing `CRON_SECRET`, Supabase service role keys, agent private keys, or admin private keys.
- Update UI and docs while preserving the autonomous MVP flow and excluding cron idempotency/run locking from this change.

## Out of Scope

- Cron idempotency keys, distributed locks, retry deduplication, or scheduler coordination.
- New smart-contract deployments or contract ABI-breaking changes.
- Public oracle integration or decentralized settlement claims.
- Polymarket order execution.
- New frontend component framework or visual redesign outside the existing PredictArena war-room system.

## Impact

- Affected specs: `predictarena`, `predictarena-ui`
- Affected code: persistence/read models, autonomy API surfaces, leaderboard/agent UI, demo resolution UI, tests, README
- Risk areas: admin/demo authorization clarity, secret exposure, derived metrics correctness, responsive UI density
