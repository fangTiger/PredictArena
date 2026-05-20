# PredictArena Current MVP Design

## Scope and Product Shape

PredictArena is a compact hackathon MVP, not a trading venue. The first usable screen is `/arena`, where a user can scan markets, run agents, inspect generated signals, and commit eligible medium/high-confidence signals to Arc Testnet. `/leaderboard` summarizes agent track records, and `/signals/[id]` provides deterministic signal detail, hashes, model parameters, and Arc transaction links.

The implementation must keep all forecasting autonomous. The UI must not expose manual evidence input, manual market creation, manual parser correction, or Polymarket trading controls.

## Runtime Architecture

Use Next.js App Router with TypeScript domain modules under `lib/`. UI styling uses Tailwind classes and project globals; new visual surfaces must not depend on non-Tailwind component frameworks. Validation uses zod at the server boundary for environment configuration, route request bodies, parsed external payloads where practical, and persisted domain inputs.

1. `GET /api/markets` fetches active, non-closed Polymarket public markets from Gamma, normalizes them into `MarketCandidate`, filters binary YES/NO markets, parses BTC/ETH/SOL crypto price conditions, ranks top candidates by Market Scout score, and falls back to demo snapshots when allowed.
2. `POST /api/run-agents` loads candidates, fetches public candles for BTC/ETH/SOL, computes volatility and drift features, runs Volatility and Momentum agents, applies Risk Agent gates, persists the run and signals, and returns metrics plus `AgentSignal[]`.
3. `POST /api/commit-signal` loads a persisted signal, rejects AVOID/low-edge/low-confidence signals, picks the server-side agent wallet, ensures USDC allowance, commits to `SignalBondArena`, and stores `arcTxHash` plus committed status.
4. `GET /api/leaderboard` aggregates generated/committed/resolved signals, bonded USDC, average edge, confidence distribution, optional paper ROI, and resolved/demo Brier score.
5. `POST /api/resolve-demo` is admin-token protected with `ADMIN_RESOLVE_TOKEN`, validates input with zod, and exists only for demo resolution. It must not be presented as decentralized oracle behavior and must not be callable without the configured token. It must not require or expose `ADMIN_PRIVATE_KEY`.

## Data and Persistence

Use the requested public TypeScript models: `MarketCandidate`, `ParsedCryptoMarket`, and `AgentSignal`. Store probability, prices, edge, Kelly, and confidence in basis points. Store USDC stake amounts in 6-decimal micro-USDC. Use stable JSON plus `viem` `keccak256(toHex(...))` for `modelHash` and `dataHash`.

The persistence boundary is `lib/persistence/store.ts`. If Supabase env vars are present, use `supabaseStore.ts` with service-role server-side access only. Otherwise use `localStore.ts`, backed by local JSON under a runtime directory and an in-memory fallback if file writes fail. Supabase service-role keys must never be serialized into public API responses, client props, logs intended for UI, README examples, or committed fixtures. Demo snapshots live under `lib/demo/` and must be explicitly labeled.

## Market Discovery and Parsing

The Polymarket adapter uses Gamma public endpoints with `active=true` and `closed=false` filters. It reads `outcomes`, `outcomePrices`, `volume`, `liquidity`, `endDate`, and optional `clobTokenIds`. CLOB public orderbook checks are optional and only used for spread risk flags when available.

The parser supports only BTC, ETH, and SOL aliases and the specified threshold formats (`$100,000`, `$100k`, `100k`, `1.5k`, `120000`). It maps hit/reach/touch/surpass/exceed to `TOUCH_ABOVE`, drop/fall/touch below to `TOUCH_BELOW`, above/over/higher/close above to `EXPIRY_ABOVE`, and below/under/lower/close below to `EXPIRY_BELOW`. It rejects missing asset, threshold, end date, expired markets, expiry beyond 21 days, parse confidence below 0.7, unsupported assets, and non-binary outcomes without asking the user to fix parsing.

Market Scout ranks top 20 parseable candidates with:

`0.30 * liquidityScore + 0.25 * uncertaintyScore + 0.20 * timeToExpiryScore + 0.15 * volumeScore + 0.10 * parseConfidence`

## Probability and Agent Design

Use public Coinbase or Binance candles and normalize BTC, ETH, and SOL to USD/USDT quotes. If live candles fail, use snapshot candles when `ALLOW_DEMO_SNAPSHOT=true`.

Realized volatility is computed from log returns:

- `sigma7`: annualized recent 7d return standard deviation.
- `sigma30`: annualized recent 30d return standard deviation.
- `sigma = 0.65 * sigma7 + 0.35 * sigma30`, clamped to `[0.10, 2.50]`.

The probability engine is seeded Monte Carlo GBM:

- Inputs: `S0`, `K`, `T`, `sigma`, `mu`, condition type, `nPaths=10000`, `nSteps=min(max(hoursToExpiry, 12), 336)`, seed from `marketId + agentName`.
- Volatility Agent uses `mu=0` and model version `volatility-gbm-v1`.
- Momentum Agent uses `mu=clamp(recentReturn7d / (7/365), -0.75, 0.75)` and model version `momentum-gbm-v1`.

Signal decisions use a 700 bps edge threshold. YES is selected when `pYesBps - yesPriceBps >= 700`; NO is selected when `yesPriceBps - pYesBps >= 700`; otherwise AVOID. Kelly uses `(agentProbability - marketPrice) / (1 - marketPrice)` in bps and is clamped to `[0, 300]`. Stake mapping is 0.01, 0.03, or 0.05 USDC for the specified edge bands. Only medium/high confidence signals are committed by default.

Risk Agent rejects or flags low parse confidence, liquidity below 100, market prices outside 0.05-0.95, expiry under 1 hour or over 21 days, orderbook spread over 0.10 when known, edge under 700 bps, missing volatility/current price, and weird/impossible threshold conditions.

## Arc Contract and Commit Flow

Implement `contracts/SignalBondArena.sol` with Solidity 0.8.24, constructor `(address usdc, address treasury)`, `owner`, `treasury`, `signalCount`, `mapping(uint256 => Signal)`, `commitSignal(...)`, `resolveSignal(uint256,bool) onlyOwner`, `SignalCommitted`, and `SignalResolved`.

`commitSignal` transfers USDC from the signing agent wallet using `transferFrom`, stores the signal fields, and emits hashes. `resolveSignal` refunds correct stakes to the agent and sends incorrect stakes to treasury or retains them according to the simple auditable contract behavior chosen in implementation. Tests must cover commit transfer, correct refund, incorrect slash, and owner-only resolution.

Server-side viem code uses Arc Testnet chain ID `5042002`, RPC `https://rpc.testnet.arc.network`, USDC `0x3600000000000000000000000000000000000000`, 6 decimals, and private keys from `VOL_AGENT_PRIVATE_KEY` / `MOMENTUM_AGENT_PRIVATE_KEY`. It checks allowance, approves if needed, then calls `commitSignal`. `ADMIN_PRIVATE_KEY` is reserved for deployment scripts or explicit onchain owner/admin operations such as contract deployment or owner resolution, not for public UI or demo snapshot resolution. Agent and admin private keys must stay server-only and must not appear in client bundles, public API JSON, browser-readable env vars, README examples, snapshots, or tests.

## Frontend and Documentation

`/arena` shows PredictArena header, subtitle, metrics strip, Run Agents and Commit Eligible Signals controls, Market Radar, and Signal Cards. Signal cards show market question, asset/threshold/expiry, agent, market price, agent probability, side, edge, capped Kelly, stake, risk flags, confidence, status, and Arc tx link. Commit buttons are disabled for AVOID or low confidence.

`/leaderboard` shows rank, agent, generated signals, committed signals, average edge, total bonded, refunded, slashed, paper ROI, Brier score, and confidence distribution. `/signals/[id]` shows all signal fields, model params, model/data hashes, Arc tx link, market link when available, and a deterministic explanation generated from stored fields. This page must be routable from a signal card and must not ask users to add evidence or edit forecasts.

README must include project description, hackathon fit, architecture, setup, env vars, contract deploy, funding agent wallets, local run, Vercel deployment, testnet/no-financial-advice/no-real-Polymarket-trading disclaimers, and the 3-minute demo script.

## OpenSpec Coordination

The earlier `add-predictarena-mvp` change is completed but not archived, and the live spec set is currently empty. Before Stage 3 handoff, Architecture Codex must record that `update-predictarena-mvp-to-current-spec` is the implementation baseline. During final archive, completed older changes must not overwrite this spec with obsolete contracts, route names, persistence assumptions, or UI requirements. If an older completed change is archived first for bookkeeping, its output must be reconciled immediately against this change before implementation workers receive tasks.

## Implementation Slices

Use contract-first then fan-out:

1. Foundation and public contracts/data model are owned by Architecture Codex or a single Implementation Codex to freeze interfaces.
2. Independent slices may then implement market/parser/prices/agents, persistence/API, Arc contract/viem commit, and frontend/docs.
3. Shared config, package files, route contracts, and generated data are integration-owner files and must not be concurrently edited without sync.

Review mode is independent Review Codex because this change touches external APIs, private-key handling, ERC-20 approvals, public API routes, and contract settlement behavior.
