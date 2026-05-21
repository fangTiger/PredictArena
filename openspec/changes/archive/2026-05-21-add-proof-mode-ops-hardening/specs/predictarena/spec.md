## ADDED Requirements

### Requirement: Cron Idempotency and Autonomous Run Locking

PredictArena MUST prevent duplicate autonomous commit side effects from scheduler retries or overlapping cron invocations.

#### Scenario: Run acquisition is atomic

- **WHEN** concurrent cron requests attempt to start the same idempotency key or schedule-window id
- **THEN** exactly one request acquires the run and lock through an atomic first-writer-wins operation
- **AND** all other requests return the existing run or in-progress state
- **AND** the non-winning requests perform no market fetch, agent run, Arc approval, or Arc commit side effect

#### Scenario: Same idempotency key or schedule window is retried

- **WHEN** the cron endpoint receives a retry with the same idempotency key or the same UTC schedule-window id as an existing autonomous run
- **THEN** the system returns the existing run or in-progress state
- **AND** it does not re-run commits or duplicate signal bonds for that key

#### Scenario: Different cron run arrives while lock is active

- **WHEN** a cron request arrives while a non-expired autonomous run lock is active
- **THEN** the system returns a controlled locked response
- **AND** no market fetch, agent run, Arc approval, or Arc commit side effect occurs

#### Scenario: Commit succeeds but finalize fails

- **WHEN** an autonomous run created a durable commit claim before attempting an Arc transaction
- **AND** the process crashes or fails before final run persistence
- **THEN** a retry MUST NOT submit a second Arc transaction for the same signal
- **AND** operator health reports an uncertain claim requiring reconciliation before that signal can be retried

#### Scenario: Lock expires after failed run

- **WHEN** a previous lock has expired after a failed or interrupted run
- **THEN** a new cron request may acquire the lock
- **AND** the previous failure remains visible in operator health state
- **AND** signals with successful, pending, or uncertain commit claims remain blocked from duplicate commit attempts

### Requirement: Live Arc Smoke Proof Mode

PredictArena MUST provide a safe proof mode for demonstrating Arc readiness and, when explicitly authorized, committing one bounded existing signal.

#### Scenario: Read-only smoke runs

- **WHEN** the proof smoke read endpoint is called
- **THEN** it reports chain id, contract configuration, public agent wallet addresses, USDC balance, allowance, latest tx, and commit preconditions
- **AND** it does not send Arc transactions or expose secrets

#### Scenario: Transactional smoke is authorized

- **WHEN** a caller provides the configured proof secret, an explicit existing signal id, and an explicit transactional intent
- **THEN** the system may commit that signal only if it is eligible, uncommitted, within `PROOF_SMOKE_MAX_STAKE_USDC6`, within configured proof-specific daily spend and transaction-count caps, and compatible with existing budget/commit rules
- **AND** the system creates a durable single-use proof claim and proof transaction lock before attempting any Arc transaction
- **AND** the resulting tx hash is persisted like any other commit

#### Scenario: Transactional smoke is retried

- **WHEN** a transactional proof request is retried for a signal with an existing successful, pending, or uncertain proof claim
- **THEN** the system returns the existing proof result or a reconciliation-required state
- **AND** it does not send a second Arc transaction for that signal

#### Scenario: Transactional smoke is unsafe

- **WHEN** the proof secret is missing or invalid, the signal is already committed, the signal is ineligible, the stake exceeds the per-signal cap, the proof daily budget is exhausted, the proof transaction count is exhausted, or a proof/autonomy lock or claim blocks the request
- **THEN** the system rejects the request with a machine-readable reason
- **AND** no Arc approval or commit transaction is attempted

#### Scenario: Public commit bypass is attempted

- **WHEN** a caller attempts to use a server-wallet commit path without the required proof or autonomy authorization and finite budget/idempotency/claim checks
- **THEN** the system rejects or disables the spend path
- **AND** no Arc approval or commit transaction is attempted

### Requirement: Operator Health and Judge Proof Pack Read Models

PredictArena MUST expose sanitized operational proof data for judges and operators.

#### Scenario: Operator health is retrieved

- **WHEN** a client reads operator health
- **THEN** the response includes last cron status, active lock state, budget warning state, chain/readiness state, allowance/balance warning state, and autonomy mode state
- **AND** every degraded or blocked state includes a structured explanation with a reason code, blocking fact, impact scope, and recommended next action
- **AND** the impact scope distinguishes read-only proof still safe, bounded proof transaction blocked, autonomy dry-run/off, and autonomy blocked states
- **AND** no server secrets, lock owners, idempotency keys, raw RPC errors, stack-like messages, internal URLs, request headers, or provider diagnostics are exposed

#### Scenario: Judge proof pack is retrieved

- **WHEN** a client reads the proof pack
- **THEN** the response includes latest autonomous receipt summary, Arc readiness facts, latest tx, bonded USDC, top reputation profile, resolution/refund/slash summary, and recommended next demo action
- **AND** the response distinguishes read-only proof from transactional proof mode
- **AND** public failure or warning details use sanitized reason codes and safe summaries only
