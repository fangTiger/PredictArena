# Change: Update PredictArena MVP to Current Hackathon Spec

## Why

The current PredictArena repository contains an earlier MVP shape, but the latest hackathon specification requires a stricter autonomous agent arena: real Polymarket scanning, deterministic BTC/ETH/SOL crypto market parsing, Monte Carlo probability engines, Supabase/local persistence fallback, Arc Testnet USDC signal bonds through `SignalBondArena`, leaderboard pages, and explicit no-financial-advice boundaries.

This change aligns the product, contract, APIs, UI, data model, tests, and README with the current MVP scope while preserving the core hackathon story: autonomous agents make quantified market calls and commit auditable USDC signal bonds on Arc Testnet.

## What Changes

- Replace or adapt the earlier MVP flow to the requested app routes: `/arena`, `/leaderboard`, `/signals/[id]`, plus API routes `/api/markets`, `/api/run-agents`, `/api/commit-signal`, `/api/leaderboard`, and `/api/resolve-demo`.
- Implement the requested TypeScript domain structure for Polymarket normalization, BTC/ETH/SOL crypto market parsing, public candle fetching, realized volatility, Monte Carlo GBM, Volatility Agent, Momentum Agent, Risk Agent, bps/Kelly utilities, Arc clients, and persistence.
- Use Tailwind for the application UI and zod for key environment, API input, and domain I/O validation boundaries.
- Implement `SignalBondArena.sol` in Solidity 0.8.24 with USDC `transferFrom`, owner resolution, refund/slash semantics, events, and getters.
- Add Supabase persistence when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` exist, with local JSON/in-memory fallback otherwise.
- Add demo snapshot fallback for markets and candles when public data is unavailable or yields no parseable candidates.
- Add UI signal cards, market radar, metrics strip, signal detail, and leaderboard with no manual evidence input, no manual market creation, and no Polymarket trade execution.
- Add README, `.env.example`, deploy/seed scripts, and tests covering parser, Monte Carlo, agents/risk, contract, API fallback, and the no-manual-input flow.

## Non-Goals

- No Polymarket authenticated trading, manual order execution, AMM, order book matching, or Polymarket clone behavior.
- No manual market creation, manual evidence textarea, pasted-news workflow, or manual parser correction UI.
- No decentralized oracle, production settlement system, mainnet funds, or production financial advice claims.
- No sports, politics, news semantic forecasting, complex cross-market arbitrage, or required LLM API key in the MVP.
- No CLOB dependency beyond optional public orderbook spread checks.

## Impact

- Affected specs: `predictarena`
- Affected code: app routes/pages, components, `lib/` domain modules, `contracts/`, `scripts/`, tests, `.env.example`, and `README.md`.
- Runtime stack constraints: Next.js App Router, TypeScript, Tailwind, viem, zod, Hardhat, Solidity 0.8.24, optional Supabase with local fallback.
- External integrations: Polymarket Gamma public API, optional Polymarket CLOB public book endpoint, Coinbase or Binance public candles, Arc Testnet RPC, Arc Testnet USDC ERC-20, optional Supabase service-role persistence.
- Security boundaries: private keys remain server-side environment variables only; testnet only; public APIs must not leak secrets; README must include no-financial-advice and no-real-trading disclaimers.

## OpenSpec Notes

- OpenSpec is required because this is a broad new-feature and architecture-alignment change affecting APIs, contracts, persistence, public UI, and security-sensitive Arc commit behavior.
- This change supersedes the earlier completed-but-unarchived `add-predictarena-mvp` shape where it conflicts with the current user specification.
- Before implementation handoff, Architecture Codex must treat this change as the single implementation baseline and must either archive/retire conflicting earlier completed changes or explicitly record their subordinate status so workers do not follow obsolete `SignalBondVault`, Prisma-only, or old route contracts.
- Graphify: unavailable. The repository has no `graphify-out/` directory, so proposal context and impact analysis use `AGENTS.md`, existing OpenSpec changes, current source tree, tests, and `rg`/file inspection.
- Git baseline during proposal creation: `0db24370757496e4aa4986e3787da79e9d363111`.
