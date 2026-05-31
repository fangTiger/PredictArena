## ADDED Requirements

### Requirement: Saved Intelligence Controls UI

PredictArena UI MUST let users save and reapply intelligence filters without obscuring the existing research workspace.

#### Scenario: User saves current filter

- **WHEN** a user opens `/intelligence`, adjusts market radar filters, and saves the current filter
- **THEN** the UI stores the filter under the local workspace id with a bounded user-visible name
- **AND** the saved filter can be reapplied to the market radar without requiring account login, wallet connection, transaction, manual market creation, or manual evidence input
- **AND** the saved-state area discloses that preferences are saved on this device or local workspace and may be lost if local storage is cleared

#### Scenario: Saved filter cannot be stored

- **WHEN** a save request fails because of validation, item limits, or unavailable persistence
- **THEN** the UI keeps the current research filters visible
- **AND** it shows a safe, actionable error without exposing stack traces, raw provider diagnostics, server config, or secrets

### Requirement: Watchlist UI

PredictArena UI MUST let users watch and unwatch supported markets from the intelligence workspace.

#### Scenario: User watches a market

- **WHEN** a user clicks watch on a market row or selected research panel
- **THEN** the market appears in the watched markets view with safe public identity, current intelligence state, and any degraded-source labels
- **AND** no market creation, agent run, transaction, order, or resolution action is triggered

#### Scenario: Watched market is degraded

- **WHEN** a watched market expires, disappears, becomes unsupported, or has degraded data
- **THEN** the UI keeps the watch item visible with a reason and a safe next action such as review data health or remove from watchlist

### Requirement: Intelligence Alert Center UI

PredictArena UI MUST provide an in-app alert center for deterministic research alerts.

#### Scenario: User reviews alerts

- **WHEN** alerts exist for the local workspace
- **THEN** the UI shows unread count, reason code or human label, severity, changed metric snapshot, created timestamp, and link back into the read-only research path
- **AND** alert copy uses research language and does not present buy, sell, trade, copy, guaranteed, or financial-advice wording

#### Scenario: User refreshes saved intelligence

- **WHEN** a user refreshes saved intelligence from `/intelligence`
- **THEN** the UI triggers alert evaluation for the local workspace and shows last evaluated, stale, never evaluated, or failed state
- **AND** a failed evaluation keeps saved filters, watchlist, existing alerts, and market radar visible with a safe error message
- **AND** no transaction, order, agent run, market mutation, proof action, Arc action, autonomy action, or resolution action is triggered

#### Scenario: User manages alert state

- **WHEN** a user marks an alert read, unread, or dismissed
- **THEN** only alert state changes
- **AND** market, signal, proof, Arc, autonomy, and resolution state remain unchanged

### Requirement: Daily Research Queue UI

PredictArena UI MUST expose a daily research queue that helps users resume recurring market research.

#### Scenario: User opens daily queue

- **WHEN** a user opens `/intelligence` with saved filters, watched markets, or alerts
- **THEN** the page shows a prioritized daily queue with item reason, severity, current opportunity/risk/data-health snapshot, expiry context, and link to selected research
- **AND** the existing market radar, selected research summary, agent comparison, and paper-follow controls remain reachable

#### Scenario: Queue is empty

- **WHEN** no saved filters, watched markets, or alerts exist
- **THEN** the UI shows a compact onboarding-safe state that invites saving a filter or watching a market
- **AND** it discloses local workspace/device-saved behavior without implying account sync
- **AND** it does not imply trading, performance guarantees, or required account connection

#### Scenario: Saved intelligence is responsive

- **WHEN** saved filter controls, watchlist, alert center, and daily queue render on desktop or mobile
- **THEN** the user can save a filter, watch a market, review an alert, open a queue item, and return to research without horizontal scrolling, overlapping text, or hidden core controls
