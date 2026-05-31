## ADDED Requirements

### Requirement: Market Intelligence Workspace UI

PredictArena UI MUST provide a daily-use market intelligence workspace for scanning supported prediction markets without becoming a trading interface.

#### Scenario: User enters the product workspace

- **WHEN** a user opens the default app entry or uses global navigation
- **THEN** `/intelligence` is discoverable as the primary research workspace
- **AND** `/arena` remains available as the operations surface

#### Scenario: User opens the intelligence workspace

- **WHEN** a user opens `/intelligence`
- **THEN** the page shows a dense market radar with filters for asset, condition type, expiry window, minimum edge, confidence, liquidity/data health, and sort order
- **AND** each visible market shows opportunity, risk, data health, implied probability, latest agent edge, and accountability status
- **AND** the page does not show Polymarket order entry, AMM controls, manual market creation, or manual evidence input

#### Scenario: Intelligence workspace is responsive

- **WHEN** the workspace renders on desktop or mobile
- **THEN** filters, market radar, selected research summary, agent comparison, and paper-follow controls remain reachable without horizontal scrolling or overlapping text

#### Scenario: User completes a daily research session

- **WHEN** a user filters or sorts markets, selects a market or signal, compares a relevant agent segment, and adjusts paper-follow assumptions
- **THEN** the UI shows a coherent read-only research path from market discovery to signal explanation to agent comparison to paper-follow output
- **AND** each step exposes data health or insufficient-data labels when applicable
- **AND** the session does not require a transaction, account connection, manual market, manual evidence, or trading control

### Requirement: Signal Research UI

PredictArena UI MUST make signal and market research understandable before any accountability or transaction action.

#### Scenario: User inspects a market or signal

- **WHEN** a user selects a market or opens a research view
- **THEN** the UI shows market pricing, agent probabilities, probability gap, volatility and momentum drivers, risk flags, comparable historical outcomes when available, model/data hashes, and accountability status
- **AND** the UI labels degraded or missing data instead of hiding it

### Requirement: Segmented Agent Comparison UI

PredictArena UI MUST let users compare agent track records by useful prediction-market segments.

#### Scenario: User compares agents by segment

- **WHEN** a user chooses an asset, condition type, expiry bucket, confidence bucket, or edge bucket
- **THEN** the UI shows generated, committed, resolved, accuracy, Brier score, average edge, paper ROI when available, and bonded/refunded/slashed USDC per agent or segment
- **AND** low-sample segments are visibly labeled as insufficient data

### Requirement: Paper Follow UI

PredictArena UI MUST provide a read-only paper-follow/backtest surface for selected agents or strategies.

#### Scenario: User evaluates paper-follow assumptions

- **WHEN** a user selects agent, edge, confidence, asset, condition type, date range, or stake assumptions
- **THEN** the UI shows included/skipped/unresolved counts, source mix, paper ROI, hit rate, Brier score, max drawdown, breakdowns, and assumptions
- **AND** it clearly labels the output as research/backtest information, not financial advice or a trade recommendation
- **AND** it does not expose transaction controls or mutation actions
