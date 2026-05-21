# PredictArena

PredictArena is a hackathon MVP for autonomous crypto prediction-market agents. It scans public Polymarket BTC/ETH/SOL candidates, runs deterministic volatility and momentum models, scores the edge, and can commit eligible signals as USDC bonds on Arc Testnet through `SignalBondArena`.

## What it includes

- `/arena`: market radar, Run Agents, Commit Eligible Signals, and signal cards with no manual evidence input.
- `/signals/[id]`: deterministic signal detail with model/data hashes, market link, Arc explorer link, and resolution audit fields.
- `/autonomy/runs/[runId]`: autonomous run receipt with queue outcomes, budget snapshots, hashes, and tx references.
- `/leaderboard`: generated, committed, and resolved signals with accuracy, bonded USDC, refund/slash totals, paper ROI, and Brier score.
- `/agents/[agentName]`: per-agent reputation profile for generated, committed, open, and resolved signal quality.
- `/demo-resolution`: guided demo script for the prediction-to-bond-to-settlement loop.
- `/proof`: judge/operator proof pack with latest receipt, Arc readiness, wallet facts, health explanations, and bounded proof smoke controls.
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
- `CRON_SECRET`: bearer token required by both `GET` and `POST /api/cron/run-autonomous-agents`.
- `PROOF_MODE_SECRET`: required by transactional proof-mode requests; keep unset to leave proof transactions disabled.
- `PROOF_SMOKE_MAX_STAKE_USDC6`, `PROOF_SMOKE_MAX_DAILY_USDC6`, `PROOF_SMOKE_MAX_TRANSACTIONS_PER_DAY`: finite proof-only caps. `0` keeps transactional proof disabled rather than allowing unlimited spend.
- `AUTONOMY_VOL_*` / `AUTONOMY_MOMENTUM_*`: per-agent autonomy mode plus finite limits for daily bonded USDC, daily signal count, per-signal stake, open signals, and minimum edge.
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
- Set `CRON_SECRET` and finite `AUTONOMY_*` budgets before enabling autonomous runs.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, agent private keys, or `ADMIN_PRIVATE_KEY` to the client.

## Autonomous runs

- `GET /api/cron/run-autonomous-agents` exists for Vercel Cron compatibility and requires `Authorization: Bearer $CRON_SECRET`.
- `POST /api/cron/run-autonomous-agents` uses the same auth check and is convenient for local cron or `curl`.
- Cron runs derive a stable UTC schedule-window id and idempotency key. Same-window retries return the existing run instead of re-running fetches or commits.
- `DRY_RUN` persists run history and queue outcomes but never sends Arc approvals or commits.
- `LIVE` commits only medium/high eligible signals that also satisfy `Risk Agent` gating and the per-agent finite budgets.
- `OFF` records skipped queue rows and blocks all spend.
- Supabase state uses a single JSON payload, so lock/claim coordination is best-effort across instances rather than a true distributed compare-and-swap.

Example local cron trigger:

```bash
curl -X POST http://127.0.0.1:3000/api/cron/run-autonomous-agents \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Vercel Cron should target the same path with `GET` and the same bearer secret.

Public operational reads:

- `/api/autonomy`: current autonomy policies, persisted run history, metrics, and Arc control-room readiness.
- `/api/proof`: judge/operator proof pack with sanitized operator health, latest receipt summary, readiness facts, and next demo action.
- `/api/proof/smoke`: read-only proof smoke facts on `GET`; bounded transactional proof on `POST` only with `PROOF_MODE_SECRET` plus finite proof caps.
- `/api/autonomy/runs/[runId]`: public autonomous run receipt without secrets.
- `/api/agents/[agentName]`: public Volatility/Momentum reputation profile without secrets.
- `/api/demo-script`: public demo-script read model for eligible unresolved and recent resolved signals.
- `/api/arc/readiness`: public Arc wallet/address readiness without exposing secrets.
- `/api/arc/sync-leaderboard`: best-effort Arc sync status that degrades safely when RPC or contract config is missing.
- `/api/commit-signal`: unauthenticated server-wallet spend is intentionally disabled; use autonomy or proof mode so authorization, caps, idempotency, claims, and locks are enforced in one boundary.

## Audit receipts and reputation

- From `/arena`, recent autonomous runs link to receipt pages. Receipts show run timing, market/signal counts, per-agent modes, budget utilization, policy queue decisions, model/data hashes, failure reasons, and Arc tx hashes when present.
- From `/leaderboard`, each agent links to its reputation profile. Profiles show open exposure, resolved accuracy, Brier score, bonded/refunded/slashed USDC, confidence mix, recent signals, and best/worst resolved outcomes.
- `/demo-resolution` is an operator-facing demo script. It labels settlement as `Demo/Admin Only` and `not an oracle`, accepts the admin token only in the client form submit, and sends it to the existing server-side `/api/admin/resolve-demo` route.

## Demo flow

0:00-0:20 Problem: humans cannot monitor every prediction market continuously.
0:20-0:50 Market Radar: PredictArena scans real Polymarket markets and filters crypto price markets.
0:50-1:30 Agents: Volatility and Momentum agents calculate probabilities and edge.
1:30-2:10 Arc Signal Bond: an agent commits a USDC signal bond on Arc Testnet.
2:10-2:40 Leaderboard: signals become an auditable track record.
2:40-3:00 Traction: show markets scanned, signals generated, Arc tx count, and users.

For the live demo, open `/proof` first to show the current proof pack, Arc readiness, operator health, and whether only read-only proof is safe or a bounded transaction is available. Then open `/arena`, click `Run Agents`, inspect a signal detail page, commit an eligible signal only through autonomy or proof mode when Arc config and funded wallets are present, then open `/leaderboard`. Use a recent autonomous run receipt to explain policy decisions and hashes, open an agent profile to show reputation, and use `/demo-resolution` for a guided admin/demo settlement. After expiry, call `/api/resolve-signals` to resolve eligible committed signals. Use `/api/admin/resolve-demo` with `x-admin-resolve-token` only for demo/admin forced settlement updates.

## Verification

```bash
npm run lint
npm test
npm run test:contracts
npm run build
npm run test:e2e
POSTHOG_DISABLED=1 openspec validate --specs --strict --no-interactive
```

## Safety notes

- Testnet only.
- No financial advice.
- No real Polymarket trading or order execution is implemented.
- `/api/admin/resolve-demo` is an admin-only demo path, not a decentralized oracle.
