# predictarena · Spec Delta

## ADDED Requirements

### Requirement: Agent Showdown Lifecycle

When two autonomous forecasting agents hold opposing positions (YES vs NO) on the same prediction market, the system SHALL detect the disagreement and stage an on-chain Showdown where both agents commit equal USDC bonds on Arc Testnet; the winner — determined by the existing resolution engine when the market resolves — takes both bonds.

#### Scenario: Two agents disagree on a market

- **WHEN** Volatility Agent emits a YES signal on market M with probability p_a, and Momentum Agent emits a NO signal on the same market M with probability p_b
- **THEN** the system SHALL select the disagreeing pair with the largest |p_a − p_b| as the Showdown candidate for market M (deterministic tie-break by lexicographic agent address)
- **AND** the system SHALL invoke `ShowdownArena.openShowdown(...)` in a single atomic transaction that pulls `bondPerSideMicroUsdc` from each agent's USDC allowance
- **AND** the system SHALL persist a `ShowdownRecord` with `status='Open'`, the opening tx hash, both agent positions, and the deadline

#### Scenario: Showdown opens deduplication

- **WHEN** discovery runs and a Showdown is already Open for the same `(marketId, agentA, agentB)` pair
- **THEN** the system SHALL skip opening a second Showdown and record skip reason `existing-open`

#### Scenario: Showdown settlement at deadline

- **WHEN** an Open Showdown's deadline has passed AND the resolution engine returns a definitive YES/NO outcome for the market
- **THEN** the system SHALL compute `agentAWins = (outcomeYes == sideAYes)` per the spec's §4.5.3 mapping
- **AND** the system SHALL call `ShowdownArena.settleShowdown(onchainId, agentAWins)` which transfers `bondPerSideMicroUsdc * 2` to the winner
- **AND** the system SHALL update the persisted record's status to `SettledA` or `SettledB` with `settleTxHash`, `resolvedOutcome`, and `resolvedPriceLabel`

#### Scenario: Showdown stuck >24h

- **WHEN** an Open Showdown's deadline has passed by more than 24 hours AND the resolution engine still returns null
- **THEN** the system SHALL log a stuck warning surfaced via the Operator Health read model
- **AND** the system SHALL continue retrying each cron cycle without altering the on-chain state

### Requirement: ShowdownArena Smart Contract

The system SHALL include a new on-chain contract `ShowdownArena` on Arc Testnet that supports atomic showdown opening (operator-orchestrated, single transaction with both agent transferFrom calls) and operator-authorized settlement; no Pending or Cancelled state exists in the lifecycle.

#### Scenario: openShowdown atomicity on failure

- **WHEN** `openShowdown` is called and either agent's USDC `transferFrom` reverts
- **THEN** the entire transaction SHALL revert
- **AND** no `Showdown` storage entry SHALL be written
- **AND** the `externalId → showdownId` mapping SHALL remain at zero
- **AND** `showdownCount` SHALL not be incremented

#### Scenario: Duplicate externalId rejected

- **WHEN** `openShowdown` is called with an `externalId` that was used previously
- **THEN** the transaction SHALL revert with `"external id reused"`

#### Scenario: settleShowdown only on Open status

- **WHEN** `settleShowdown` is called on a Showdown whose status is not `Open`
- **THEN** the transaction SHALL revert with `"not open"`

#### Scenario: Only owner may mutate

- **WHEN** `openShowdown` or `settleShowdown` is called by an address other than the contract `owner`
- **THEN** the transaction SHALL revert with `"Ownable: caller is not the owner"`

### Requirement: Showdown Discovery and Commit Orchestration

The system SHALL discover Showdown candidates server-side by scanning active signals after agent-run workflows and during explicit operator override cycles, validate budget and operator-gas constraints, generate a deterministic `externalId`, and invoke the contract's `openShowdown`. Discovery SHALL be idempotent per `(marketId, agentA, agentB)` pair via the `ShowdownStore.hasOpenBetween` check and per the contract's `externalIdToId` mapping. Only `source='live'` signals are eligible for on-chain opening; `demo_snapshot` signals SHALL be ignored by discovery. User-triggered `POST /api/run-agents` calls SHALL save the generated signals, then automatically attempt Showdown discovery with the same budget, gas, and idempotency safeguards used by cron/admin discovery.

#### Scenario: Discovery automatically follows user agent runs

- **WHEN** a visitor triggers `POST /api/run-agents` and the agent run saves fresh signals
- **THEN** the route SHALL invoke `discoverShowdowns` with default deps
- **AND** the response SHALL include a `showdowns.discovery` summary with status, result, and/or safe reason code
- **AND** discovery errors SHALL be caught and SHALL NOT fail the agent-run response
- **AND** the response SHALL NOT expose private keys, admin tokens, or raw secret values

#### Scenario: Discovery triggered by cron

- **WHEN** the cron route `app/api/cron/run-autonomous-agents/route.ts` completes the agent run step
- **THEN** the system SHALL invoke `discoverShowdowns` with default deps (real persistence, viem clients, agent budget readers)
- **AND** errors SHALL be caught and logged without aborting the cron cycle

#### Scenario: Discovery triggered by admin operator override

- **WHEN** an authenticated admin operator triggers `POST /api/showdowns/discover`
- **THEN** the system SHALL invoke `discoverShowdowns` with default deps
- **AND** return discovered/opened/skipped counts and skip reasons without exposing private keys or admin tokens
- **AND** this action SHALL remain an override/diagnostic path rather than a required step in the normal visitor flow

#### Scenario: Demo snapshot signals never open on-chain showdowns

- **WHEN** discovery scans active signals and a candidate is sourced from `demo_snapshot`
- **THEN** the system SHALL treat that signal as ineligible for `openShowdown`
- **AND** if no live opposing pair remains after filtering, the run SHALL return a no-candidate style skip instead of opening an on-chain Showdown

#### Scenario: Demo snapshot disagreement may produce preview candidates only

- **WHEN** a visitor-triggered agent run returns opposing `demo_snapshot` signals for the same market
- **THEN** the client MAY derive an in-memory preview Showdown candidate from those signals
- **AND** the preview candidate SHALL NOT be inserted into `ShowdownStore`
- **AND** the preview candidate SHALL NOT call `ShowdownArena.openShowdown`
- **AND** the preview candidate SHALL be labeled as not on-chain and SHALL NOT count toward active, settled, bonded, or won Showdown metrics

#### Scenario: Demo snapshot near-miss previews remain off-chain

- **WHEN** a visitor-triggered agent run returns same-market `demo_snapshot` signals that do not form an opposing YES/NO pair
- **THEN** the client MAY derive an in-memory near-miss preview from those signals
- **AND** the near-miss preview SHALL NOT be inserted into `ShowdownStore`
- **AND** the near-miss preview SHALL NOT call `ShowdownArena.openShowdown`
- **AND** the near-miss preview SHALL be labeled as not eligible for an on-chain Showdown yet

#### Scenario: Insufficient agent budget

- **WHEN** discovery selects a pair but either agent's remaining daily budget is less than `bondPerSideMicroUsdc`
- **THEN** the system SHALL skip the pair and record skip reason `budget-exhausted`

#### Scenario: Operator wallet low on gas

- **WHEN** discovery runs and the operator wallet's ETH balance falls below the configured threshold
- **THEN** the system SHALL skip all discovery and return early with skip reason `operator-gas-low`

### Requirement: Wallet-Bound Data Aggregation

The system SHALL aggregate per-wallet data (follows, USDC balance, USDC allowance, tx history, cumulative bonded, cumulative payout, current PnL) into a single `WalletSummary` shape served by `GET /api/wallet/[address]/summary`. The implementation SHALL derive market/side/status/resolution fields for each follow by joining against the persisted `AgentSignal` records — it MUST NOT extend the `WalletFollowRecord` schema.

#### Scenario: Wallet address lowercased and validated

- **WHEN** a request hits `GET /api/wallet/[address]/summary` with `address` matching `/^0x[a-fA-F0-9]{40}$/`
- **THEN** the system SHALL normalize `address` to lowercase
- **AND** the system SHALL return all follow records whose `walletAddress` (lowercased) equals the normalized address, ordered by `followedAt` desc

#### Scenario: Invalid address format

- **WHEN** the path `address` segment does not match the 40-hex-after-0x pattern
- **THEN** the system SHALL respond with HTTP 400 and `{ error: 'invalid address' }`

#### Scenario: Bigint values serialized as decimal strings

- **WHEN** the endpoint serializes `usdcBalanceMicro`, `usdcAllowanceMicro`, `cumulativeBondedMicro`, `cumulativePayoutMicro`, `currentNetPnlMicro`, or any follow's `bondedMicroUsdc` / `payoutMicroUsdc`
- **THEN** the value SHALL be returned as a base-10 decimal string (not a JSON number) to preserve precision

#### Scenario: Persisted wallet follow receipt status

- **WHEN** a `WalletFollowRecord` exists for the requested wallet because `/api/wallet/follows` verified and persisted the on-chain receipt
- **THEN** the wallet summary SHALL report the follow as `confirmed` unless the joined signal has a resolution
- **AND** if the joined signal has a resolution, the wallet summary SHALL report `resolved-win` or `resolved-loss` from that resolution
- **AND** the status SHALL NOT remain `pending` merely because the joined signal itself is still `generated`

## MODIFIED Requirements

### Requirement: Arena, Signal Detail, and Leaderboard UI

The `/arena` route SHALL render a Showdown-centric Glass Neon layout: a `ShowdownGrid` listing active Showdowns above settled Showdowns, with the optional `PendingFollowsRow` chip strip shown only when a wallet is connected. The Market Radar, Watchlist, Saved Filters, Alert Center, Paper Follow card, and Daily Queue entries SHALL be removed from this route; their underlying read models SHALL remain available for admin or future use.

The Leaderboard view SHALL move to `/agents` (list + per-agent drill-down). The Signal Detail view SHALL remain reachable as a sub-route under `/agents/[agentId]` showing the agent's signal history.

#### Scenario: Arena renders showdown grid

- **WHEN** a visitor opens `/arena`
- **THEN** the page SHALL fetch `/api/showdowns?status=all&limit=50` client-side
- **AND** render a `ShowdownGrid` with up to 5 active and 5 settled (with Show more) Showdown cards
- **AND** NOT render any Intelligence, Watchlist, Saved Filter, Alert, Paper Follow, or Daily Queue UI

#### Scenario: Connected wallet shows pending follows

- **WHEN** the visitor has connected a wallet (`predictarena.walletSession` is present) AND has at least one signal follow in `pending` or `confirmed` state
- **THEN** the page SHALL render a `PendingFollowsRow` chip strip at the top of the dashboard with up to 3 chips linking to `/my`

### Requirement: Non-Polymarket-Clone User Flow

The system's user flows SHALL be designed for **showcase consumption** — Arc builder reviewers reading the homepage in under 30 seconds — and SHALL NOT replicate a Polymarket trading client. The homepage SHALL communicate the project's value (AI agents bet on Arc with proof) within one viewport-height before any data or interactivity is required.

#### Scenario: Showcase user opens the homepage

- **WHEN** a first-time visitor lands on `/`
- **THEN** the page SHALL render the Editorial-style hero with locked statement "AI agents, betting with proof."
- **AND** display 4 KPI cells (Active Signals, USDC Bonded, Agent Accuracy, Showdowns Won) and a two-column narrative (The Premise, How to Watch) within the first scroll
- **AND** the homepage SHALL NOT require wallet connection to display any of the above content

## REMOVED Requirements

### Requirement: Local Intelligence Workspace Identity

**Reason**: The Intelligence research workspace is removed from public UI; identity tracking for that workspace is no longer required.
**Migration**: Backend code that uses workspace identity may continue to compile but is unreachable from the public site. Operators may revive an admin-only workspace in a future change.

### Requirement: Saved Intelligence Filters

**Reason**: `/intelligence` route deleted; no UI to save filters from.
**Migration**: Persistence schema for saved filters MAY remain as dead code; future admin work may reuse.

### Requirement: Intelligence Watchlist

**Reason**: `/intelligence` route deleted; no UI to manage watchlist.
**Migration**: Same as Saved Intelligence Filters.

### Requirement: Intelligence Alert Evaluation

**Reason**: Alert Center UI removed; no surface to evaluate alerts against.
**Migration**: Backend evaluation logic MAY remain unused; future admin work may reuse.

### Requirement: Daily Intelligence Queue

**Reason**: Daily Research Queue UI removed; no surface to render the queue.
**Migration**: Backend read model MAY remain; future admin work may reuse.
