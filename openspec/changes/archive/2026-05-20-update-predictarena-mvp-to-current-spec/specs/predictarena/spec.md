## ADDED Requirements

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
