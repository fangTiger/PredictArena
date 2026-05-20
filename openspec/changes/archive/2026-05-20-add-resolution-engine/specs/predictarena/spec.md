## ADDED Requirements

### Requirement: Automatic Crypto Signal Resolution

PredictArena MUST automatically resolve committed, unresolved crypto price signals using public candle data from the existing price provider and demo snapshot fallback.

#### Scenario: Expiry-above signal is resolved

- **WHEN** a committed `EXPIRY_ABOVE` signal has passed expiry and candle settlement data is available
- **THEN** the resolver determines YES if the settlement close is greater than the threshold
- **AND** persists whether the agent signal was correct for its selected side

#### Scenario: Expiry-below signal is resolved

- **WHEN** a committed `EXPIRY_BELOW` signal has passed expiry and candle settlement data is available
- **THEN** the resolver determines YES if the settlement close is less than the threshold
- **AND** persists whether the agent signal was correct for its selected side

#### Scenario: Touch-above signal is resolved

- **WHEN** a committed `TOUCH_ABOVE` signal has candle data between signal creation and expiry
- **THEN** the resolver determines YES if any candle high is greater than or equal to the threshold
- **AND** persists whether the agent signal was correct for its selected side

#### Scenario: Touch-below signal is resolved

- **WHEN** a committed `TOUCH_BELOW` signal has candle data between signal creation and expiry
- **THEN** the resolver determines YES if any candle low is less than or equal to the threshold
- **AND** persists whether the agent signal was correct for its selected side

#### Scenario: Insufficient candle data does not force resolution

- **WHEN** a committed unresolved signal cannot be evaluated because settlement candles are missing or incomplete
- **THEN** the signal remains unresolved
- **AND** the API reports a skipped reason without fabricating an outcome

### Requirement: Resolution APIs

PredictArena MUST expose server-side resolution APIs without adding manual evidence input or manual market creation.

#### Scenario: Automatic resolution route resolves eligible signals

- **WHEN** `POST /api/resolve-signals` is called
- **THEN** the server finds committed unresolved signals whose expiry has passed or whose touch window can be evaluated
- **AND** resolves eligible signals using the Resolution Engine
- **AND** updates persistence and returns resolved and skipped signal IDs

#### Scenario: Demo forced resolution is admin-token protected

- **WHEN** `POST /api/admin/resolve-demo` is called without a valid `ADMIN_RESOLVE_TOKEN`
- **THEN** the API rejects the request
- **AND** no resolution state or onchain side effect occurs

#### Scenario: Demo forced resolution is labeled as demo-only

- **WHEN** `POST /api/admin/resolve-demo` resolves a signal with a valid admin token
- **THEN** the persisted resolution indicates a demo/admin source
- **AND** the response does not present the result as decentralized oracle resolution

### Requirement: Bulk Arc Resolution

PredictArena MUST support resolving multiple Arc signal bonds in one owner-only contract call.

#### Scenario: Bulk resolution succeeds

- **WHEN** the contract owner calls `resolveSignalsBulk` with matching signal IDs and correctness arrays
- **THEN** each unresolved signal is resolved
- **AND** correct signals refund USDC stake to the agent
- **AND** incorrect signals send USDC stake to treasury

#### Scenario: Bulk resolution rejects invalid callers or invalid arrays

- **WHEN** a non-owner calls `resolveSignalsBulk` or the arrays have different lengths
- **THEN** the transaction reverts
- **AND** no partial resolution occurs

### Requirement: Resolution Scoring and Leaderboard

PredictArena MUST update agent track records after resolution.

#### Scenario: Leaderboard includes resolution metrics

- **WHEN** signals have been resolved
- **THEN** the leaderboard shows resolved count, accuracy, Brier score, refunded USDC, slashed USDC, and paper ROI per agent

#### Scenario: Brier score changes after resolution

- **WHEN** a signal transitions from unresolved to resolved
- **THEN** the agent's Brier score is recalculated from stored YES probability and actual YES outcome
- **AND** the leaderboard no longer treats that signal as pending for Brier score
