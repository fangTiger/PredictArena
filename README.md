# PredictArena

PredictArena is a hackathon MVP for autonomous crypto prediction-market agents. It scans public Polymarket BTC/ETH/SOL candidates, runs deterministic volatility and momentum models, scores the edge, and can commit eligible signals as USDC bonds on Arc Testnet through `SignalBondArena`.

## What it includes

- `/arena`: market radar, Run Agents, Commit Eligible Signals, and signal cards with no manual evidence input.
- `/signals/[id]`: deterministic signal detail with model/data hashes, market link, Arc explorer link, and resolution audit fields.
- `/leaderboard`: generated, committed, and resolved signals with accuracy, bonded USDC, refund/slash totals, paper ROI, and Brier score.
- `/api/resolve-signals`: automatic server-side resolution for committed crypto price signals using public candle data.
- Public-market fallback: if live Polymarket or candle fetches fail, demo snapshots keep the MVP runnable.
- Optional persistence: Supabase via service-role key when configured, or local JSON fallback when not.

## Hackathon fit

PredictArena demonstrates real agentic decision-making: Market Scout selects parseable crypto markets, Volatility and Momentum agents produce quantified probabilities, Risk Agent gates weak edges, Arc records medium/high-conviction USDC signal bonds, and the leaderboard turns those signals into an auditable track record.

## Architecture

`/api/markets` fetches public Polymarket Gamma markets and falls back to `lib/demo`. `/api/run-agents` loads candles, computes volatility/drift, runs the deterministic agents, and persists signals through Supabase or local JSON. `/api/commit-signal` signs with the server-side agent wallet, approves USDC when needed, and calls `SignalBondArena`. `/api/resolve-signals` evaluates committed unresolved signals from public candles and can call owner-signed Arc bulk resolution when configured. `/api/leaderboard` and `/signals/[id]` read the persisted audit trail.

## Stack

- Next.js App Router
- TypeScript + zod
- Tailwind CSS
- viem
- Hardhat + Solidity
- Vitest + Playwright

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000/arena`.

## Environment variables

Core variables are documented in `.env.example`.

- `ALLOW_DEMO_SNAPSHOT=true`: keeps the app runnable without live APIs.
- `SIGNAL_BOND_ARENA_ADDRESS`: deployed Arc Testnet contract address.
- `NEXT_PUBLIC_ARC_EXPLORER_URL`: Arc explorer base URL, defaulting to `https://testnet.arcscan.app`.
- `VOL_AGENT_PRIVATE_KEY` / `MOMENTUM_AGENT_PRIVATE_KEY`: server-only agent wallets used for onchain commitments.
- `ADMIN_RESOLVE_TOKEN`: the only credential accepted by `/api/admin/resolve-demo`.
- `ADMIN_PRIVATE_KEY`: reserved for deploy/onchain owner operations and optional `/api/resolve-signals` bulk onchain resolution. It is not used by demo forced resolution.
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`: optional. If absent, the app uses local JSON persistence.

Do not prefix any secret with `NEXT_PUBLIC_`.

## Deploy the contract

```bash
export ARC_TREASURY_ADDRESS=0x...
export ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
npm run test:contracts
npx hardhat run scripts/deploy.ts --network arcTestnet
```

After deployment:

1. Copy the deployed `SignalBondArena` address into `SIGNAL_BOND_ARENA_ADDRESS`.
2. Fund the volatility and momentum agent wallets with Arc gas plus testnet USDC.
3. Restart the app server.

## Seed demo data

```bash
npx tsx scripts/seedDemo.ts
```

This scans candidates, loads snapshot/live prices, generates signals, and stores the current arena state.

## Vercel / hosted deployment

- Keep all agent keys and service-role keys in server-only environment variables.
- Set `ALLOW_DEMO_SNAPSHOT=true` if the deployment must tolerate public API failures.
- Use the same Arc and admin variables from `.env.example`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, agent private keys, or `ADMIN_PRIVATE_KEY` to the client.

## Demo flow

0:00-0:20 Problem: humans cannot monitor every prediction market continuously.
0:20-0:50 Market Radar: PredictArena scans real Polymarket markets and filters crypto price markets.
0:50-1:30 Agents: Volatility and Momentum agents calculate probabilities and edge.
1:30-2:10 Arc Signal Bond: an agent commits a USDC signal bond on Arc Testnet.
2:10-2:40 Leaderboard: signals become an auditable track record.
2:40-3:00 Traction: show markets scanned, signals generated, Arc tx count, and users.

For the live demo, open `/arena`, click `Run Agents`, inspect a signal detail page, commit an eligible signal if Arc config and funded wallets are present, then open `/leaderboard`. After expiry, call `/api/resolve-signals` to resolve eligible committed signals. Use `/api/admin/resolve-demo` with `x-admin-resolve-token` only for demo/admin forced settlement updates.

## Verification

```bash
npm run lint
npm test
npm run test:contracts
npm run build
npm run test:e2e
POSTHOG_DISABLED=1 openspec validate add-resolution-engine --strict --no-interactive
```

## Safety notes

- Testnet only.
- No financial advice.
- No real Polymarket trading or order execution is implemented.
- `/api/admin/resolve-demo` is an admin-only demo path, not a decentralized oracle.
