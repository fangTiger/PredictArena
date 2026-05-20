# Change: Add Resolution Engine

## Why

PredictArena currently demonstrates agent signal generation and Arc signal bonding, but the reputation loop is incomplete until committed signals can be resolved, scored, refunded, or slashed. The hackathon story needs the full cycle from autonomous forecast to auditable outcome.

## What Changes

- Add deterministic crypto market resolution for parsed BTC, ETH, and SOL price markets.
- Support `EXPIRY_ABOVE`, `EXPIRY_BELOW`, `TOUCH_ABOVE`, and `TOUCH_BELOW` using the same public candle provider and demo snapshot fallback already used by the probability engine.
- Add scoring utilities for Brier score, accuracy, bond refund/slash accounting, and paper ROI.
- Add `POST /api/resolve-signals` to find committed unresolved signals whose expiry has passed or whose touch condition can be evaluated and resolve them.
- Add admin-token protected `POST /api/admin/resolve-demo` for demo-only forced resolution without claiming decentralized oracle behavior.
- Extend `SignalBondArena` with `resolveSignalsBulk(uint256[] signalIds, bool[] correct)` while preserving owner-only resolution and USDC refund/slash behavior.
- Update persistence and leaderboard output to include resolved count, accuracy, Brier score, refunded USDC, slashed USDC, and paper ROI.

## Non-Goals

- No manual evidence input.
- No manual market creation.
- No decentralized oracle.
- No Polymarket trade execution or order matching.
- No mainnet or production financial advice flow.

## Impact

- Affected specs: `predictarena`
- Affected code: `lib/resolution/*`, persistence store, API routes, Arc contract/ABI, tests, leaderboard UI.
- External integrations: Coinbase public candles through the existing candle adapter, Arc Testnet RPC for optional onchain owner resolution.

## OpenSpec Notes

Graphify context is unavailable because this worktree has no `graphify-out/` directory. Source impact is established through local source inspection, existing tests, and `rg`/file reads.
