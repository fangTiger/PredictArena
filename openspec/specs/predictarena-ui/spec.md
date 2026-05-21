# predictarena-ui Specification

## Purpose
Define the user-facing PredictArena war-room dashboard experience, including visual atmosphere, local hero asset behavior, preservation of the autonomous MVP flow, and responsive operational layout.
## Requirements
### Requirement: War Room Prediction-Market Atmosphere

The application MUST present PredictArena as an autonomous prediction-market agent arena with a clear financial-terminal and Arc signal-bond atmosphere, rather than as a generic dashboard.

#### Scenario: User opens the redesigned dashboard

- **WHEN** the user opens the app
- **THEN** the first screen shows PredictArena branding, autonomous agent arena framing, market scan status, and signal-bond context
- **AND** the page visually emphasizes BTC, ETH, SOL, probabilities, signals, and Arc/USDC commitment rather than order entry

### Requirement: Generated Visual Asset

The redesigned UI MUST use a local bitmap visual asset to create a stronger hackathon demo presence without hotlinking external imagery.

#### Scenario: Hero asset is available

- **WHEN** the dashboard renders
- **THEN** it references a local image asset from `public/`
- **AND** the asset supports the prediction-market arena theme

#### Scenario: Hero asset cannot be loaded

- **WHEN** the image fails to load or is unavailable in a runtime environment
- **THEN** the dashboard still remains usable through CSS layout, text, metrics, controls, and stateful data

### Requirement: Preserve Autonomous MVP Flow

The redesigned UI MUST preserve the existing autonomous flow and MUST NOT introduce manual market creation, manual prediction-question entry, manual evidence input, AMM controls, or Polymarket order execution.

#### Scenario: User runs agents after redesign

- **WHEN** the user clicks "Run Agents"
- **THEN** the application uses the existing agent-run API
- **AND** displays BUY_YES, BUY_NO, or AVOID signals with confidence, edge, reasons, and Arc commit eligibility

#### Scenario: Manual inputs remain absent

- **WHEN** the user views the redesigned app
- **THEN** there is no manual evidence textarea
- **AND** there is no manual prediction-question input
- **AND** there is no market creation or trading order-entry control

### Requirement: Responsive Operational Layout

The redesigned dashboard MUST remain usable on desktop and mobile viewports without overlapping text or hidden core controls.

#### Scenario: Desktop viewport

- **WHEN** the app renders on a desktop viewport
- **THEN** market scan controls, signal board, Arc commit state, and leaderboard are all visible in a dense operational layout

#### Scenario: Mobile viewport

- **WHEN** the app renders on a mobile viewport
- **THEN** the dashboard stacks into a single-column flow
- **AND** the Run Agents and commit controls remain reachable without horizontal scrolling

### Requirement: Autonomy Panel UI

PredictArena UI MUST show autonomous run state, per-agent budgets, and dry-run/live outcomes in the Arena dashboard.

#### Scenario: User opens Arena after autonomous runs

- **WHEN** the user opens `/arena`
- **THEN** the page shows recent autonomous run history, mode by agent, budget utilization, dry-run count, committed count, skipped count, and latest queue failures
- **AND** the panel uses the existing PredictArena war-room design language

#### Scenario: Dry-run run is visible

- **WHEN** the latest autonomous run is `DRY_RUN`
- **THEN** the UI shows that no chain transaction was attempted
- **AND** the generated dry-run signals remain inspectable

### Requirement: Agent Control Room / Arc Readiness Panel

PredictArena UI MUST show public Arc readiness data so the demo can distinguish real settlement readiness from front-end-only state.

#### Scenario: Readiness data is available

- **WHEN** the readiness API returns contract and wallet status
- **THEN** the UI shows Arc chain, contract address, agent wallet addresses, USDC balance, allowance, latest tx, and commit availability

#### Scenario: Readiness data is degraded

- **WHEN** readiness cannot be fetched
- **THEN** the UI shows a degraded state without exposing secrets or blocking market/agent display

### Requirement: Signal Decision Trace

Signal detail UI MUST present the signal as an auditable decision trace.

#### Scenario: User opens signal detail

- **WHEN** the user opens `/signals/[id]`
- **THEN** the page shows Market Scout score breakdown, candle volatility summary, Monte Carlo probability, Momentum drift, Risk Agent pass/block timeline, modelHash/dataHash deterministic payload, CLOB spread/midpoint/liquidity diagnostics, and Arc tx/resolution state

### Requirement: Commit Queue UI

PredictArena UI MUST show batch commit queue state for eligible signals.

#### Scenario: Batch commit produces mixed outcomes

- **WHEN** eligible signals are batch committed or evaluated by autonomous run
- **THEN** the UI shows each queue row's signal id, agent, policy decision, approval/commit status, failure reason if any, and tx hash if committed

### Requirement: Hidden Admin Demo Resolution UI

PredictArena UI MUST provide a hidden or admin-only entry for demo resolution that is clearly labelled as admin/demo settlement.

#### Scenario: Admin resolves a demo signal

- **WHEN** the admin command is used with the configured token
- **THEN** the UI can mark a selected signal correct or incorrect through the server route
- **AND** the leaderboard state reflects refunded, slashed, and Brier score updates

### Requirement: Autonomous Run Receipt UI

PredictArena UI MUST provide an audit-style receipt page for autonomous runs.

#### Scenario: User opens a run receipt

- **WHEN** a user follows a recent run from the Autonomy Panel
- **THEN** the receipt page shows run timing, source, mode by agent, market/signal counts, queue decisions, budget snapshots, related signal links, model/data hashes, failure reasons, and tx links when present
- **AND** the page uses the existing PredictArena war-room design language

### Requirement: Agent Reputation Profile UI

PredictArena UI MUST provide a profile page for each supported agent.

#### Scenario: User opens an agent profile

- **WHEN** a user follows an agent from the leaderboard
- **THEN** the page shows reputation metrics, bonded/refunded/slashed USDC, confidence mix, Brier/accuracy state, recent signals, and best/worst resolved outcomes

### Requirement: Resolution Demo Script UI

PredictArena UI MUST provide a guided demo script surface for presenting the prediction-to-settlement loop.

#### Scenario: Operator follows the demo script

- **WHEN** the operator opens the demo script page
- **THEN** the UI shows steps for generate, commit/readiness, admin/demo settlement, leaderboard sync, and verification
- **AND** any settlement control is clearly labelled `Demo/Admin Only` and `not an oracle`
- **AND** the UI remains usable on desktop and mobile without horizontal scrolling

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

