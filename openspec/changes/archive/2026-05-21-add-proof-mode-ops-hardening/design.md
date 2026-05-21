# Design: Proof mode and operations hardening

## Architecture

This change adds a proof/ops layer on top of existing persistence and Arc services rather than replacing the agent pipeline. The central read model is `ProofPackView`, derived from persisted arena state, latest autonomous run receipt, Arc readiness, metrics, and agent reputation. It powers a new `/proof` page and `GET /api/proof` public endpoint.

Operator health should be read-only and derived from the same facts plus cron state. It should report health categories such as `ready`, `dry_run_only`, `budget_exhausted`, `chain_degraded`, `allowance_low`, `lock_active`, and `last_run_failed` without exposing secrets.

Every degraded or blocked health item must use a structured explanation:

- `reasonCode`: stable enum value such as `CHAIN_DEGRADED`, `ALLOWANCE_LOW`, `AUTONOMY_DRY_RUN`, `PROOF_BUDGET_EXHAUSTED`, or `LOCK_ACTIVE`.
- `blockingFact`: the concrete sanitized fact that is unhealthy, for example "USDC allowance is below the selected stake cap".
- `impact`: one of `read_only_proof_safe`, `bounded_tx_blocked`, `autonomy_dry_run_or_off`, `autonomy_blocked`, or `demo_attention_needed`.
- `nextAction`: an operator-facing remediation step such as "increase allowance from the deployer wallet" or "switch autonomy mode to LIVE after review".

The public read model may include timestamps, public wallet/contract addresses, balances, enum reason codes, and safe summaries. It must not include `PROOF_MODE_SECRET`, `CRON_SECRET`, lock owner tokens, idempotency keys, raw RPC errors, stack-like messages, internal URLs, request headers, or provider diagnostics. Private persistence may keep internal details only when they are not returned by public APIs.

## Cron Idempotency and Locking

The autonomous cron endpoint should accept or derive an idempotency key and a schedule-window id. For Vercel GET cron, both must be derived from UTC schedule configuration, not instance-local time zones, and must be stable across instances for the same logical cron slot. For POST, a provided `idempotencyKey` may be accepted after validation, but the server still derives and records the schedule-window id.

The persistence layer must provide atomic first-writer-wins operations for run state and lock acquisition:

- `acquireAutonomousRun(runKey, scheduleWindowId, lockTtl)` succeeds for one caller only and records `started`, lock expiry, and a private lock token.
- A concurrent request with the same run key or schedule-window id returns the existing run or in-progress state and performs no market fetch, agent run, approval, or commit.
- A concurrent request with a different key while a non-expired lock is active returns a controlled locked response and performs no side effects.
- Public health may show that a lock is active and when it expires, but not the private lock token or idempotency key.

Before any Arc transaction, the runner must create a durable per-signal commit claim keyed by signal/agent/chain/contract. A successful, pending, or uncertain claim blocks later retries from submitting the same signal again, even if the original run crashes after tx submission but before finalize persistence. Expired or zombie locks must be visible in operator health, and recovery may continue only with signals that have no committed or uncertain claim.

Locking is not a substitute for budget policy. Existing budget checks remain mandatory.

## Live Arc Smoke / Proof Mode

Proof mode has two levels:

1. Read-only smoke: public-safe endpoint checks chain id, contract address, agent public wallets, USDC balance, allowance, latest tx, and whether at least one existing signal could be committed.
2. Transactional smoke: protected endpoint accepts a specific existing signal id and an explicit boolean intent. It requires `PROOF_MODE_SECRET`, refuses missing/invalid secret, refuses already committed or ineligible signals, refuses stake above `PROOF_SMOKE_MAX_STAKE_USDC6`, applies existing `AgentPolicy` checks, and also applies proof-specific cumulative limits such as `PROOF_SMOKE_MAX_DAILY_USDC6` and `PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY`. These proof limits default to disabled/zero unless configured to finite values. It must never auto-select a signal or spend without finite per-transaction and cumulative caps.

Transactional proof must use a proof-specific atomic claim and single-flight lock before sending any Arc transaction. The claim is keyed by chain, contract, signal id, and proof mode. A repeated request for the same claim returns the existing proof result or an `uncertain_reconcile_required` state; it must not submit a second transaction. If a tx may have been submitted but the hash/final state was not persisted, bounded proof transactions are blocked until the operator reconciles the latest tx.

The implementation must not route proof transactions through an unauthenticated public server-wallet commit path. If an existing commit endpoint remains public, it must either be read-only/disabled for server-wallet spend or share the same authorization, budget, idempotency, claim, and lock boundary before proof transactions are enabled.

## UI Design Decisions

- Color palette: reuse existing PredictArena tokens (`--arc-blue`, `--signal-mint`, `--risk`, `--caution`, neutral surfaces); no new dominant hue family.
- Typography: keep current Space Grotesk / IBM Plex Mono pairing.
- Spacing system: existing dense 8/10/12/16px operational rhythm.
- Border-radius strategy: panels/cards remain 8px or less; chips may remain pill-shaped.
- Shadow hierarchy: use existing panel shadow only; no new decorative elevation stack.
- Motion style: existing 140-180ms hover/focus transitions; no ornamental animation.

The Proof Pack should be a compact operational dashboard, not a marketing landing page. It should expose concrete chain/proof facts in the first viewport.

Operator Health and Proof Smoke UI should show concise, judge-readable explanations rather than raw errors. Each warning row should show the blocking fact, impact, and next action. The UI must distinguish:

- Read-only proof still safe: no transaction can be sent, but public Arc/readiness facts can still be inspected.
- Bounded tx blocked: a proof transaction is unavailable because authorization, allowance, balance, budget, lock, claim, or eligibility failed.
- Autonomy dry-run/off: autonomous runs may persist receipts without chain transactions or may be disabled.

## Review Consensus

Before implementation, two Review Codex agents must review this proposal:

- Security/Onchain reviewer: focuses on spend caps, secrets, authorization, cron locking, and external chain/RPC behavior.
- Product/Demo reviewer: focuses on judge proof narrative, UI clarity, demo flow, and avoiding misleading claims.

Architecture Codex proceeds to handoff only after both reviewers and Architecture Codex agree on scope or after proposal edits resolve their blocking feedback.
