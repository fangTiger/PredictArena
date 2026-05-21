# Change: Add Autonomous Agent Runs

## Why

PredictArena can already scan markets, run agents, commit eligible signals, and resolve outcomes, but every run still depends on a user click. The demo needs scheduled autonomous operation with explicit per-agent spend limits so judges can see real Arc settlement readiness without risking unlimited autonomous spend.

## What Changes

- Add an `AgentPolicy` model with autonomy mode `OFF`, `DRY_RUN`, or `LIVE` plus hard per-agent budget constraints.
- Add `POST /api/cron/run-autonomous-agents` for generic cron/local invocation and a Vercel-compatible `GET` entrypoint that uses the same secured runner.
- Require `CRON_SECRET` authorization before any autonomous scan, run, dry-run persistence, or LIVE commit attempt.
- Implement budget checks for daily bonded USDC, daily signal count, max stake per signal, max open signals, and minimum edge.
- Persist autonomous run history, dry-run signals, commit queue outcomes, skipped reasons, and run metadata.
- Commit only eligible medium/high confidence signals in `LIVE`; persist dry-run outcomes without chain transactions in `DRY_RUN`; block all spend in `OFF`.
- Add an Autonomy / Agent Control Room panel that shows run history, policy status, Arc contract/chain, agent wallet addresses, USDC balance, allowance, latest tx, commit availability, and queue state.
- Add chain audit helpers to read Arc `SignalBondArena` event/getter state back into local persistence/leaderboard where possible.
- Add a hidden/admin demo resolution command path that can mark a selected signal correct/incorrect and update leaderboard state, using the existing admin-token boundary.
- Upgrade signal detail into a Decision Trace with Market Scout score, volatility summary, Monte Carlo/momentum signals, Risk Agent pass/block timeline, modelHash/dataHash deterministic payload, and CLOB spread/liquidity diagnostics when `clobTokenIds` exist.
- Add README instructions for Vercel Cron and local cron.

## Non-Goals

- No unlimited autonomous spend.
- No mainnet operation or real Polymarket order execution.
- No client exposure of server-only keys, `CRON_SECRET`, agent private keys, or Supabase service-role keys.
- No decentralized oracle claim for demo/admin resolution.
- No new external frontend component framework.

## Impact

- Affected specs: `predictarena`, `predictarena-ui`.
- Affected code: autonomous policy/runner services, persistence store, cron API route, Arc read helpers, risk/orderbook helpers, arena/signal/leaderboard UI, README and env docs, tests.
- External integrations: public Polymarket Gamma/CLOB orderbook where available, Coinbase candles through existing adapter, Arc Testnet RPC, optional Vercel Cron.

## OpenSpec Notes

Graphify: unavailable. This worktree has no `graphify-out/` directory, so Graphify query/impact gate is degraded. Impact analysis uses current OpenSpec specs, local source inspection, existing tests, and `rg`/file reads.

Vercel Cron note: official Vercel documentation states Cron Jobs invoke paths with HTTP `GET`; this proposal keeps the requested `POST` endpoint and adds a `GET` wrapper for Vercel compatibility.
