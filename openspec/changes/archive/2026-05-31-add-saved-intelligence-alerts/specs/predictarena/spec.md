## ADDED Requirements

### Requirement: Local Intelligence Workspace Identity

PredictArena MUST support a lightweight local workspace identity for saved intelligence preferences without treating that identity as authentication.

#### Scenario: Workspace id is accepted for non-sensitive preference state

- **WHEN** a client sends a valid generated workspace id to saved-intelligence APIs
- **THEN** the system scopes saved filters, watched markets, alerts, and daily queue state to that workspace id
- **AND** the stored data is limited to bounded research preferences, safe public market references, deterministic alert state, and safe evaluation snapshots

#### Scenario: Invalid workspace id is rejected

- **WHEN** a client sends a missing, malformed, overlong, or unsupported workspace id to a saved-intelligence mutation or workspace-specific read
- **THEN** the API returns `invalid_request`
- **AND** no preference, alert, market, signal, Arc, proof, autonomy, or resolution state is mutated

#### Scenario: Workspace id is not presented as authentication

- **WHEN** saved-intelligence APIs or UI describe local workspace state
- **THEN** they label it as local convenience state rather than login, account security, ownership proof, custody, or cross-device identity
- **AND** no sensitive data, secrets, private runtime diagnostics, or transaction authority is protected only by the workspace id

#### Scenario: Workspace ownership mismatch is hidden

- **WHEN** a client attempts to update, delete, read, or mark a saved filter, watched market, or alert that does not belong to the supplied workspace id
- **THEN** the API returns `not_found` with HTTP `404`
- **AND** the response does not reveal whether the resource exists in another workspace
- **AND** no preference, alert, market, signal, Arc, proof, autonomy, or resolution state is mutated

### Requirement: Saved Intelligence Filters

PredictArena MUST let users save bounded market-intelligence filter presets for repeat research.

#### Scenario: Saved filter is created

- **WHEN** a client creates a saved filter with a valid workspace id, bounded name, and supported `/api/intelligence/markets` query fields
- **THEN** the system persists the saved filter with created and updated timestamps
- **AND** the saved filter contains only allowlisted filter fields, threshold fields, enabled state, and a bounded latest evaluation snapshot

#### Scenario: Saved filter thresholds are validated

- **WHEN** a client creates or updates saved filter alert thresholds
- **THEN** `minOpportunityScoreBps` and `minDataHealthScoreBps` are integers in `[0,10000]`
- **AND** `edgeChangeThresholdBps`, `disagreementChangeThresholdBps`, and `dataHealthDropThresholdBps` are integers in `[100,5000]`
- **AND** `nearExpiryHours` is an integer in `[1,168]`
- **AND** invalid thresholds return `invalid_request` without persisting partial updates

#### Scenario: Saved filter limits are enforced

- **WHEN** a workspace already has the maximum allowed saved filters or sends an overlong name or unsupported query field
- **THEN** the API returns `saved_intelligence_limit_reached` with HTTP `409` for item caps or `invalid_request` with HTTP `400` for invalid shape
- **AND** no partial saved filter is persisted

#### Scenario: Saved filter is evaluated

- **WHEN** saved filters are evaluated against current market intelligence data
- **THEN** the system records a bounded evaluation snapshot with matched count, top safe market ids, top opportunity score, top edge, top data-health score, evaluated timestamp, freshness state, and optional sanitized failure reason
- **AND** the evaluation does not store raw provider payloads or fabricate external context

### Requirement: Intelligence Watchlist

PredictArena MUST let users watch supported public markets for repeat research without creating markets or entering evidence manually.

#### Scenario: Market is added to watchlist

- **WHEN** a client adds a known public intelligence market to the watchlist
- **THEN** the system persists a watch item with safe public market identity, optional bounded label or note, timestamps, and current support state
- **AND** adding a watched market does not create a market, run agents, send a transaction, or mutate signal/resolution state

#### Scenario: Duplicate watched market is handled

- **WHEN** a client adds a market that is already watched by the same workspace
- **THEN** the API returns HTTP `200` with the existing watch item and `duplicate: true`
- **AND** no duplicate watch record is created

#### Scenario: Watched market becomes unavailable

- **WHEN** a watched market expires, disappears from the public source, becomes unsupported, or has degraded data
- **THEN** the watchlist still returns the item with a safe degraded reason
- **AND** the system does not silently delete the user's watch item

### Requirement: Intelligence Alert Evaluation

PredictArena MUST generate deterministic in-app research alerts from saved filters, watched markets, and existing market intelligence read models.

#### Scenario: Alert evaluation creates bounded alerts

- **WHEN** alert evaluation runs for a workspace
- **THEN** the system may create alerts with reason code, severity, source reference, safe market or signal ids, previous and current metric snapshot, deterministic summary, timestamps, and read/dismissed state
- **AND** supported first-version reason codes include `new_high_priority_market`, `edge_changed`, `agent_disagreement_changed`, `data_health_degraded`, and `near_expiry`

#### Scenario: Alert evaluation reports freshness

- **WHEN** alert evaluation completes, has never run, is stale, or fails with a sanitized error
- **THEN** the API returns freshness state as `never_evaluated`, `fresh`, `stale`, or `failed`
- **AND** successful evaluations include `evaluatedAt`, `createdAlertCount`, `suppressedDuplicateCount`, and `updatedSnapshotCount`
- **AND** failed evaluations preserve previous successful snapshots when available and expose only a sanitized reason such as `evaluation_failed` or `saved_intelligence_unavailable`

#### Scenario: Duplicate alerts are suppressed

- **WHEN** alert evaluation observes the same workspace, source, reason code, market, and current metric snapshot as an existing active alert
- **THEN** the system does not create a duplicate unread alert
- **AND** the API returns deterministic evaluation counts

#### Scenario: Alert evaluation remains isolated

- **WHEN** alert evaluation is requested
- **THEN** it does not call Arc commit, proof transaction, Polymarket trading, demo resolution, autonomous run, market mutation, or agent generation paths
- **AND** it does not expose server-only secrets, raw provider diagnostics, or private runtime internals

#### Scenario: Saved-intelligence persistence is isolated

- **WHEN** saved filters, watchlist items, alerts, or daily queue snapshots are persisted
- **THEN** saved-intelligence data is stored in an isolated namespace or subdocument keyed by workspace id
- **AND** existing arena, market, signal, autonomous run, proof, Arc, ops, resolution, claim, lock, and leaderboard state is preserved without semantic changes
- **AND** older local fallback state without saved-intelligence data remains readable

#### Scenario: Alerts are research prompts

- **WHEN** alerts are returned by API or displayed in UI
- **THEN** they use research language such as review, changed, data health, disagreement, or near expiry
- **AND** they do not say buy, sell, trade now, copy, guaranteed, recommended position, or financial advice

### Requirement: Daily Intelligence Queue

PredictArena MUST provide a daily research queue that prioritizes saved-filter matches, watched markets, unread alerts, expiry urgency, and data-health changes.

#### Scenario: Daily queue is retrieved

- **WHEN** a client requests the daily queue for a workspace
- **THEN** the system returns bounded queue items with source type, safe market or signal ids, reason codes, severity, current score snapshot, expiry context, data-health state, freshness state, unread alert references, and deterministic summary
- **AND** each item links back to the existing read-only intelligence research path

#### Scenario: Daily queue has no saved state

- **WHEN** a workspace has no saved filters, watched markets, or alerts
- **THEN** the API returns an empty or onboarding-safe queue response with suggested non-mutating next actions
- **AND** it does not create default watch items, run agents, create markets, or send transactions

#### Scenario: Queue ranking is deterministic

- **WHEN** the same saved state and market intelligence data are used to build the queue
- **THEN** queue order is stable across repeated reads
- **AND** ranking prefers urgent unread alerts, near-expiry watched markets, high opportunity scores, large agent disagreement, and data-health degradation without labeling any item as a trade recommendation
