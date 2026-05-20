# PredictArena Current MVP Implementation Plan

> **For Implementation Codex:** REQUIRED SUB-SKILL: Use test-driven-development to implement this plan task-by-task.

**Goal:** Align PredictArena with `update-predictarena-mvp-to-current-spec`: autonomous Polymarket crypto-market scanning, deterministic agents, Arc Testnet USDC signal bonds, signal detail, leaderboard, safe persistence fallback, and README/demo delivery.

**Architecture:** Freeze shared route/data/env/contract boundaries first, then implement domain slices in TDD order. A single worker may execute sequentially in the shared workspace; if multiple workers are later used, shared contracts/config/package files must remain single-owner and independent slices must use patch handback or isolated worktrees.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, zod, viem, optional Supabase, local JSON/in-memory fallback, Hardhat, Solidity 0.8.24, Vitest, Playwright.

---

## Governance

- ChangeId: `update-predictarena-mvp-to-current-spec`
- Proposal status: Review Codex `PASS`
- GitBaseline: `0db24370757496e4aa4986e3787da79e9d363111`
- Graphify context: unavailable; repository has no `graphify-out/`, so use OpenSpec, current source tree, tests, and file inspection.
- IntegrationOwner: Architecture Codex
- Implementation Executor: `worker-codex` (`gpt-5.4`, `xhigh`)
- Review Executor: `review-codex` (`gpt-5.4`, `xhigh`)
- Current dirty baseline before implementation: untracked `openspec/changes/update-predictarena-mvp-to-current-spec/` and this planning document.
- Single implementation baseline: `update-predictarena-mvp-to-current-spec`; older completed active changes are subordinate and must not override current route, contract, persistence, or UI requirements.

## Global Stop Conditions

- Stop if implementation would require Polymarket authentication or authenticated trading endpoints.
- Stop if any private key or Supabase service-role key would reach client code, public API JSON, UI state, snapshots, README examples, or committed fixtures.
- Stop if `/api/resolve-demo` starts using `ADMIN_PRIVATE_KEY`; it must use `ADMIN_RESOLVE_TOKEN`.
- Stop if parsing expands beyond BTC/ETH/SOL crypto price markets.
- Stop if Supabase becomes mandatory for local demo.
- Stop if `SignalBondArena` settlement semantics drift from simple owner resolve, refund correct, slash incorrect.
- Stop before modifying files outside the current slice allowlist.

## Task 0: Baseline and OpenSpec Coordination

**Files:**
- Modify: `.codex/session-state.md`
- Modify: `openspec/changes/update-predictarena-mvp-to-current-spec/tasks.md`
- Read-only: `openspec/changes/add-predictarena-mvp/*`, `openspec/changes/redesign-predictarena-war-room/*`

**Steps:**
1. Record Stage 3/4 active session state with ChangeId, baseline, worker/reviewer roles, dirty baseline, pending slices, and Graphify degradation.
2. Mark task `1.1` and `1.3` complete only after OpenSpec validation and reviewer PASS are recorded.
3. Add handoff note that older active completed changes are subordinate to this change until final archive reconciliation.
4. Run: `POSTHOG_DISABLED=1 openspec validate update-predictarena-mvp-to-current-spec --strict --no-interactive`
5. Expected: change is valid; PostHog flush errors may occur after validation and are telemetry-only.

## Task 1: Foundation Contracts, Types, Env, and Dependencies

**Files:**
- Modify/Create: `package.json`, `package-lock.json`
- Modify/Create: `tailwind.config.ts`, `postcss.config.*`, `app/globals.css`
- Modify/Create: `.env.example`
- Create/Modify: `lib/polymarket/types.ts`
- Create/Modify: `lib/prices/types.ts`
- Create/Modify: `lib/config/*.ts`
- Create/Modify: `lib/utils/stableHash.ts`, `lib/utils/format.ts`
- Create/Modify tests: `test/config.test.ts`, `test/hash-format.test.ts`

**TDD Steps:**
1. Write failing tests for zod env parsing: Arc constants, optional Supabase, server-only secret classification, and no `NEXT_PUBLIC_` prefix on secrets.
2. Run targeted tests and confirm RED.
3. Implement zod config schemas and shared TypeScript models that match OpenSpec `MarketCandidate`, `ParsedCryptoMarket`, and `AgentSignal`.
4. Add Tailwind setup if absent and keep UI styling compatible with existing globals.
5. Run targeted tests, then `npm run lint`.

## Task 2: Market Scanner, Parser, Prices, Math, and Agents

**Files:**
- Create/Modify: `lib/polymarket/fetchMarkets.ts`, `lib/polymarket/normalizeMarket.ts`, `lib/polymarket/types.ts`
- Create/Modify: `lib/parser/parseCryptoMarket.ts`
- Create/Modify: `lib/prices/fetchCandles.ts`, `lib/prices/volatility.ts`, `lib/prices/types.ts`
- Create/Modify: `lib/math/monteCarlo.ts`, `lib/math/seededRandom.ts`, `lib/math/bps.ts`, `lib/math/kelly.ts`
- Create/Modify: `lib/agents/volatilityAgent.ts`, `lib/agents/momentumAgent.ts`, `lib/agents/riskAgent.ts`, `lib/agents/runAgents.ts`
- Create/Modify: `lib/demo/markets.snapshot.json`, `lib/demo/candles.snapshot.json`
- Tests: `test/parser.test.ts`, `test/monteCarlo.test.ts`, `test/agents.test.ts`, market/prices tests as needed

**TDD Steps:**
1. Write parser RED tests for BTC/ETH/SOL aliases, threshold formats, condition mapping, binary YES/NO checks, expired/long-expiry rejection, and unsupported questions.
2. Implement parser and normalization minimally.
3. Write Monte Carlo RED tests for deterministic seed, threshold monotonicity, and touch probability >= expiry probability.
4. Implement seeded GBM and bps/Kelly utilities.
5. Write agent RED tests for YES, NO, AVOID, risk flags, confidence, stake mapping, and missing data.
6. Implement candle fallback, volatility, Volatility Agent, Momentum Agent, Risk Agent, and Market Scout scoring.
7. Run: `npm test -- parser.test.ts monteCarlo.test.ts agents.test.ts` or equivalent Vitest filters.

## Task 3: Persistence and API Routes

**Files:**
- Create/Modify: `lib/persistence/store.ts`, `lib/persistence/supabaseStore.ts`, `lib/persistence/localStore.ts`
- Create/Modify: `app/api/markets/route.ts`, `app/api/run-agents/route.ts`, `app/api/commit-signal/route.ts`, `app/api/leaderboard/route.ts`, `app/api/resolve-demo/route.ts`
- Tests: API route tests for markets fallback, run-agents, commit rejection, leaderboard, resolve-demo auth, and secret non-disclosure

**TDD Steps:**
1. Write failing tests for store fallback behavior without Supabase env vars.
2. Implement local JSON store with in-memory fallback; add Supabase store boundary without requiring Supabase locally.
3. Write failing API tests for `/api/markets` snapshot fallback and `/api/run-agents` producing at least two signals with demo data.
4. Write failing negative tests for `/api/commit-signal` rejecting AVOID/low edge/missing config.
5. Write failing negative tests for `/api/resolve-demo` missing/invalid `ADMIN_RESOLVE_TOKEN` and no dependency on `ADMIN_PRIVATE_KEY`.
6. Implement API routes with zod request validation and no secret leakage.
7. Run targeted API/store tests, then `npm test`.

## Task 4: Arc Contract and Viem Commit Flow

**Files:**
- Create/Modify: `contracts/interfaces/IERC20.sol`
- Create/Modify: `contracts/SignalBondArena.sol`
- Create/Modify: `contracts/MockUSDC.sol` only if tests need adaptation
- Create/Modify: `scripts/deploy.ts`, `scripts/seedDemo.ts`
- Create/Modify: `lib/arc/client.ts`, `lib/arc/usdc.ts`, `lib/arc/signalBondArena.ts`, `lib/arc/commitSignal.ts`
- Tests: `test/SignalBondArena.test.ts`, `test/commit-service.test.ts`

**TDD Steps:**
1. Write failing Hardhat tests for commit transfer, event fields, getters, owner-only resolve, correct refund, and incorrect slash/treasury behavior.
2. Implement `SignalBondArena.sol` with Solidity 0.8.24.
3. Write failing viem commit service tests for allowance check, approve-if-needed, wallet selection by agent, chain constants, and missing config rejection.
4. Implement Arc client, USDC helper, ABI wrapper, and commit service.
5. Run: `npm run test:contracts` and targeted commit-service tests.

## Task 5: Frontend, Signal Detail, Leaderboard, README, and E2E

**Files:**
- Create/Modify: `app/page.tsx`, `app/arena/page.tsx`, `app/leaderboard/page.tsx`, `app/signals/[id]/page.tsx`
- Create/Modify: `components/MarketCard.tsx`, `components/SignalCard.tsx`, `components/AgentBadge.tsx`, `components/LeaderboardTable.tsx`, `components/MetricsStrip.tsx`, `components/TxLink.tsx`
- Modify: `app/globals.css`
- Modify/Create: `README.md`, `.env.example`
- Tests: Playwright smoke test for `/arena`, `/leaderboard`, and `/signals/[id]`

**TDD / Verification Steps:**
1. Write or update E2E assertions for `/arena` loading without manual input, buttons present, signal cards showing required fields, and no textarea/manual market creation.
2. Implement Tailwind UI pages and components against API contracts.
3. Add `/signals/[id]` deterministic explanation, model/data hashes, market link, and Arc explorer link.
4. Add leaderboard table columns and aggregate values.
5. Fill README with setup, env vars, deploy, fund wallets, local run, Vercel, disclaimers, and demo script.
6. Run: `npm run lint`, `npm run build`, `npm run test:e2e` when server binding is available.

## Final Integration and Review Gate

1. Architecture Codex checks `git diff --name-only 0db24370757496e4aa4986e3787da79e9d363111` against the approved allowlist.
2. Worker provides Implementation Evidence: changed files, RED/GREEN commands, failed/blocked commands, and requirement coverage matrix.
3. Run full verification:
   - `POSTHOG_DISABLED=1 openspec validate update-predictarena-mvp-to-current-spec --strict --no-interactive`
   - `npm run lint`
   - `npm test`
   - `npm run test:contracts`
   - `npm run build`
   - `npm run test:e2e` if local server can bind
4. Review Codex performs final review and must return `PASS` before Stage 6 VERIFY/ARCHIVE.

## Initial Handoff Package

- ChangeId: `update-predictarena-mvp-to-current-spec`
- TaskId: `MVP-CURRENT-SPEC-SEQUENTIAL`
- AgentId: `worker-codex-mvp-1`
- SliceId: `foundation-then-sequential-slices`
- Executor: Implementation Codex `worker-codex` (`gpt-5.4`, `xhigh`)
- Editable files: files listed in Tasks 1-5 plus `openspec/changes/update-predictarena-mvp-to-current-spec/tasks.md` for checkbox updates.
- Forbidden files: `AGENTS.md`, `.claude/**`, `.codex/agents/**`, `.codex/config.toml`, `.codex/hooks/**`, `.idea/**`, `.env`, private key files, unrelated OpenSpec changes except read-only coordination, generated caches unless explicitly required.
- Acceptance criteria: all OpenSpec scenarios in `specs/predictarena/spec.md` plus user acceptance criteria 1-10.
- Out-of-scope: Polymarket trading, AMM/order matching, manual evidence input, manual markets, decentralized oracle, sports/politics/news semantic forecast, required LLM key, mainnet/production advice claims.
- Validation: commands in Final Integration and Review Gate.
- Stop conditions: Global Stop Conditions above.
- Graphify context: unavailable, no `graphify-out/`.
- GitBaseline: `0db24370757496e4aa4986e3787da79e9d363111`
- SessionStatePath: `.codex/session-state.md`
- Patch artifact/worktree path: shared workspace single-worker by default; if parallelized later, use isolated worktree or patch artifact per slice.
- TaskScopeFiles: exact file groups listed per task.
- PreExistingDirtyBaseline: `openspec/changes/update-predictarena-mvp-to-current-spec/`, `docs/plans/2026-05-20-predictarena-current-mvp-implementation.md`
- GeneratedOrNoisyArtifacts: `.next/**`, `artifacts/**`, `cache/**`, `data/runtime/**`, `prisma/*.db`, `node_modules/**`
- IntegrationOwner: Architecture Codex
