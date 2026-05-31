# Change: Add Market Intelligence Workspace

## Why

PredictArena has proven the autonomous-agent and Arc accountability loop, but the product should grow beyond a hackathon proof surface. The next product step is to become a daily-use prediction-market intelligence workspace: help researchers, operators, and agent builders discover which markets matter, understand why agent signals differ from market prices, compare agents by track record, and evaluate paper-follow strategies before any real transaction workflow.

This change moves the primary product value from "demo the loop" to "make prediction-market research useful, repeatable, and trustworthy."

## What Changes

- Add a market intelligence workspace that ranks BTC, ETH, and SOL prediction markets by opportunity, liquidity/spread risk, volatility context, time-to-expiry, data health, and agent edge.
- Add research-grade signal and market read models that explain implied probability, agent probability, probability gap, volatility/momentum drivers, risk flags, comparable historical signals, and accountability status.
- Add segmented agent reputation so users can compare agents by asset, market condition type, expiry bucket, confidence bucket, and edge bucket rather than only by aggregate score.
- Add paper-follow/backtest views that estimate historical performance for a selected agent or strategy without sending transactions or claiming investment advice.
- Reposition Arc/USDC commitment as an accountability layer that supports trust after a signal is understood, not as the first-screen product narrative.
- Promote `/intelligence` to the product-facing entry point while keeping `/arena` as the operations surface.
- Resolve the existing public commit contract conflict by making unauthenticated `/api/commit-signal` explicitly disabled and preserving real server-wallet commits only through authorized autonomy/proof paths.
- Keep existing autonomous, no-manual-market, no-Polymarket-trading boundaries intact.

## Non-Goals

- No Polymarket order execution, AMM, exchange, copy-trading, or brokerage workflow.
- No financial advice, portfolio recommendation, or guarantee of profitability.
- No user-created markets, manual evidence input, pasted-news workflow, or manual parser correction UI.
- No expansion beyond supported public-data crypto markets in the first workspace version.
- No real-money production custody or mainnet spend path.
- No requirement for Supabase, paid data providers, authenticated Polymarket APIs, or LLM API keys.

## Impact

- Affected specs: `predictarena`, `predictarena-ui`
- Affected code: new or updated intelligence read models under `lib/`, API routes under `app/api/`, product routes/pages under `app/`, shared components, persistence projections, tests, and README/product docs.
- External data: existing Polymarket public market data, optional public CLOB orderbook diagnostics, public crypto candles, persisted agent signals, persisted autonomous runs, and persisted resolution/reputation state.
- Security boundaries: public intelligence APIs must not expose secrets, private keys, raw provider diagnostics, lock owners, idempotency keys, or server-only config. Paper-follow and backtest surfaces must not send Arc transactions.
- OpenSpec is required because this is a new product capability with public API/UI contracts, analytics read models, and user-facing positioning changes.

## Graphify

Graphify: unavailable. The repository has no `graphify-out/` directory and the `graphify` CLI is not installed in this environment. Proposal context and impact analysis use project instructions, existing OpenSpec specs, current source, tests, and file inspection.
