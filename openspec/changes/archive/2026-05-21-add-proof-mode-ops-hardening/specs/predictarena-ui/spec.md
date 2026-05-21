## ADDED Requirements

### Requirement: Judge Proof Pack UI

PredictArena UI MUST provide a compact proof pack page for judges and operators.

#### Scenario: User opens proof pack

- **WHEN** a user opens `/proof`
- **THEN** the first viewport shows latest autonomous receipt, Arc readiness, latest tx, agent wallet/contract facts, bonded USDC, top reputation, resolution summary, and next demo action
- **AND** the page uses the existing PredictArena war-room design language without becoming a marketing landing page

### Requirement: Operator Health UI

PredictArena UI MUST show autonomous operations health and blocking reasons.

#### Scenario: Health is ready

- **WHEN** cron, budgets, Arc readiness, balances, and allowance are healthy
- **THEN** the UI shows a ready state for autonomous operations

#### Scenario: Health is degraded

- **WHEN** cron failed, a lock is active, budget is exhausted, chain config is missing, allowance is low, balance is low, or autonomy is dry-run/off
- **THEN** the UI shows a specific degraded or blocked reason without exposing secrets
- **AND** each degraded or blocked item shows the blocking fact, impact scope, and recommended next action
- **AND** the UI distinguishes read-only proof still safe, bounded transaction blocked, and autonomy dry-run/off impact states

### Requirement: Proof Smoke Controls UI

PredictArena UI MUST expose proof smoke state safely.

#### Scenario: Read-only proof is shown

- **WHEN** proof smoke data is available
- **THEN** the UI shows read-only chain and commit precondition checks
- **AND** it clearly indicates that no transaction was sent

#### Scenario: Transactional proof control is shown

- **WHEN** a transactional proof control is available
- **THEN** it requires an operator-entered proof secret and caller-selected signal id
- **AND** it labels the action as a bounded testnet proof transaction rather than routine autonomous spend

#### Scenario: Transactional proof is blocked

- **WHEN** proof authorization, eligibility, allowance, balance, proof budget, proof claim, proof lock, or public commit hardening blocks a transaction
- **THEN** the UI keeps read-only proof facts visible when they are safe
- **AND** it shows that bounded transaction proof is blocked with a sanitized reason, impact scope, and next action
