## ADDED Requirements

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
