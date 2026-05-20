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
