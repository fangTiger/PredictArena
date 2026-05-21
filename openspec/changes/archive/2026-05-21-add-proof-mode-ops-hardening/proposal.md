# Change: Add proof mode and autonomous operations hardening

## Why

PredictArena now has autonomous runs, run receipts, agent reputation profiles, and a guided demo settlement script. The next demo/readiness gap is proving that the system can run safely in front of judges and operators: show the latest proof bundle in one place, verify Arc readiness with a live smoke path, and prevent repeated cron invocations from committing duplicate autonomous spend.

## What Changes

- Add a Judge Proof Pack page and public read API that aggregates latest autonomous receipt, Arc readiness, latest tx, wallet/public contract facts, bonded USDC, top reputation profile, resolution summary, and next demo action.
- Add Live Arc Smoke / Proof Mode:
  - read-only smoke checks for chain id, contract config, wallet derivation, USDC balance, allowance, and commit preconditions;
  - optional transactional smoke can commit one caller-selected existing eligible signal only when protected by a server-side proof secret, a finite per-transaction cap, a finite proof-specific daily budget, a proof transaction lock, and a durable single-use proof claim.
- Add cron idempotency and run locking for autonomous scheduled runs:
  - deterministic idempotency keys and schedule-window ids derived consistently across instances;
  - atomic first-writer-wins run state and active lock with TTL;
  - duplicate/retry-safe response for the same run key or schedule window;
  - durable per-signal commit claims so retries, crashes, or concurrent windows cannot duplicate Arc commits.
- Add Operator Health read model and UI for last cron success/failure, lock state, budget exhaustion, chain availability, allowance/balance warnings, and dry-run/live status.
- Add structured health explanations for every degraded/blocked state, including blocking fact, impact scope, recommended next action, and whether read-only proof remains safe, bounded proof transactions are blocked, or autonomy is dry-run/off.
- Sanitize public proof/health APIs so they expose only enum reason codes, timestamps, and safe summaries; they must not expose secrets, lock owners, idempotency keys, raw RPC/internal errors, stack-like messages, URLs, or headers.
- Update docs, tests, and OpenSpec specs.

## Out of Scope

- On-chain event backfill/indexing of historical `SignalCommitted`/`SignalResolved` logs.
- New smart-contract deployments or ABI-breaking contract changes.
- Polymarket order execution.
- Removing or weakening existing autonomy budget policies.
- Unbounded proof-mode spend or automatic proof-mode signal selection.
- Reusing any unauthenticated public server-wallet commit path to bypass proof/autonomy budget, idempotency, claim, or lock checks.

## Impact

- Affected specs: `predictarena`, `predictarena-ui`
- Affected code: cron runner persistence/state, Arc readiness/proof services, proof/health APIs, Proof Pack UI, tests, README/env template
- Risk areas: autonomous spend safety, cron retry behavior, secret handling, public proof API sanitization, UI clarity
