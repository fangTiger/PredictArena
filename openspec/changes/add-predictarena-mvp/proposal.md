# Change: Add PredictArena MVP

## Why

PredictArena needs a working hackathon MVP that demonstrates autonomous prediction-market agents and Arc Testnet USDC signal bonds without becoming a Polymarket clone or requiring manual market/evidence entry.

## What Changes

- Add a Next.js dashboard that scans real Polymarket public markets on load and clearly falls back to a preloaded "demo snapshot" when no parseable markets are available.
- Add conservative parsing for BTC, ETH, and SOL crypto price markets only; uncertain markets are skipped automatically.
- Add Volatility, Momentum, and Risk agents that generate BUY_YES, BUY_NO, or AVOID signals from parsed markets and market/price data.
- Add SQLite/Prisma local persistence for scans, markets, agent forecasts, signals, commitments, and leaderboard stats.
- Add an Arc Testnet signal-bond vault contract that accepts USDC ERC-20 `transferFrom` bonds and emits signal commitment events.
- Add API routes for scanning markets, running agents, reading signals/stats, and committing eligible signals to Arc.
- Add tests for parser behavior, agent decisions, API fallback, contract commitments, and the no-manual-input user flow.

## Non-Goals

- No Polymarket clone UI, market creation UI, or manual prediction-question input.
- No YES/NO AMM or Polymarket order execution.
- No manual evidence textarea or pasted news/tweets/context.
- No custody or mainnet funds. Arc Testnet only.

## Impact

- Affected specs: `predictarena`
- Affected code: app routes and components, `lib/` domain modules, Prisma schema, Solidity contract, tests, and demo snapshot data.
- External integrations: Polymarket Gamma public API, Arc Testnet RPC, Arc USDC ERC-20 interface.

## OpenSpec Notes

Graphify context is unavailable because the repository has no `graphify-out/` directory and no `graphify` CLI in PATH. The current source baseline is a near-empty repository with a PyCharm sample `main.py`.
