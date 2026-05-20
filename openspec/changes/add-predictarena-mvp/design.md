# PredictArena MVP Design

## Architecture

PredictArena will be a single Next.js App Router application with TypeScript domain modules under `lib/`. The app uses server-side API routes for market scanning, agent execution, persistence, and Arc commit orchestration, while the first screen is an operational arena dashboard. The dashboard is not a trading venue and does not show Polymarket order entry.

Data flow:

1. `GET /api/markets/scan` fetches active Polymarket events/markets, extracts embedded markets, filters and parses BTC/ETH/SOL price questions, stores scan results, and falls back to `data/demo-snapshot/polymarket-crypto-markets.json` when necessary.
2. `POST /api/agents/run` loads the latest parsed markets, fetches or derives crypto price features, runs Volatility and Momentum forecasts, then lets Risk Agent gate weak/dangerous signals.
3. The dashboard displays metrics, signals, reasons, and leaderboard state.
4. `POST /api/signals/[id]/commit` commits only eligible signals to Arc Testnet through a deployed `SignalBondVault` contract.

## Market Parsing

Parsing is intentionally conservative. A market is eligible only when its title/question can identify exactly one asset in `{BTC, ETH, SOL}`, a price threshold, a deadline or expiry clue, and binary YES/NO outcomes. Ambiguous markets, non-price markets, multi-asset questions, and unsupported assets are skipped with machine-readable skip reasons.

## Agent Model

- Volatility Agent estimates whether expected movement range can cross the market threshold before expiry.
- Momentum Agent estimates directional probability from recent price trend and market distance to threshold.
- Risk Agent converts weak, illiquid, stale, low-confidence, or near-expiry cases to AVOID and marks only high-conviction BUY_YES/BUY_NO signals as commit-eligible.

The agents are deterministic for MVP tests and explain their reasons; they do not call LLMs or require manual evidence.

## Persistence

SQLite with Prisma is sufficient for a local hackathon demo. All prices, probabilities, confidence values, and USDC amounts use integers:

- Probability/confidence/edge: basis points.
- USDC bond amount: micro-USDC using the Arc USDC ERC-20 6-decimal interface.
- Raw external payloads: JSON serialized to text fields for inspection and repeatable demo evidence.

## Arc Contract

`SignalBondVault` accepts Arc Testnet USDC ERC-20 bonds with `transferFrom`. It stores immutable signal commitments and emits `SignalCommitted`. It does not settle predictions, trade Polymarket outcomes, or operate an AMM. It may include an expiry refund path for the original committer so testnet demo funds are not permanently stuck.

Arc constants:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- USDC ERC-20 interface: `0x3600000000000000000000000000000000000000`
- ERC-20 decimals: 6

## Error Handling and Fallback

If Polymarket fetching fails, returns no markets, or yields zero confident parses, the scan route loads the demo snapshot and labels all resulting scan UI with `demo snapshot`. If Arc commit configuration is missing, the app must still scan and run agents, but eligible signals show commit disabled with a clear configuration reason.

## Security Boundaries

Private keys must only be read from environment variables by server-side commit/deploy scripts and must never be exposed to the client bundle. Public API responses must not include secret env values. Contract calls must validate chain ID and USDC decimals assumptions in code/tests.
