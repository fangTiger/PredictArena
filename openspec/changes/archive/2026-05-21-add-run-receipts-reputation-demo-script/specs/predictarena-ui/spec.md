## ADDED Requirements

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
