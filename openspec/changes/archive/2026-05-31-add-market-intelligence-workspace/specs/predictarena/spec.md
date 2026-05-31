## ADDED Requirements

### Requirement: Market Intelligence Read Models

PredictArena MUST expose read-only market intelligence items that help users triage supported prediction markets by opportunity, risk, and data health.

#### Scenario: Ranked intelligence markets are retrieved

- **WHEN** a client requests market intelligence for supported BTC, ETH, or SOL markets
- **THEN** the system returns ranked market intelligence items with market identity, asset, condition type, threshold, expiry, market prices, liquidity, optional spread diagnostics, volatility context, latest agent probabilities, edge, confidence, risk flags, opportunity score, risk score, data health score, and deterministic summary
- **AND** the response does not require manual market creation, manual evidence input, or authenticated Polymarket trading access

#### Scenario: Intelligence data is degraded

- **WHEN** live market, orderbook, candle, or persisted signal data is missing or stale
- **THEN** the system returns available safe fields with explicit data health and degraded-source indicators
- **AND** the system does not fabricate external context or hide missing-data risk

#### Scenario: Intelligence scores are deterministic and bounded

- **WHEN** the same persisted markets, prices, signals, runs, and resolutions are used to build intelligence items
- **THEN** opportunity score, risk score, data health score, and deterministic summary are stable across repeated reads
- **AND** each score is an integer in the inclusive range `[0,10000]`
- **AND** opportunity score is labeled as a research-priority score rather than a buy, sell, trade, or follow recommendation

#### Scenario: Intelligence response is allowlisted

- **WHEN** a public intelligence API returns market intelligence items
- **THEN** the response includes only safe public ids, timestamps, public market fields, public addresses, hashes, transaction hashes, bps metrics, score bps, safe enum reason codes, sanitized summaries, and aggregate counts
- **AND** it does not include `rawPayload`, private keys, service-role keys, cron/proof/admin secrets, lock token or owner, idempotency keys, raw provider/RPC errors, stack-like diagnostics, internal URLs, request headers, server config, or unbounded persisted state blobs

### Requirement: Signal Research Read Model

PredictArena MUST provide deterministic research views that explain market pricing, agent disagreement, risk drivers, and accountability state.

#### Scenario: Signal research is retrieved

- **WHEN** a client requests research for a known signal or market
- **THEN** the response includes implied probability, agent probability, probability gap, volatility and momentum drivers, Market Scout context, CLOB/spread diagnostics when available, Risk Agent timeline, model/data hashes, comparable persisted outcomes when available, and Arc/proof/dry-run/resolution accountability state
- **AND** the explanation is generated from stored fields and public data rather than manual evidence or invented news context

#### Scenario: Research target query is validated

- **WHEN** a client requests signal research with both `signalId` and `marketId`, or with neither field
- **THEN** the API returns `invalid_request`
- **AND** no agent run, market mutation, Arc transaction, proof transaction, or resolution side effect occurs

#### Scenario: Unknown research target is requested

- **WHEN** a client requests research for an unknown signal id or market id
- **THEN** the API returns a controlled not-found or validation response
- **AND** no agent run, market mutation, Arc transaction, or resolution side effect occurs

### Requirement: Segmented Agent Reputation

PredictArena MUST compare agent performance by useful market segments rather than only aggregate totals.

#### Scenario: Segmented reputation is retrieved

- **WHEN** a client requests agent reputation grouped by asset, condition type, expiry bucket, confidence bucket, or edge bucket
- **THEN** the response includes generated count, committed count, resolved count, accuracy, Brier score, average edge, paper ROI when available, bonded USDC, refunded USDC, and slashed USDC for each segment
- **AND** segments with resolved count below the requested `minResolved` threshold, defaulting to `3`, are labeled as insufficient data rather than over-interpreted

#### Scenario: Unsupported segment filter is rejected

- **WHEN** a client requests an unsupported grouping or invalid filter
- **THEN** the API returns a controlled validation error
- **AND** no persisted state is mutated

### Requirement: Paper Follow and Backtest Read Models

PredictArena MUST provide read-only paper-follow results for selected agents or simple strategies using persisted signals and resolutions.

#### Scenario: Paper-follow result is computed

- **WHEN** a client requests a paper-follow result for an agent or strategy with valid filters
- **THEN** the system returns included signal count, skipped signal count, unresolved count, cumulative paper ROI, hit rate, Brier score, average edge, max drawdown, breakdown by asset and condition type, source mix, and explicit strategy assumptions
- **AND** the result is labeled as research/backtest output rather than financial advice or a recommendation to trade

#### Scenario: Paper-follow has insufficient data

- **WHEN** too few matching resolved signals exist
- **THEN** the response indicates insufficient data and still returns the assumptions and skipped/unresolved counts
- **AND** it does not imply statistical confidence that the data cannot support

#### Scenario: Paper-follow remains read-only

- **WHEN** a paper-follow API or UI surface is used
- **THEN** it does not call Arc commit, proof transaction, Polymarket trading, demo resolution, autonomous run, or any other mutation path
- **AND** it does not expose server-only secrets or private runtime diagnostics

## MODIFIED Requirements

### Requirement: Server-Side Arc Commit Flow

PredictArena MUST keep unauthenticated public server-wallet commit paths disabled and MUST execute server-side Arc commits only through explicitly authorized autonomy or proof flows that enforce finite budgets, idempotency, claims, and locks.

#### Scenario: Public commit endpoint is disabled

- **WHEN** a caller invokes `POST /api/commit-signal` as a public unauthenticated spend path
- **THEN** the API rejects the request with a machine-readable reason such as `public_commit_disabled`
- **AND** no Arc approval, Arc commit, private key selection, or signal mutation occurs

#### Scenario: Authorized autonomy or proof commit is executed

- **WHEN** an autonomy or proof flow is explicitly authorized and receives a non-AVOID signal with edge at least 700 bps, medium or high confidence, valid Arc configuration, matching agent wallet key, finite budget allowance, and a durable claim or lock
- **THEN** the server chooses the matching agent private key server-side
- **AND** checks USDC allowance
- **AND** approves USDC if needed
- **AND** calls `SignalBondArena.commitSignal`
- **AND** persists the Arc transaction hash and committed status

#### Scenario: Ineligible or unsafe commit is rejected

- **WHEN** the signal is AVOID, low edge, low confidence, missing contract address, missing agent wallet key, over budget, duplicate claimed, locked, already committed, or outside authorized autonomy/proof context
- **THEN** the API or service rejects the commit request with a clear machine-readable reason
- **AND** no duplicate Arc approval or commit transaction is attempted

#### Scenario: Agent private keys remain server-only

- **WHEN** commit configuration is loaded or commit-related APIs respond
- **THEN** `VOL_AGENT_PRIVATE_KEY`, `MOMENTUM_AGENT_PRIVATE_KEY`, and `ADMIN_PRIVATE_KEY` are never exposed in client bundles, public API JSON, snapshots, README examples, or UI-rendered state

#### Scenario: Admin private key is not used for demo resolve

- **WHEN** `POST /api/resolve-demo` or `POST /api/admin/resolve-demo` is called
- **THEN** authorization is based on `ADMIN_RESOLVE_TOKEN`
- **AND** `ADMIN_PRIVATE_KEY` is not required for this route and is reserved for deployment or explicit onchain owner/admin operations
