## 1. Proposal and Contract Freezing

- [x] 1.1 [Architecture Codex] Validate this OpenSpec proposal, design, task list, and `predictarena` spec delta.
- [x] 1.2 [Architecture Codex] Approve final route contracts, public TypeScript data models, environment variables, and file allowlists before implementation handoff.
- [x] 1.3 [Architecture Codex] Mark this change as the single implementation baseline for Stage 3 handoff and document how older completed active changes (`add-predictarena-mvp`, `redesign-predictarena-war-room`) are subordinate, archived, or reconciled.
- [x] 1.4 [Implementation Codex] Replace or adapt earlier MVP names and routes to the current spec without carrying forward obsolete `SignalBondVault` or Prisma-only assumptions unless explicitly retained as internal compatibility.

## 2. App Structure and UI Foundation

- [x] 2.1 [Implementation Codex] Create or align Next.js App Router pages: `app/page.tsx`, `app/arena/page.tsx`, `app/leaderboard/page.tsx`, and `app/signals/[id]/page.tsx`.
- [x] 2.2 [Implementation Codex] Create or align UI components: `MarketCard`, `SignalCard`, `AgentBadge`, `LeaderboardTable`, `MetricsStrip`, and `TxLink`, using Tailwind for styling.
- [x] 2.3 [Implementation Codex] Ensure the UI has no manual evidence textarea, no manual market creation, no manual parser correction, and no Polymarket trade-entry controls.

## 3. Market Discovery and Parser

- [x] 3.1 [Implementation Codex] Implement Polymarket Gamma public fetch and normalization under `lib/polymarket/`.
- [x] 3.2 [Implementation Codex] Implement BTC/ETH/SOL crypto market parsing rules under `lib/parser/parseCryptoMarket.ts`.
- [x] 3.3 [Implementation Codex] Implement market filtering, Market Scout scoring, top-20 candidate selection, and demo snapshot fallback.
- [x] 3.4 [Implementation Codex] Add parser and market API tests for supported questions, unsupported rejections, active/closed filters, and snapshot fallback.

## 4. Prices, Math, and Agents

- [x] 4.1 [Implementation Codex] Implement Coinbase or Binance public candle fetching with BTC/ETH/SOL USD or USDT normalization and snapshot candle fallback.
- [x] 4.2 [Implementation Codex] Implement realized volatility, seeded Monte Carlo GBM, bps utilities, stable hashing, and Kelly sizing.
- [x] 4.3 [Implementation Codex] Implement Volatility Agent, Momentum Agent, Risk Agent, and `runAgents` orchestration.
- [x] 4.4 [Implementation Codex] Add tests for Monte Carlo monotonicity, touch-vs-expiry probability, YES/NO/AVOID decisions, stake mapping, confidence, and risk flags.

## 5. Persistence and API Routes

- [x] 5.1 [Implementation Codex] Implement `lib/persistence/store.ts`, `supabaseStore.ts`, and `localStore.ts` with server-only Supabase service role access and local JSON/in-memory fallback.
- [x] 5.2 [Implementation Codex] Implement zod schemas for environment configuration, API request bodies, commit/resolve inputs, and core persisted domain payloads, including `ADMIN_PRIVATE_KEY` as server-only deploy/onchain-admin configuration and `ADMIN_RESOLVE_TOKEN` as the only demo resolve API credential.
- [x] 5.3 [Implementation Codex] Implement `GET /api/markets`, `POST /api/run-agents`, `POST /api/commit-signal`, `GET /api/leaderboard`, and admin-token-protected `POST /api/resolve-demo`.
- [x] 5.4 [Implementation Codex] Add negative tests proving `/api/resolve-demo` rejects missing/invalid admin tokens, does not require `ADMIN_PRIVATE_KEY`, and public API responses do not expose agent private keys, `ADMIN_PRIVATE_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`.
- [x] 5.5 [Implementation Codex] Persist runs, market candidates, generated signals, commit status, Arc tx hashes, and demo resolution fields.

## 6. Arc Contract and Viem Commit Flow

- [x] 6.1 [Implementation Codex] Implement `contracts/interfaces/IERC20.sol` and `contracts/SignalBondArena.sol` in Solidity 0.8.24.
- [x] 6.2 [Implementation Codex] Add Hardhat deploy script and contract tests for USDC transfer, correct refund, incorrect slash, getters, events, and owner-only resolution.
- [x] 6.3 [Implementation Codex] Implement Arc viem client, USDC allowance/approve helper, `signalBondArena` ABI wrapper, and `commitSignal` service using testnet-only agent private keys.
- [x] 6.4 [Implementation Codex] Ensure private keys never appear in client bundles, public API responses, snapshots, README examples, or committed files; `ADMIN_PRIVATE_KEY` may only be used by deploy/onchain-admin code paths.

## 7. Frontend Wiring and Documentation

- [x] 7.1 [Implementation Codex] Wire `/arena` to scan, run agents, commit individual signals, commit eligible signals, and render current metrics.
- [x] 7.2 [Implementation Codex] Wire `/leaderboard` and `/signals/[id]` to persisted data and Arc explorer links; `/signals/[id]` must show model params, model/data hashes, market link when available, and deterministic explanation text from stored fields.
- [x] 7.3 [Implementation Codex] Add `.env.example` with all requested variables and README setup/deploy/demo/disclaimer sections.
- [x] 7.4 [Implementation Codex] Add demo market and candle snapshots under `lib/demo/`.

## 8. Review and Verification

- [x] 8.1 [Implementation Codex] Run focused RED/GREEN evidence for parser, Monte Carlo, agents, contract, and API fallback tests.
- [x] 8.2 [Implementation Codex] Run `npm run lint`, `npm test`, `npm run test:contracts`, `npm run build`, and targeted local smoke checks as available.
- [x] 8.3 [Review Codex] Independently review scope alignment, security boundaries, contract behavior, API secret handling, UI no-manual-input constraints, and verification evidence.
- [x] 8.4 [Architecture Codex] Run final fresh verification, check file scope against allowlists, update session state, and prepare archive once implementation is accepted.

## Stop Conditions

- Stop if implementation requires real Polymarket authentication or trading endpoints.
- Stop if Arc commit behavior would expose private keys client-side or commit to any non-testnet chain.
- Stop if parsing scope expands beyond BTC/ETH/SOL crypto price markets without explicit approval.
- Stop if contract settlement semantics diverge from simple refund/slash owner resolution.
- Stop if Supabase becomes required for local demo instead of optional.
- Stop if the UI introduces manual evidence, manual markets, or financial-advice/trading claims.

## Validation Commands

- `POSTHOG_DISABLED=1 openspec validate update-predictarena-mvp-to-current-spec --strict --no-interactive`
- `rg -n "Tailwind|tailwind|zod|Zod" openspec/changes/update-predictarena-mvp-to-current-spec`
- `rg -n "/signals/\\[id\\]|resolve-demo|ADMIN_RESOLVE_TOKEN|private key|SUPABASE_SERVICE_ROLE_KEY|server-only" openspec/changes/update-predictarena-mvp-to-current-spec`
- `npm run lint`
- `npm test`
- `npm run test:contracts`
- `npm run build`
- Optional after dev server is available: browser smoke for `/arena`, `/leaderboard`, and one `/signals/[id]` detail route.
