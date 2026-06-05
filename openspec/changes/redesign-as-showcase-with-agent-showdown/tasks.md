# Implementation Tasks

> **Executor key:** `Codex` = code implementation via codex-handoff. `Claude` = small docs/config edits Claude does directly. No Gemini (user constraint).
>
> Each numbered task maps to a chunk in `docs/superpowers/plans/2026-06-03-predictarena-redesign.md`. The detailed step-by-step TDD recipe lives in the plan; this file is the proposal-level task list.

## 0. Prerequisite (NOT executed by this change)

- [x] 0.1 Archive `openspec/changes/add-wallet-funded-follows/` to `archive/2026-06-03-add-wallet-funded-follows/` and merge its delta into `specs/predictarena/` + `specs/predictarena-ui/`. _Executor: Claude_
- [x] 0.2 Confirm clean `openspec validate --strict --no-interactive` after archival. _Executor: Claude_

## 1. Foundation Skeleton (Plan Chunk 1)

- [x] 1.1 Add design tokens (Editorial + Glass Neon + Admin) to `app/globals.css`. _Executor: Codex_
- [x] 1.2 Create shared `<TopNav />` client component using `usePathname()`. _Executor: Codex_
- [x] 1.3 Replace `app/page.tsx` redirect with Editorial placeholder home. _Executor: Codex_
- [x] 1.4 Wrap `/arena` in glass-neon layout (`app/arena/layout.tsx`). _Executor: Codex_
- [x] 1.5 Scaffold `/agents` and `/my` placeholder pages. _Executor: Codex_
- [x] 1.6 Create `lib/config/admin-auth.ts` (cookie + env check). _Executor: Codex_
- [x] 1.7 Scaffold `/admin` route tree with auth guard, AdminShell sidebar, and `/admin/login` form via `next.config.ts` rewrite. _Executor: Codex_

## 2. Legacy Cleanup (Plan Chunk 2)

- [x] 2.1 Migrate `/demo-resolution` (page + console) to `/admin/resolution`. _Executor: Codex_
- [x] 2.2 Migrate `/proof` (page + console) to `/admin/proof`. _Executor: Codex_
- [x] 2.3 Delete `app/intelligence/`, `app/autonomy/`, `app/leaderboard/`, `app/signals/` directories. _Executor: Codex_
- [x] 2.4 Delete legacy `app/agents/[agentName]/` directory (will be reconstructed in Chunk 9). _Executor: Codex_
- [x] 2.5 Enumerate + update any UI link references; delete or update tests referencing removed routes. _Executor: Codex_
- [x] 2.6 Final foundation verification (build, tests, lint, manual route smoke). _Executor: Codex_

## 3. ShowdownArena Smart Contract (Plan Chunk 3)

- [x] 3.1 Write TDD scaffold for ShowdownArena tests (Hardhat + ethers). _Executor: Codex_
- [x] 3.2 Implement `openShowdown` (atomic operator-orchestrated open). _Executor: Codex_
- [x] 3.3 Cover error paths + atomicity tests. _Executor: Codex_
- [x] 3.4 Implement `settleShowdown` with onlyOwner guard. _Executor: Codex_
- [x] 3.5 Add view functions: `getShowdown`, `lookupByExternalId`. _Executor: Codex_
- [x] 3.6 Verify branch coverage against §4.4.3 invariants. _Executor: Codex_
- [x] 3.7 Create viem client wrapper `lib/contracts/showdownArena.ts`. _Executor: Codex_
- [x] 3.8 Create idempotent deployment script `scripts/deploy-showdown-arena.ts` with JSON record output. _Executor: Codex_

## 4. Editorial Homepage (Plan Chunk 4)

- [x] 4.1 Lock copy constants in `lib/config/homeCopy.ts`. _Executor: Codex_
- [x] 4.2 TDD `HomeHero` component (tagline + H1 + subtitle). _Executor: Codex_
- [x] 4.3 TDD `HomeDataStrip` component (4-column KPI grid). _Executor: Codex_
- [x] 4.4 TDD `HomeNarrative` component (Premise + How to Watch). _Executor: Codex_
- [x] 4.5 Build `lib/arc/blockNumber.ts` + DI-friendly `getHomeStripData` in `lib/services/homeData.ts`. _Executor: Codex_
- [x] 4.6 Replace `app/page.tsx` placeholder with full RSC home. _Executor: Codex_
- [x] 4.7 Add `HomeTransitionFooter` (protocol transition bridge per Appendix A). _Executor: Codex_

## 5. Showdown Backend Part 1 (Plan Chunk 5)

- [x] 5.1 Add `ShowdownRecord` type to `lib/persistence/store.ts`. _Executor: Codex_
- [x] 5.2 Implement `ShowdownStore` facade + local JSON store + Supabase stub. _Executor: Codex_
- [x] 5.3 Implement `discoverShowdowns` service (algorithm per §4.5.1, including tie-break). _Executor: Codex_
- [x] 5.4 Cover discovery skip reasons + budget + operator-gas paths in tests. _Executor: Codex_

## 6. Showdown Backend Part 2 (Plan Chunk 6)

- [x] 6.1 Implement `settleEligibleShowdowns` service + `mapResolutionToAgentAWins`. _Executor: Codex_
- [x] 6.2 Cover settlement + stuck-flag path in tests. _Executor: Codex_
- [x] 6.3 Implement `GET /api/showdowns` with status filter. _Executor: Codex_
- [x] 6.4 Implement `POST /api/showdowns/discover` (admin-gated). _Executor: Codex_
- [x] 6.5 Implement `POST /api/showdowns/[id]/settle` (admin-gated, single-showdown target). _Executor: Codex_
- [x] 6.6 Implement `buildDefaultDiscoveryDeps` + `buildDefaultSettlementDeps`. _Executor: Codex_
- [x] 6.7 Wire `getHomeStripData` to count settled showdowns + identify leader (drop placeholder marker in `HomeDataStrip`). _Executor: Codex_
- [x] 6.8 Integrate discovery + settlement into cron route. _Executor: Codex_

## 7. Arena UI Rewrite (Plan Chunk 7)

- [x] 7.1 TDD `ShowdownCard` component (Open + Settled visuals). _Executor: Codex_
- [x] 7.2 TDD `ShowdownGrid` component (active + settled sections + Show more). _Executor: Codex_
- [x] 7.3 Install `swr@^2` dependency. _Executor: Codex_
- [x] 7.4 Rewrite `components/arena-dashboard.tsx` around ShowdownGrid (drop intelligence/watchlist/etc; preserve Run Agents + follow flow). _Executor: Codex_
- [x] 7.5 Add `PendingFollowsRow` (connected-user chip strip). _Executor: Codex_
- [x] 7.6 Update `app/arena/page.tsx` to drop legacy props and mount new dashboard cleanly. _Executor: Codex_

## 8. /my Wallet-Bound Dashboard (Plan Chunk 8)

- [x] 8.1 Implement `WalletBindingsFacade` (joining `WalletFollowRecord` against `state.signals`). _Executor: Codex_
- [x] 8.2 Implement `GET /api/wallet/[address]/summary` endpoint. _Executor: Codex_
- [x] 8.3 Build `MyDashboard` (with EIP-1193 `accountsChanged` listener; useSWR above early return per Rules of Hooks). _Executor: Codex_
- [x] 8.4 Build `MyOverviewStrip`, `MyFollowsTable`, `MyTxHistoryTable`. _Executor: Codex_
- [x] 8.5 Wire `app/my/page.tsx` to mount `MyDashboard`. _Executor: Codex_

## 9. /agents + /admin Sub-pages (Plan Chunk 9)

- [x] 9.1 Build `/agents` list page using `buildAgentReputationProfile` (real field names: `generatedSignals`, `totalBondedMicroUsdc`, `accuracyBps`). _Executor: Codex_
- [x] 9.2 Build `/agents/[agentId]` drill-down with `AgentReputationPanel`. _Executor: Codex_
- [x] 9.3 Fill `/admin/control-room` with operator/Arc readiness read model. _Executor: Codex_
- [x] 9.4 Fill `/admin/receipts` with `buildAutonomousRunReceipt` list. _Executor: Codex_
- [x] 9.5 Fill `/admin/health` with operator health read model. _Executor: Codex_

## 10. Polish, E2E, Docs, Deploy (Plan Chunk 10)

- [x] 10.1 Write Playwright E2E: home flow. _Executor: Codex_
- [x] 10.2 Write Playwright E2E: arena showdown flow (with seeded `localStorage` wallet stub). _Executor: Codex_
- [x] 10.3 Write Playwright E2E: my-dashboard flow. _Executor: Codex_
- [x] 10.4 Visual polish pass (color tokens, spacing, hover states). _Executor: Claude_
- [x] 10.5 Update README + `docs/circle-submission.md` for Arc builder application. _Executor: Claude_
- [x] 10.6 Update spec §5.1 to align with the RSC-not-SWR data strip decision. _Executor: Claude_
- [x] 10.7 Deploy ShowdownArena to Arc Testnet via `scripts/deploy-showdown-arena.ts`. _Executor: Claude (manual deploy)_
- [x] 10.8 Approve USDC for agent wallets against ShowdownArena. _Executor: Claude (manual tx)_
- [ ] 10.9 Configure production env (`NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS`, `ADMIN_ACCESS_TOKEN`). _Executor: Claude_
- [ ] 10.10 Production deploy + smoke test. _Executor: Claude_

## 11. Follow + Showdown UX Fixes (Post-test Feedback)

- [x] 11.1 Treat persisted wallet follow receipts as `confirmed` until resolution, even if the joined signal is still `generated`. _Executor: Codex_
- [x] 11.2 Clarify the empty Arena state so users know `Run Agents` creates signals and admin/cron discovery opens Showdowns. _Executor: Codex_
- [x] 11.3 Add post-follow guidance that points users to `/my` and explains the operator discovery step. _Executor: Codex_
- [x] 11.4 Add an admin `/admin/control-room` discovery console for explicit `POST /api/showdowns/discover` execution and result summaries. _Executor: Codex_

## 12. Automatic Showdown Discovery UX (Post-test Feedback)

- [x] 12.1 Auto-attempt `discoverShowdowns` from `POST /api/run-agents` after signals persist; return a safe `showdowns.discovery` summary without failing the run on discovery errors. _Executor: Codex_
- [x] 12.2 Refresh Arena showdowns and report the automatic discovery outcome after `Run Agents`. _Executor: Codex_
- [x] 12.3 Update `Run Agents + Follow`, empty Arena, and admin discovery copy so manual admin discovery is clearly an override/diagnostic path, not the normal user flow. _Executor: Codex_
- [x] 12.4 Add/update focused tests and run OpenSpec validation. _Executor: Codex_

## 13. Arena Density + Preview Feedback (Post-test Feedback)

- [x] 13.1 Move Wallet Readiness out of the persistent Arena sidebar and expose it from the wallet/address entry path. _Executor: Codex_
- [x] 13.2 Promote Run Output into a paginated, clickable signal browser with a read-only detail view. _Executor: Codex_
- [x] 13.3 Render UI-only preview Showdown candidates when real showdowns are empty but the latest run has opposing signals; label previews as not on-chain. _Executor: Codex_
- [x] 13.4 Add/update focused component tests and run OpenSpec validation. _Executor: Codex_

## 14. Home Protocol Glass Refresh (Post-test Feedback)

- [x] 14.1 Replace the `/` first viewport from the enclosed Editorial Mono frame to a Protocol Glass surface aligned with `/arena`, `/agents`, and `/my`; remove the heavy black framed grid impression. _Executor: worker-codex → Architecture Codex fallback_
- [x] 14.2 Add prominent `Enter Arena` and `View Agents` hero calls to action while keeping locked homepage copy and KPI data flow. _Executor: worker-codex → Architecture Codex fallback_
- [x] 14.3 Restyle the KPI strip as a lightweight live tape/protocol metrics row instead of a boxed editorial grid. _Executor: worker-codex → Architecture Codex fallback_
- [x] 14.4 Add/update focused home component and E2E tests, run OpenSpec validation, and perform desktop/mobile screenshot verification. _Executor: worker-codex + review-codex_

## Acceptance Criteria (Stage 6 verification gates)

- All Codex tasks committed atomically with green tests at each commit
- `npm test` + `npm run test:contracts` + `npm run test:e2e` all pass
- `openspec validate redesign-as-showcase-with-agent-showdown --strict --no-interactive` passes
- Manual smoke matches Chunk 10 verification checklist
- ShowdownArena address recorded in production env
- README + circle-submission.md updated
