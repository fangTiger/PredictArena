## 1. Specification and Consensus

- [x] 1.1 Create OpenSpec proposal, design, task list, and spec deltas.
- [x] 1.2 Validate `add-proof-mode-ops-hardening` with strict OpenSpec validation.
- [x] 1.3 Record dirty baseline, Graphify degradation, executor split, validation plan, and risk boundaries.
- [x] 1.4 Obtain Security/Onchain Review Codex proposal decision.
- [x] 1.5 Obtain Product/Demo Review Codex proposal decision.
- [x] 1.6 Record three-party consensus before implementation handoff.

### Clarify Gate Record

- Acceptance criteria: proof pack runs without user interaction for read-only data; proof transactions are explicitly authorized, finite, idempotent, and claim-protected; cron retries/concurrency cannot duplicate Arc spend; operator health is sanitized and judge-readable; `/proof` shows live proof narrative and degraded states.
- Out-of-scope: historical on-chain event backfill, new contract deployment, ABI-breaking contract changes, Polymarket order execution, weakening budgets, unbounded proof spend, automatic proof signal selection.
- Graphify: unavailable. This worktree has no `graphify-out/` directory, so proposal impact analysis is degraded to OpenSpec specs, local source inspection, existing tests, and `rg`/file reads.
- Dirty baseline: worktree already contains uncommitted prior feature work across autonomous runs, Arc control room/sync, run receipts, reputation, demo resolution, README/spec updates, and tests. Implementation handoff must treat those as pre-existing baseline and avoid reverting them.
- Executors: Architecture Codex owns planning, proposal edits, consensus, integration, and final verification; Implementation Codex owns implementation after consensus; Security/Onchain Review Codex and Product/Demo Review Codex own proposal review; final Review Codex owns implementation gate.
- Validation plan: `POSTHOG_DISABLED=1 openspec validate add-proof-mode-ops-hardening --strict --no-interactive`, reviewer-required `rg` keyword audit, `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`, and Browser checks for `/proof` degraded/read-only/transactional states as feasible.
- Risk boundaries: no public server-wallet spend path may bypass authorization/budget/idempotency/claim/lock checks; public APIs must redact secrets, lock owners, idempotency keys, raw RPC/internal errors, URLs, headers, and stack-like data; proof and autonomy transactions must use durable claims before tx submission; uncertain tx states block retries until reconciliation.
- Stop conditions: missing atomic persistence primitive, inability to protect existing public commit endpoint, need for contract ABI/deployment changes, reviewer `FIX_REQUIRED`, scope expansion outside the listed proof/cron/health/UI/docs/tests files, or inability to produce validation evidence.

### Proposal Review Log

- Security/Onchain Review Codex first pass: `FIX_REQUIRED`; blocking items were proof cumulative spend/idempotency, stricter cron atomicity/crash recovery, and public API redaction.
- Product/Demo Review Codex first pass: `FIX_REQUIRED`; blocking item was structured degraded-state explanation for judge/operator storytelling.
- Architecture Codex response: proposal/design/spec/tasks now require finite proof budgets, proof single-flight and single-use claims, cron first-writer locking, per-signal commit claims, commit-bypass hardening, sanitized public read models, and structured health explanations.
- Security/Onchain Review Codex second pass: `PASS`.
- Product/Demo Review Codex second pass: `PASS`.
- Three-party consensus: Architecture Codex, Security/Onchain Review Codex, and Product/Demo Review Codex agree that implementation may proceed under this scoped proposal.

## 2. Cron Idempotency and Operator Health

- [x] 2.1 Add persistence/read model support for autonomous run idempotency key, schedule-window id, run status, private lock token/owner, lock expiry, sanitized failure reason code, and server-only raw diagnostics.
- [x] 2.2 Add atomic first-writer-wins acquire/finalize semantics for run state and locks, including same-key retry, same-window retry, active-lock conflict, expired-lock recovery, and zombie-lock visibility.
- [x] 2.3 Add durable per-signal autonomous commit claims so retries, concurrent runs, and crash recovery never submit a duplicate Arc commit for the same signal; uncertain claims must block repeat tx until operator reconciliation.
- [x] 2.4 Update cron runner and `GET/POST /api/cron/run-autonomous-agents` to derive cross-instance stable UTC schedule-window ids, enforce locks/claims before market fetch or tx side effects, and preserve existing per-agent budgets.
- [x] 2.5 Add Operator Health service/API with last run, lock, budget, chain, allowance, and mode health states using structured explanations: reason code, blocking fact, impact, and next action.
- [x] 2.6 Add tests for same-key retry, same-window retry, active-lock conflict, expired-lock recovery, commit-success/finalize-failure retry safety, failure recording, sanitized public output, and no duplicate commit.

## 3. Proof Mode and Judge Proof Pack

- [x] 3.1 Add read-only proof smoke service/API for chain id, contract, wallets, USDC balance, allowance, latest tx, and commit preconditions.
- [x] 3.2 Add protected transactional proof smoke for caller-selected existing eligible signal with `PROOF_MODE_SECRET`, `PROOF_SMOKE_MAX_STAKE_USDC6`, proof-specific daily spend and transaction-count caps, proof single-flight lock, and durable single-use proof claim.
- [x] 3.3 Add Judge Proof Pack read model/API aggregating latest receipt, readiness, latest tx, bonded USDC, top reputation, resolution summary, and next demo action.
- [x] 3.4 Harden or disable any unauthenticated public server-wallet commit path that could bypass proof/autonomy authorization, budget, idempotency, claim, or lock checks.
- [x] 3.5 Add tests for proof secret auth, stake cap refusal, cumulative proof budget exhaustion, proof claim retry/idempotency, ineligible/already committed refusal, read-only no side effects, server-wallet commit bypass refusal, and public API secret/error non-exposure.

## 4. UI and Documentation

- [x] 4.1 Add `/proof` page using existing PredictArena war-room design language.
- [x] 4.2 Add Operator Health panel with lock state, last cron result, budget/chain/allowance warnings, and dry-run/live readiness; every degraded/blocked state must display blocking fact, impact, and next action.
- [x] 4.3 Link Proof Pack from primary navigation or relevant demo surfaces.
- [x] 4.4 Update `.env.example` and README for proof secret, smoke max stake, cron idempotency behavior, and operator health.
- [x] 4.5 Add E2E/browser coverage for `/proof`, health degraded copy, public redaction, and the visual distinction between read-only proof safe, bounded transaction blocked, and autonomy dry-run/off.

## 5. Review and Verification

- [x] 5.1 Implementation Codex self-review and evidence handback.
- [x] 5.2 Independent Review Codex gate after implementation.
- [x] 5.3 Run `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e`, Browser checks, and OpenSpec validation as feasible.
