# predictarena Specification

## Purpose
TBD - created by archiving change update-predictarena-mvp-to-current-spec. Update Purpose after archive.
## Requirements
### Requirement: Autonomous Polymarket Market Scanner

PredictArena MUST fetch active, non-closed Polymarket public markets without requiring Polymarket authentication, manual market creation, or manual prediction-question entry.

#### Scenario: Active markets are scanned from Gamma

- **WHEN** `GET /api/markets` runs and Polymarket Gamma is reachable
- **THEN** the system fetches public markets or events with active and non-closed filters
- **AND** normalizes binary YES/NO candidates with outcomes, outcome prices, liquidity, volume, end date, optional CLOB token ids, and raw payload

#### Scenario: Demo snapshot fallback is used

- **WHEN** live fetching fails or yields no parseable candidates and `ALLOW_DEMO_SNAPSHOT=true`
- **THEN** the system returns snapshot candidates
- **AND** the response identifies the source as `demo_snapshot`

### Requirement: Crypto Price Market Parsing

PredictArena MUST parse only BTC, ETH, and SOL crypto price markets using deterministic parser rules and MUST reject unsupported or ambiguous markets automatically.

#### Scenario: Supported price market is parsed

- **WHEN** a binary YES/NO market question includes a supported asset alias, threshold, condition phrase, and valid end date within 21 days
- **THEN** the parser returns `ParsedCryptoMarket` with asset, condition type, threshold, expiry, yes meaning, and parse confidence at least 0.7

#### Scenario: Unsupported market is rejected

- **WHEN** a market has no supported asset, no threshold, no end date, expired end date, expiry more than 21 days away, non-binary outcomes, or parse confidence below 0.7
- **THEN** the parser rejects it without asking the user for correction

### Requirement: Market Scout Candidate Ranking

PredictArena MUST filter and rank parseable market candidates before agent analysis.

#### Scenario: Candidates are filtered and ranked

- **WHEN** market candidates are normalized and parsed
- **THEN** the system keeps only active, non-closed, binary YES/NO markets with YES price between 0.05 and 0.95 and expiry within 21 days
- **AND** it ranks up to 20 candidates using liquidity, uncertainty near 0.5 price, time to expiry, volume, and parse confidence

#### Scenario: Low liquidity is flagged

- **WHEN** liquidity is missing or below 100 but other required filters pass
- **THEN** the candidate may remain eligible for analysis
- **AND** generated signals include a liquidity risk flag

### Requirement: Public Crypto Candle and Volatility Features

PredictArena MUST fetch or derive BTC, ETH, and SOL candle features from public OHLC providers and compute bounded realized volatility.

#### Scenario: Live candles are used

- **WHEN** a supported asset needs price features and a public Coinbase or Binance candle endpoint is available
- **THEN** the system normalizes candles to USD or USDT quotes
- **AND** computes current price, 7-day annualized volatility, 30-day annualized volatility, and blended volatility clamped to [0.10, 2.50]

#### Scenario: Snapshot candles are used

- **WHEN** live candle fetching is unavailable and demo snapshots are allowed
- **THEN** the system uses snapshot candles for BTC, ETH, and SOL
- **AND** labels the run data source accordingly

### Requirement: Monte Carlo Probability Engine

PredictArena MUST implement a deterministic seeded Monte Carlo GBM engine for expiry and touch conditions.

#### Scenario: Probability is simulated

- **WHEN** the engine receives current price, threshold, years to expiry, volatility, drift, condition type, path count, step count, and seed
- **THEN** it returns a YES probability for `EXPIRY_ABOVE`, `EXPIRY_BELOW`, `TOUCH_ABOVE`, or `TOUCH_BELOW`
- **AND** repeated calls with the same seed and inputs produce stable results

#### Scenario: Touch probability dominates expiry probability

- **WHEN** the same above-threshold market is evaluated as both touch-above and expiry-above with identical model inputs
- **THEN** the touch-above probability is greater than or equal to the expiry-above probability

### Requirement: Autonomous Forecasting Agents

PredictArena MUST run Volatility Agent and Momentum Agent to generate quantified signals, then apply Risk Agent gates before commitment eligibility.

#### Scenario: Agents generate signals

- **WHEN** `POST /api/run-agents` is called with a candidate limit
- **THEN** Volatility Agent uses zero drift with model version `volatility-gbm-v1`
- **AND** Momentum Agent uses bounded 7-day return drift with model version `momentum-gbm-v1`
- **AND** each agent emits `AgentSignal` fields including side, market price bps, agent probability bps, edge bps, Kelly bps, stake amount, confidence, risk flags, model hash, data hash, and status

#### Scenario: Risk Agent avoids weak signals

- **WHEN** parse confidence, liquidity, price range, expiry, spread, edge, volatility, current price, or threshold sanity checks fail
- **THEN** Risk Agent marks the signal as AVOID or attaches risk flags
- **AND** AVOID signals are not eligible for Arc commitment

### Requirement: Signal Decision, Kelly, Stake, and Confidence

PredictArena MUST calculate signal side, edge, Kelly sizing, stake amount, and confidence using the specified bps rules.

#### Scenario: YES signal is selected

- **WHEN** `pYesBps - yesPriceBps >= 700`
- **THEN** the signal side is YES
- **AND** edge, market price, agent probability, capped Kelly, stake, and confidence are computed from the selected YES side

#### Scenario: NO signal is selected

- **WHEN** `yesPriceBps - pYesBps >= 700`
- **THEN** the signal side is NO
- **AND** edge, market price, agent probability, capped Kelly, stake, and confidence are computed from the selected NO side

#### Scenario: AVOID signal is selected

- **WHEN** neither YES nor NO edge reaches 700 bps
- **THEN** the signal side is AVOID
- **AND** Kelly and stake are zero

### Requirement: Optional Supabase Persistence with Local Fallback

PredictArena MUST persist markets, runs, signals, commits, leaderboard state, and demo resolution data using Supabase when configured and local fallback otherwise.

#### Scenario: Supabase is configured

- **WHEN** `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present on the server
- **THEN** the server persistence layer uses Supabase for reads and writes
- **AND** no Supabase service-role key is exposed to the client

#### Scenario: Supabase is not configured

- **WHEN** Supabase environment variables are absent
- **THEN** the system uses local JSON persistence with in-memory fallback
- **AND** the app remains runnable locally without Supabase

### Requirement: Tailwind UI and Zod Validation Boundaries

PredictArena MUST use Tailwind for application UI styling and zod for critical server-side validation boundaries.

#### Scenario: UI uses Tailwind

- **WHEN** arena, signal detail, and leaderboard UI surfaces are implemented
- **THEN** styling is expressed through Tailwind classes and project globals
- **AND** the MVP does not require a separate non-Tailwind component framework

#### Scenario: API and environment inputs are validated

- **WHEN** server code reads environment configuration or receives API request bodies for running agents, committing signals, or resolving demo signals
- **THEN** zod schemas validate the input shape
- **AND** invalid input returns a controlled error rather than executing agent, commit, or resolve side effects

### Requirement: Arc Testnet Signal Bond Contract

PredictArena MUST provide a `SignalBondArena` contract on Arc Testnet that records agent conviction using USDC ERC-20 signal bonds.

#### Scenario: Signal is committed

- **WHEN** an agent wallet calls `commitSignal` with valid signal fields and has approved sufficient USDC
- **THEN** the contract transfers USDC from the agent with `transferFrom`
- **AND** stores the signal
- **AND** emits `SignalCommitted`

#### Scenario: Signal is resolved correct

- **WHEN** the owner resolves a committed signal as correct
- **THEN** the stake is refunded to the agent
- **AND** `SignalResolved` is emitted

#### Scenario: Signal is resolved incorrect

- **WHEN** the owner resolves a committed signal as incorrect
- **THEN** the stake is sent to treasury or retained according to the implemented simple slash behavior
- **AND** `SignalResolved` is emitted

#### Scenario: Non-owner cannot resolve

- **WHEN** an address other than owner calls `resolveSignal`
- **THEN** the transaction reverts

### Requirement: Server-Side Arc Commit Flow

PredictArena MUST commit eligible signals through server-side viem code using testnet-only agent private keys from environment variables.

#### Scenario: Eligible signal is committed

- **WHEN** `POST /api/commit-signal` receives a non-AVOID signal with edge at least 700 bps and medium or high confidence
- **THEN** the server chooses the matching agent private key
- **AND** checks USDC allowance
- **AND** approves USDC if needed
- **AND** calls `SignalBondArena.commitSignal`
- **AND** persists the Arc transaction hash and committed status

#### Scenario: Ineligible signal is rejected

- **WHEN** the signal is AVOID, low edge, low confidence, missing contract address, or missing agent wallet key
- **THEN** the API rejects the commit request with a clear machine-readable reason

#### Scenario: Agent private keys remain server-only

- **WHEN** commit configuration is loaded or commit APIs respond
- **THEN** `VOL_AGENT_PRIVATE_KEY`, `MOMENTUM_AGENT_PRIVATE_KEY`, and `ADMIN_PRIVATE_KEY` are never exposed in client bundles, public API JSON, snapshots, README examples, or UI-rendered state

#### Scenario: Admin private key is not used for demo resolve

- **WHEN** `POST /api/resolve-demo` is called
- **THEN** authorization is based on `ADMIN_RESOLVE_TOKEN`
- **AND** `ADMIN_PRIVATE_KEY` is not required for this route and is reserved for deployment or explicit onchain owner/admin operations

### Requirement: Admin-Only Demo Resolution

PredictArena MUST restrict demo resolution to server-side admin-token protected API calls and MUST NOT present demo resolution as a decentralized oracle.

#### Scenario: Demo resolve requires admin token

- **WHEN** `POST /api/resolve-demo` is called without the configured `ADMIN_RESOLVE_TOKEN` or with an invalid token
- **THEN** the API rejects the request
- **AND** no signal resolution state or onchain resolution side effect occurs

#### Scenario: Demo resolve updates demo state

- **WHEN** `POST /api/resolve-demo` is called with the configured admin token and valid signal result payload
- **THEN** the API updates the selected demo signal resolution state
- **AND** the UI and README label this as demo/admin resolution rather than decentralized oracle behavior

### Requirement: Arena, Signal Detail, and Leaderboard UI

PredictArena MUST expose an arena dashboard, signal detail page, and leaderboard that demonstrate autonomous agent decisions and Arc commitments.

#### Scenario: Arena loads without manual input

- **WHEN** the user opens `/arena`
- **THEN** the page shows PredictArena branding, subtitle, metrics strip, Run Agents button, Commit Eligible Signals button, Market Radar, and Signal Cards
- **AND** no textarea, manual evidence input, manual market creation, or manual question input exists

#### Scenario: Signal card displays decision data

- **WHEN** signals exist
- **THEN** each signal card displays market question, asset, threshold, expiry, agent name, YES market price, agent probability, side, edge, capped Kelly, stake, risk flags, confidence, status, and Arc transaction link when committed

#### Scenario: Signal detail displays deterministic audit data

- **WHEN** the user opens `/signals/[id]` for a persisted signal
- **THEN** the page displays all signal fields, model parameters, model hash, data hash, Arc transaction link when committed, market link when available, and a deterministic explanation generated from stored fields
- **AND** the page does not include manual evidence input or editable forecast controls

#### Scenario: Leaderboard updates after commit

- **WHEN** a signal is committed
- **THEN** `/leaderboard` reflects generated signals, committed signals, total bonded USDC, refunded/slashed totals when resolved, average edge, paper ROI if available, Brier score for resolved/demo signals, and confidence distribution

### Requirement: Documentation, Environment, and Disclaimers

PredictArena MUST document setup, deployment, testnet-only boundaries, and demo flow.

#### Scenario: Environment template is provided

- **WHEN** a developer opens `.env.example`
- **THEN** it lists the requested app, Arc, Supabase, snapshot, admin resolve, and agent private key variables without real secrets
- **AND** secret variables are not prefixed with `NEXT_PUBLIC_`

#### Scenario: README documents safe demo usage

- **WHEN** a developer reads `README.md`
- **THEN** it explains project purpose, hackathon fit, architecture, setup, contract deployment, agent wallet funding, local run, Vercel deployment, no-financial-advice disclaimer, no-real-Polymarket-trading disclaimer, and the provided demo script

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

### Requirement: Autonomous Market Discovery

The application MUST fetch active Polymarket public market data automatically when the user opens the app or triggers a scan, without requiring manual market creation or manual prediction-question entry.

#### Scenario: Live scan uses public Polymarket data

- **WHEN** the scan route runs and Polymarket public data is reachable
- **THEN** the application fetches active public markets from Polymarket
- **AND** records total markets scanned, parsed markets, skipped markets, and scan source as live

#### Scenario: No manual question entry is present

- **WHEN** the user views the application
- **THEN** there is no user-facing control for creating a prediction question or manually adding a market

### Requirement: Crypto Price Market Filtering

The application MUST support only confidently parseable BTC, ETH, and SOL crypto price markets for the MVP and MUST skip unsupported or ambiguous markets automatically.

#### Scenario: Supported crypto price market is parsed

- **WHEN** a market question identifies exactly one of BTC, ETH, or SOL and a price threshold
- **THEN** the parser stores the asset, threshold, deadline, Polymarket identifiers, YES/NO prices, and parse confidence

#### Scenario: Ambiguous market is skipped

- **WHEN** a market question cannot be parsed confidently as a BTC, ETH, or SOL price market
- **THEN** the application skips it automatically
- **AND** records a skip reason instead of asking the user for clarification

### Requirement: Demo Snapshot Fallback

The application MUST still demo if live Polymarket fetching or parsing yields no usable markets by falling back to a preloaded dataset clearly labeled "demo snapshot".

#### Scenario: Live data yields no parseable markets

- **WHEN** live scanning completes with zero confidently parseable markets
- **THEN** the application loads the preloaded snapshot dataset
- **AND** labels the scan source and UI as "demo snapshot"

#### Scenario: Polymarket fetch fails

- **WHEN** the Polymarket fetch adapter returns an error
- **THEN** the application loads the preloaded snapshot dataset
- **AND** records the fallback reason for display

### Requirement: Forecasting Agent Arena

The application MUST run Volatility Agent, Momentum Agent, and Risk Agent to generate BUY_YES, BUY_NO, or AVOID signals from parsed market and price data.

#### Scenario: User runs agents

- **WHEN** the user clicks "Run Agents"
- **THEN** Volatility Agent and Momentum Agent produce probabilities and reasons
- **AND** Risk Agent produces the final BUY_YES, BUY_NO, or AVOID decision
- **AND** the application stores agent forecasts and generated signals

#### Scenario: Weak signal is avoided

- **WHEN** forecast confidence, liquidity, expiry, or edge is below MVP thresholds
- **THEN** Risk Agent outputs AVOID
- **AND** the signal is not eligible for Arc commitment

### Requirement: Arc USDC Signal Bonds

The application MUST support committing eligible high-conviction signals to Arc Testnet using the Arc USDC ERC-20 interface as a signal bond.

#### Scenario: Eligible signal is committed

- **WHEN** a signal is eligible and Arc commit configuration is available
- **THEN** the server approves USDC if needed, calls the signal-bond vault, stores the Arc transaction hash, and displays the hash with signal details

#### Scenario: Ineligible signal is not committed

- **WHEN** a signal decision is AVOID or below commitment thresholds
- **THEN** the application prevents commitment
- **AND** displays the reason the signal is not eligible

### Requirement: Non-Polymarket-Clone User Flow

The application MUST present an autonomous agent arena dashboard rather than a Polymarket clone, AMM, or trading interface.

#### Scenario: Dashboard metrics are shown

- **WHEN** the user opens the app after a scan or agent run
- **THEN** the dashboard shows total markets scanned, signals generated, signals committed, USDC bonded, and agent scores

#### Scenario: Manual evidence input is absent

- **WHEN** the user views the application
- **THEN** there is no manual evidence textarea and no requirement to paste news, tweets, or market context

### Requirement: Autonomous Agent Policy

PredictArena MUST define an `AgentPolicy` model for every autonomous agent and MUST NOT allow unlimited autonomous spend.

#### Scenario: Policy has finite budget limits

- **WHEN** an autonomous run evaluates a signal for an agent
- **THEN** that agent has a policy with mode `OFF`, `DRY_RUN`, or `LIVE`
- **AND** the policy includes finite `maxDailyBondUsdc6`, `maxSignalsPerDay`, `maxStakePerSignalUsdc6`, `maxOpenSignals`, and `minEdgeBps`

#### Scenario: Missing or unsafe LIVE budgets are rejected

- **WHEN** a policy is configured for `LIVE`
- **THEN** missing, negative, non-finite, or unlimited spend limits are rejected before any chain transaction

### Requirement: Autonomous Cron Runner

PredictArena MUST expose a secured cron runner that can run agents without user interaction.

#### Scenario: Cron endpoint rejects unauthorized requests

- **WHEN** `/api/cron/run-autonomous-agents` is called without `Authorization: Bearer <CRON_SECRET>` or with the wrong secret
- **THEN** the request is rejected
- **AND** no market scan, agent run, dry-run signal, or chain transaction is executed

#### Scenario: Dry-run mode persists signals without chain transactions

- **WHEN** the cron runner executes for an agent with mode `DRY_RUN`
- **THEN** it fetches markets, runs agents, applies Risk Agent output, checks budgets, and persists dry-run queue outcomes
- **AND** it does not call Arc approval or commit functions

#### Scenario: Live mode commits only eligible signals

- **WHEN** the cron runner executes for an agent with mode `LIVE`
- **THEN** it commits only medium/high confidence non-AVOID signals that satisfy Risk Agent and all per-agent policy budgets
- **AND** it records skipped reasons for low confidence, low edge, excessive stake, max daily spend, max daily signals, max open signals, mode off, and commit failures

### Requirement: Autonomous Run History

PredictArena MUST persist autonomous run history for UI and audit review.

#### Scenario: Run history is available

- **WHEN** an autonomous run completes
- **THEN** the store persists run id, mode summary, generated signal count, dry-run count, committed count, skipped count, commit queue rows, budget snapshots, started time, completed time, and source
- **AND** `/arena` can render recent autonomous runs without requiring a new run

### Requirement: Arc Readiness and Chain Sync

PredictArena MUST expose public Arc readiness and optional onchain synchronization without leaking secrets.

#### Scenario: Control room shows public readiness

- **WHEN** Arc config and agent keys are present
- **THEN** the server exposes contract address, Arc chain id, agent wallet public addresses, USDC balances, allowances, latest known tx, and commit availability
- **AND** private keys and `CRON_SECRET` are never returned

#### Scenario: Onchain leaderboard sync degrades safely

- **WHEN** onchain event/getter sync cannot run because RPC or contract config is missing
- **THEN** the API returns a degraded sync status
- **AND** the local leaderboard remains available from persisted state

### Requirement: Demo Resolution Command

PredictArena MUST provide a demo/admin resolution command path that closes the prediction -> bond -> settlement -> reputation loop without claiming decentralized oracle behavior.

#### Scenario: Admin demo resolution updates reputation

- **WHEN** an authorized admin marks a signal correct or incorrect
- **THEN** the selected signal resolution state is persisted
- **AND** leaderboard refunded/slashed/Brier score state updates
- **AND** the UI labels this as demo/admin settlement

### Requirement: CLOB Spread Risk Signal

PredictArena MUST inspect public orderbook spread when a market has CLOB token ids and expose the result as a risk diagnostic.

#### Scenario: Spread is available

- **WHEN** a parsed market has CLOB token ids and public orderbook data is reachable
- **THEN** the system computes spread, midpoint, and liquidity risk metadata
- **AND** Decision Trace and Risk Agent diagnostics can show that metadata

#### Scenario: Spread is unavailable

- **WHEN** public orderbook data is missing or unreachable
- **THEN** autonomous runs continue
- **AND** the signal records a degraded spread diagnostic rather than failing the run

### Requirement: Autonomous Run Receipt Read Model

PredictArena MUST expose an auditable receipt for each persisted autonomous run without requiring user interaction or exposing server secrets.

#### Scenario: Autonomous run receipt is retrieved

- **WHEN** a client requests the receipt for a persisted autonomous run
- **THEN** the response includes run id, source, timing, market count, generated signal count, mode by agent, queue outcomes, budget snapshots, related signal ids, confidence, edge, stake, model hash, data hash, policy decision, failure reason, and tx hash when present
- **AND** the response does not expose `CRON_SECRET`, Supabase service role keys, agent private keys, or admin private keys

#### Scenario: Unknown run receipt is requested

- **WHEN** a client requests a receipt for an unknown autonomous run id
- **THEN** the API returns a controlled not-found response without creating state or running agents

### Requirement: Agent Reputation Profile Read Model

PredictArena MUST expose per-agent reputation profiles derived from persisted generated, committed, and resolved signals.

#### Scenario: Agent reputation is retrieved

- **WHEN** a client requests the reputation profile for Volatility Agent or Momentum Agent
- **THEN** the response includes generated, committed, open, resolved, accuracy, average edge, bonded/refunded/slashed USDC, paper ROI, Brier score, confidence distribution, recent signals, and best/worst resolved signals when available

#### Scenario: Unsupported agent profile is requested

- **WHEN** a client requests a profile for an unsupported agent name
- **THEN** the API returns a controlled validation error

### Requirement: Resolution Demo Script Read Model

PredictArena MUST provide a guided demo script read model for settlement demonstrations while preserving admin-token authorization for mutations.

#### Scenario: Demo script data is retrieved

- **WHEN** a client opens the demo script surface
- **THEN** the system returns eligible committed unresolved signals, recent resolved signals, leaderboard summary, and settlement guidance
- **AND** the response labels settlement as demo/admin flow rather than an oracle

#### Scenario: Demo settlement mutation remains protected

- **WHEN** a demo script user attempts to mark a signal correct or incorrect
- **THEN** the existing server-side admin token authorization is required before resolution state changes

### Requirement: Cron Idempotency and Autonomous Run Locking

PredictArena MUST prevent duplicate autonomous commit side effects from scheduler retries or overlapping cron invocations.

#### Scenario: Run acquisition is atomic

- **WHEN** concurrent cron requests attempt to start the same idempotency key or schedule-window id
- **THEN** exactly one request acquires the run and lock through an atomic first-writer-wins operation
- **AND** all other requests return the existing run or in-progress state
- **AND** the non-winning requests perform no market fetch, agent run, Arc approval, or Arc commit side effect

#### Scenario: Same idempotency key or schedule window is retried

- **WHEN** the cron endpoint receives a retry with the same idempotency key or the same UTC schedule-window id as an existing autonomous run
- **THEN** the system returns the existing run or in-progress state
- **AND** it does not re-run commits or duplicate signal bonds for that key

#### Scenario: Different cron run arrives while lock is active

- **WHEN** a cron request arrives while a non-expired autonomous run lock is active
- **THEN** the system returns a controlled locked response
- **AND** no market fetch, agent run, Arc approval, or Arc commit side effect occurs

#### Scenario: Commit succeeds but finalize fails

- **WHEN** an autonomous run created a durable commit claim before attempting an Arc transaction
- **AND** the process crashes or fails before final run persistence
- **THEN** a retry MUST NOT submit a second Arc transaction for the same signal
- **AND** operator health reports an uncertain claim requiring reconciliation before that signal can be retried

#### Scenario: Lock expires after failed run

- **WHEN** a previous lock has expired after a failed or interrupted run
- **THEN** a new cron request may acquire the lock
- **AND** the previous failure remains visible in operator health state
- **AND** signals with successful, pending, or uncertain commit claims remain blocked from duplicate commit attempts

### Requirement: Live Arc Smoke Proof Mode

PredictArena MUST provide a safe proof mode for demonstrating Arc readiness and, when explicitly authorized, committing one bounded existing signal.

#### Scenario: Read-only smoke runs

- **WHEN** the proof smoke read endpoint is called
- **THEN** it reports chain id, contract configuration, public agent wallet addresses, USDC balance, allowance, latest tx, and commit preconditions
- **AND** it does not send Arc transactions or expose secrets

#### Scenario: Transactional smoke is authorized

- **WHEN** a caller provides the configured proof secret, an explicit existing signal id, and an explicit transactional intent
- **THEN** the system may commit that signal only if it is eligible, uncommitted, within `PROOF_SMOKE_MAX_STAKE_USDC6`, within configured proof-specific daily spend and transaction-count caps, and compatible with existing budget/commit rules
- **AND** the system creates a durable single-use proof claim and proof transaction lock before attempting any Arc transaction
- **AND** the resulting tx hash is persisted like any other commit

#### Scenario: Transactional smoke is retried

- **WHEN** a transactional proof request is retried for a signal with an existing successful, pending, or uncertain proof claim
- **THEN** the system returns the existing proof result or a reconciliation-required state
- **AND** it does not send a second Arc transaction for that signal

#### Scenario: Transactional smoke is unsafe

- **WHEN** the proof secret is missing or invalid, the signal is already committed, the signal is ineligible, the stake exceeds the per-signal cap, the proof daily budget is exhausted, the proof transaction count is exhausted, or a proof/autonomy lock or claim blocks the request
- **THEN** the system rejects the request with a machine-readable reason
- **AND** no Arc approval or commit transaction is attempted

#### Scenario: Public commit bypass is attempted

- **WHEN** a caller attempts to use a server-wallet commit path without the required proof or autonomy authorization and finite budget/idempotency/claim checks
- **THEN** the system rejects or disables the spend path
- **AND** no Arc approval or commit transaction is attempted

### Requirement: Operator Health and Judge Proof Pack Read Models

PredictArena MUST expose sanitized operational proof data for judges and operators.

#### Scenario: Operator health is retrieved

- **WHEN** a client reads operator health
- **THEN** the response includes last cron status, active lock state, budget warning state, chain/readiness state, allowance/balance warning state, and autonomy mode state
- **AND** every degraded or blocked state includes a structured explanation with a reason code, blocking fact, impact scope, and recommended next action
- **AND** the impact scope distinguishes read-only proof still safe, bounded proof transaction blocked, autonomy dry-run/off, and autonomy blocked states
- **AND** no server secrets, lock owners, idempotency keys, raw RPC errors, stack-like messages, internal URLs, request headers, or provider diagnostics are exposed

#### Scenario: Judge proof pack is retrieved

- **WHEN** a client reads the proof pack
- **THEN** the response includes latest autonomous receipt summary, Arc readiness facts, latest tx, bonded USDC, top reputation profile, resolution/refund/slash summary, and recommended next demo action
- **AND** the response distinguishes read-only proof from transactional proof mode
- **AND** public failure or warning details use sanitized reason codes and safe summaries only

