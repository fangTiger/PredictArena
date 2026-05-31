# Market Intelligence Workspace Design

## Product Shape

PredictArena becomes a prediction-market intelligence workspace. The primary user is a prediction-market researcher, operator, or agent builder who wants to scan markets, understand agent disagreement with market prices, compare agent skill, and evaluate paper-follow strategies. The product should feel like a compact research terminal, not a marketing site and not a trading venue.

The first implementation must add `/intelligence` as the product-facing research workspace, while preserving `/arena`, `/proof`, `/leaderboard`, `/signals/[id]`, and autonomous/proof accountability flows. `/arena` remains the operations surface. The default app entry and global navigation must make `/intelligence` discoverable as the primary product route.

The daily research path is:

1. Open `/intelligence` from the default entry or global navigation.
2. Filter and sort supported markets by asset, expiry, edge, confidence, liquidity, risk, and data health.
3. Select one market or signal to inspect implied probability, agent disagreement, drivers, risk flags, source quality, and accountability status.
4. Compare relevant agent segments for the same asset/condition/expiry or confidence bucket.
5. Adjust paper-follow assumptions and read performance, sample-size, unresolved, skipped, and source-mix caveats.

This path must remain read-only and must not require a transaction, manual market, manual evidence, or account connection.

## Core Concepts

### Market Intelligence Item

A `MarketIntelligenceItem` is a read model derived from existing market candidates, price features, optional spread diagnostics, and latest agent signals. It includes:

- market id, question, asset, condition type, threshold, expiry, source, market URL
- YES/NO price bps, implied probability, liquidity, volume, spread diagnostics when available
- current price, volatility summary, time-to-expiry, data freshness
- latest Volatility and Momentum agent probabilities, side, edge, confidence, risk flags
- opportunity score, risk score, data health score, and concise deterministic explanation

Scores are read-model scores for ranking and triage. They are not trading recommendations.

Scores are integers from `0` to `10000` basis-point style units.

- `dataHealthScoreBps`: starts at `10000` and subtracts stale/missing penalties. Market scan older than 30 minutes subtracts `1500`; price snapshot older than 60 minutes subtracts `2000`; latest signal older than 24 hours subtracts `1500`; missing orderbook/spread diagnostics subtracts `500`; demo snapshot source subtracts `500` while still remaining valid when clearly labeled. Clamp to `[0,10000]`.
- `riskScoreBps`: higher means riskier. Use `0.30 * liquidityRisk + 0.25 * spreadRisk + 0.20 * staleRisk + 0.15 * volatilityRisk + 0.10 * sourceRisk`, each component normalized to `[0,10000]`. Missing spread diagnostics should contribute a bounded degraded spread risk rather than failing the item.
- `opportunityScoreBps`: higher means more worth researching, not more worth buying. Use `0.35 * edgeScore + 0.20 * uncertaintyScore + 0.15 * liquidityScore + 0.15 * timeToExpiryScore + 0.15 * dataHealthScoreBps`, each component clamped to `[0,10000]`. `edgeScore` is based on absolute best-agent edge capped at 2500 bps. Opportunity explanations must use "research priority" or equivalent wording, not "buy", "sell", "trade", or "follow".

Deterministic summaries must use template-like fields, for example: asset/condition, implied probability, best agent probability, edge, primary driver, top risk flag, data health, and accountability status. They must not mention external news or unsupported causal claims.

### Signal Research View

A `SignalResearchView` explains a market or signal in research language without free-form manual evidence. It should answer:

- What is the market pricing?
- What does each agent believe?
- Where does the disagreement come from?
- What risk flags or data gaps should the user notice?
- How have similar stored signals performed?
- Is any accountability record present, such as dry-run, proof, Arc tx, or resolution?

The explanation must be deterministic from stored fields and public data. It must not invent external news context.

### Segmented Agent Reputation

Aggregate reputation alone is too blunt. The workspace needs segmented metrics by:

- agent name
- asset: BTC, ETH, SOL
- condition type: expiry above/below, touch above/below
- expiry bucket: intraday, 1-3d, 4-7d, 8-21d
- confidence bucket
- edge bucket

Each segment should expose generated count, committed count, resolved count, accuracy, Brier score, average edge, paper ROI, and bonded/refunded/slashed USDC when available. Segments with insufficient sample size must be clearly labeled.

Bucket defaults:

- expiry bucket: `intraday` (`<=24h`), `1_3d`, `4_7d`, `8_21d`
- confidence bucket: existing signal confidence labels `LOW`, `MEDIUM`, `HIGH`
- edge bucket: `avoid_or_subthreshold` (`<700`), `700_999`, `1000_1999`, `2000_plus`
- insufficient data threshold: default `minResolved=3`; API may accept `minResolved` from `0` to `100`

### Paper Follow / Backtest

Paper-follow evaluates what would have happened if a user followed a selected agent or simple strategy over persisted historical signals. The first version can use stored generated/resolved signals and demo/admin resolutions where clearly labeled. It should compute:

- included signal count and skipped signal count
- paper wins/losses or unresolved count
- cumulative paper ROI, average edge, Brier score, hit rate, max drawdown
- breakdown by asset and condition type
- strategy assumptions such as stake model, minimum edge, confidence filters, and date range
- source mix counts for automatic, demo/admin, unresolved, and unknown resolution sources

Paper-follow must be read-only and must not call Arc commit, proof transaction, Polymarket trading, or any mutation route.

Stake model options:

- `signal_stake` (default): use each signal's stored stake amount
- `flat_1_usdc`: treat each included resolved signal as a 1 USDC paper stake
- `confidence_weighted`: use 1, 3, or 5 paper units for low, medium, or high confidence

Paper ROI excludes unresolved signals from wins/losses but reports them in unresolved counts. Skipped signals include AVOID, below-threshold, missing-price, missing-resolution, and filtered-out signals with reason codes. Max drawdown is computed over the ordered paper equity curve after each included resolved signal.

## API Shape

Public read APIs are contractually frozen as follows. All query parsing must use zod or an equivalent structured validator. Invalid requests return:

```json
{
  "reason": "invalid_request",
  "issues": [{ "code": "invalid_type", "message": "...", "path": ["field"] }]
}
```

Unknown resources return `{ "reason": "not_found" }` with status `404`. Public server errors must use sanitized reason codes and must not include stack traces or provider diagnostics.

- `GET /api/intelligence/markets`
  - query:
    - `asset`: `BTC | ETH | SOL | all`, default `all`
    - `conditionType`: `EXPIRY_ABOVE | EXPIRY_BELOW | TOUCH_ABOVE | TOUCH_BELOW | all`, default `all`
    - `confidence`: `LOW | MEDIUM | HIGH | all`, default `all`
    - `source`: `live | demo_snapshot | all`, default `all`
    - `sort`: `opportunity_desc | edge_desc | expiry_asc | liquidity_desc | risk_asc | data_health_desc`, default `opportunity_desc`
    - `minEdgeBps`: integer `0..5000`, default `0`
    - `maxExpiryDays`: integer `1..21`, default `21`
    - `minLiquidity`: number `>=0`, default `0`
    - `limit`: integer `1..50`, default `20`
  - returns: market intelligence items plus filter metadata and data freshness
- `GET /api/intelligence/research`
  - query: exactly one of `signalId` or `marketId`; both missing or both present is `invalid_request`
  - returns: signal/market research view
- `GET /api/intelligence/agents`
  - query:
    - `groupBy`: `agent | asset | conditionType | expiryBucket | confidenceBucket | edgeBucket`, default `agent`
    - `asset`: `BTC | ETH | SOL | all`, default `all`
    - `conditionType`: `EXPIRY_ABOVE | EXPIRY_BELOW | TOUCH_ABOVE | TOUCH_BELOW | all`, default `all`
    - `confidence`: `LOW | MEDIUM | HIGH | all`, default `all`
    - `minResolved`: integer `0..100`, default `3`
  - returns: segmented reputation rows
- `GET /api/intelligence/paper-follow`
  - query:
    - `agentName`: `volatility | momentum | all`, default `all`
    - `minEdgeBps`: integer `0..5000`, default `700`
    - `confidence`: `LOW | MEDIUM | HIGH | all`, default `all`
    - `asset`: `BTC | ETH | SOL | all`, default `all`
    - `conditionType`: `EXPIRY_ABOVE | EXPIRY_BELOW | TOUCH_ABOVE | TOUCH_BELOW | all`, default `all`
    - `from` / `to`: optional ISO datetime; invalid ranges are `invalid_request`
    - `stakeModel`: `signal_stake | flat_1_usdc | confidence_weighted`, default `signal_stake`
  - returns: paper-follow summary, curve, breakdowns, and assumptions

These routes are public read models. If later versions add saved watchlists, alerts, accounts, or personalized strategies, those require a separate proposal.

Public intelligence responses must be built from an explicit allowlist. They may include ids, timestamps, public market fields, public addresses, hashes, tx hashes, bps metrics, score bps, safe enum reason codes, sanitized summaries, and aggregate counts. They must not include `rawPayload`, private keys, service-role keys, cron/proof/admin secrets, lock token/owner, idempotency keys, raw provider/RPC errors, stack-like diagnostics, internal URLs, request headers, server config, or unbounded persisted state blobs.

## UI Shape

`/intelligence` should use a dense workspace layout:

- filter rail or compact toolbar for asset, expiry, confidence, edge, liquidity, and sort
- market radar table/cards optimized for scanning and sorting
- selected market research panel or link to detailed research page
- agent comparison section with segmented reputation
- paper-follow/backtest panel with assumptions and result curve

The UI must not include trade-entry controls, user-created market forms, manual evidence textareas, or language that implies financial advice. Arc status can be shown as an accountability signal, not as the primary call to action.

First-version usability acceptance:

- First viewport on desktop must expose market radar, active filters/sort, selected research summary or empty-selection prompt, and at least one agent/paper-follow summary affordance.
- Mobile must preserve the same path in stacked sections with no horizontal scrolling.
- Empty/degraded states must keep filters visible, show data-health/source facts, and offer a safe next action such as re-scan or broaden filters.
- Paper-follow must show sample size, unresolved count, skipped count, source mix, and assumptions near ROI/hit-rate output.
- The global navigation and README route table must include `/intelligence`.

## Persistence and Data Boundaries

Use existing persistence first. The first version should derive read models from the current store state, live/snapshot market scan outputs, price snapshots, signals, autonomous runs, commit records, and resolutions. Avoid new durable schema unless a read model cannot be computed from existing persisted state.

If additional cached projections are needed for performance, they must preserve local JSON fallback and optional Supabase behavior. Public responses must be sanitized.

Existing public commit semantics must be reconciled before implementing intelligence API/UI slices. The canonical contract should say unauthenticated `/api/commit-signal` is disabled as a server-wallet spend path, and actual server-side Arc commits may only happen through autonomy/proof flows with authorization, budgets, claims, and locks.

## Review and Risk

This change touches public APIs, user-facing analytics, reputation metrics, and product positioning. It requires:

- product/usefulness review: does the workspace answer real recurring user questions?
- engineering/security review: are read models deterministic, bounded, sanitized, and testable?
- no-financial-advice review: copy and metrics must avoid recommendations or performance guarantees

Implementation should proceed contract-first: freeze TypeScript read model shapes and API response contracts, then implement backend projections, then UI.
