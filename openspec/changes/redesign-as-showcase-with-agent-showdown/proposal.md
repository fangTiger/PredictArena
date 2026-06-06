# Change: Redesign PredictArena as Arc Builder Showcase with Agent Showdown

## Why

PredictArena's current 10-segment workbench layout confuses visitors and obscures its differentiating value. The real business goal is to apply for the Arc Discord builder role, which requires a 30-second-comprehensible demo with strong on-chain narrative. This change repositions the site as a showcase, collapses the IA to 4 public routes + 1 hidden `/admin`, introduces a new differentiating Hook (Agent Showdown — two AI agents bet against each other with USDC bonds on Arc), and binds all user-visible data to the connected wallet.

## What Changes

- **BREAKING** — Information architecture collapses from 10 public segments to 4 (Home, Arena, Agents, My) + 1 hidden `/admin` subtree. Removes `/intelligence`, `/autonomy`, `/leaderboard`, `/signals`, `/demo-resolution`, `/proof`. Operator surfaces move under `/admin/*`.
- **BREAKING** — Homepage shifts from `redirect('/arena')` to a full Arena Signal Glass landing page with hero, data strip, narrative, and perceptible CSS-only signal motion.
- **NEW** — On-chain feature "Agent Showdown" via new `ShowdownArena.sol` contract on Arc Testnet. Two AI agents holding opposite positions on the same market commit USDC bonds; winner takes both bonds.
- **NEW** — `/my` page binding user data (follows, bonds, tx history) to connected wallet via a new `WalletBindingsFacade`.
- **NEW** — Visual style hybrid: Arena Signal Glass on `/`, Glass Neon on `/arena`, `/agents`, `/my`, minimal greyscale on `/admin`.
- **NEW** — 3 new API endpoints: `GET /api/showdowns`, `POST /api/showdowns/discover` (admin), `POST /api/showdowns/[id]/settle` (admin), `GET /api/wallet/[address]/summary`.
- **NEW** — New admin auth pattern: `ADMIN_ACCESS_TOKEN` env + `pa_admin` cookie + `/admin/login` form.
- **MODIFIED** — Cron route (`app/api/cron/run-autonomous-agents/route.ts`) now also runs showdown discovery + settlement each cycle.
- **MODIFIED** — Arena page (`/arena`) rewritten around showdown grid; intelligence/watchlist/paper-follow UI removed (backend read models preserved).
- **REMOVED** — 13 UI requirements (Market Intelligence Workspace UI, Signal Research UI, Segmented Agent Comparison UI, Paper Follow UI, Saved Intelligence Controls UI, Watchlist UI, Intelligence Alert Center UI, Daily Research Queue UI) — backend read models preserved per spec §2.

## Impact

- **Affected specs:** `predictarena`, `predictarena-ui` (both have substantial deltas — see `specs/predictarena/spec.md` and `specs/predictarena-ui/spec.md` in this change)
- **Affected code:**
  - New: `contracts/ShowdownArena.sol`, `lib/persistence/showdowns.ts` + `showdownsLocal.ts` + `showdownsSupabase.ts`, `lib/services/showdownDiscovery.ts` + `showdownSettlement.ts`, `lib/services/homeData.ts`, `lib/persistence/walletBindings.ts`, `lib/arc/blockNumber.ts`, `lib/contracts/showdownArena.ts`, `lib/config/admin-auth.ts`, `lib/config/homeCopy.ts`, `app/page.tsx` (rewrite), `app/admin/*` (new tree), `app/admin-login/page.tsx` + `actions.ts`, `app/agents/*` (new), `app/my/*` (new), `app/api/showdowns/*` (new), `app/api/wallet/[address]/summary/route.ts` (new), `components/TopNav.tsx`, `components/HomeHero.tsx`, `components/HomeDataStrip.tsx`, `components/HomeNarrative.tsx`, `components/HomeTransitionFooter.tsx`, `components/ShowdownCard.tsx`, `components/ShowdownGrid.tsx`, `components/PendingFollowsRow.tsx`, `components/MyDashboard.tsx`, `components/MyOverviewStrip.tsx`, `components/MyFollowsTable.tsx`, `components/MyTxHistoryTable.tsx`, `components/AgentProfileCard.tsx`, `components/AgentReputationPanel.tsx`, `components/AdminShell.tsx`, `scripts/deploy-showdown-arena.ts`
  - Modified: `app/arena/page.tsx`, `components/arena-dashboard.tsx` (major rewrite), `components/WalletConnectButton.tsx` (accountsChanged wiring), `app/globals.css` (design tokens), `app/layout.tsx`, `next.config.ts` (rewrite for /admin/login), `app/api/cron/run-autonomous-agents/route.ts` (showdown integration), `README.md`, `docs/circle-submission.md`
  - Deleted: `app/intelligence/`, `app/autonomy/`, `app/leaderboard/`, `app/signals/`, `app/demo-resolution/`, `app/proof/`, `app/agents/[agentName]/` (legacy)
- **New env vars:** `ADMIN_ACCESS_TOKEN`, `NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS`, `SHOWDOWN_BOND_MICRO_USDC` (default 250_000_000), `SHOWDOWN_DEADLINE_WINDOW_SEC` (default 86400), `SHOWDOWN_PERSISTENCE_MODE` (`local`|`supabase`, default `local`), `SHOWDOWN_LOCAL_FILE` (override path)
- **Prerequisite:** `add-wallet-funded-follows` change must be archived first (its 11 tasks are already complete; archival merges its delta into `specs/`).

## Reference Documents

- **Design doc** (architectural decisions, Spec Delta Map): `docs/superpowers/specs/2026-06-03-predictarena-redesign-design.md`
- **Implementation plan** (10 chunks, ~165 tasks): `docs/superpowers/plans/2026-06-03-predictarena-redesign.md`
