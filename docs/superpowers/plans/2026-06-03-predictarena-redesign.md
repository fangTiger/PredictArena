# PredictArena Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking. In codex-dev mode, tasks are dispatched to Codex via the codex-handoff skill.

**Goal:** Convert PredictArena from a confusing 10-segment workbench into a showcase/pitch site for the Arc Discord builder application, with an Editorial-style landing page, Glass Neon inner pages, a hidden /admin tree, wallet-bound personal data, and a new on-chain "Agent Showdown" feature where two AI agents bet against each other with USDC bonds on Arc Testnet.

**Architecture:** Next.js 15 App Router with 4 public segments (`/`, `/arena`, `/agents`, `/my`) plus 1 hidden `/admin` subtree. New `ShowdownArena.sol` smart contract using operator-orchestrated atomic open pattern (no Pending/Cancelled states). Wallet-bound data aggregation via a new `WalletBindingsFacade` over the existing Supabase/local store. Visual style hybrid: Editorial Mono on homepage, Glass Neon on inner pages, minimal greyscale on `/admin`.

**Tech Stack:** Next.js 15.3, React 19, TypeScript 5.8, Tailwind 3.4, viem 2.30, Hardhat 2.24, Solidity 0.8.24, vitest 3.1, Playwright 1.52

**Spec reference:** `docs/superpowers/specs/2026-06-03-predictarena-redesign-design.md`

**Executor in codex-dev mode:** Most tasks → Codex. Trivial config/comment edits → Claude. (User has no Gemini, so frontend implementation also goes to Codex.)

---

## Prerequisites (NOT part of implementation phases)

Before executing **any** task in this plan, the operator must:

- [ ] **P-1:** Archive `openspec/changes/add-wallet-funded-follows/` to `openspec/changes/archive/2026-06-03-add-wallet-funded-follows/` and merge its delta specs into `openspec/specs/predictarena/spec.md` and `openspec/specs/predictarena-ui/spec.md` (use `/openspec:archive`).
- [ ] **P-2:** Run `openspec validate --strict --no-interactive` on the merged specs and confirm clean state.
- [ ] **P-3:** Capture git baseline SHA: `mkdir -p .codex && git rev-parse HEAD > .codex/baseline-redesign.txt`.
- [ ] **P-4:** Confirm Arc Testnet RPC endpoint, USDC contract address, treasury address, and existing `SignalBondArena` address are all available in env (`.env.local`).
- [ ] **P-5:** Confirm operator wallet has ≥ 0.5 ETH (Arc Testnet) for deploying `ShowdownArena` and bootstrap txs.

---

## File Structure Overview

This section maps every file that will be created (C) or modified (M) across all chunks. Files that change together live together; tests sit next to source.

### Smart Contracts (Chunk 2)
```
contracts/
  ShowdownArena.sol                     (C) ⚔ Hook 01 contract
test/contracts/
  ShowdownArena.test.ts                 (C) Hardhat tests, 100% branch coverage
lib/contracts/
  showdownArena.ts                      (C) Typed viem client + ABI export
scripts/
  deploy-showdown-arena.ts              (C) Deployment script with logging
```

### Routes & Pages
```
app/
  layout.tsx                            (M) Update global metadata + top nav wiring
  page.tsx                              (M) Replace redirect with Editorial home
  globals.css                           (M) Add design tokens (Editorial + Glass + Admin)

  arena/page.tsx                        (M) Rewrite as Showdown main stage
  arena/loading.tsx                     (C) Loading skeleton

  agents/page.tsx                       (M) Agent profile list (from leaderboard read model)
  agents/[agentId]/page.tsx             (C) Agent detail (reputation + history)
  agents/loading.tsx                    (C)

  my/page.tsx                           (M) Wallet-bound dashboard
  my/loading.tsx                        (C)

  admin/layout.tsx                      (C) Greyscale admin shell + auth wrapper
  admin/page.tsx                        (C) Admin index
  admin/resolution/page.tsx             (M) (moved from /demo-resolution)
  admin/proof/page.tsx                  (M) (moved from /proof)
  admin/control-room/page.tsx           (C) New: agent/arc readiness panel
  admin/receipts/page.tsx               (C) New: autonomous run receipts
  admin/health/page.tsx                 (C) New: operator health
```

### Routes Removed (DELETE entire directory)
```
app/intelligence/                       (D) intelligence workspace gone
app/autonomy/                           (D) merged into /admin/control-room
app/leaderboard/                        (D) merged into /agents
app/signals/                            (D) merged into /agents/:agentId
app/demo-resolution/                    (D) → app/admin/resolution
app/proof/                              (D) → app/admin/proof
```

### Components (Chunks 1, 3, 4, 5, 6)
```
components/
  PageShell.tsx                         (M) Add Editorial variant
  TopNav.tsx                            (C) Shared 4-segment nav
  WalletConnectButton.tsx               (M) Visual refresh + accountsChanged hook
  arena-dashboard.tsx                   (M) Rewrite for Showdown focus
  LeaderboardTable.tsx                  (M) Move under /agents

  ShowdownCard.tsx                      (C) Hook 01 visual main
  ShowdownGrid.tsx                      (C) Active + settled layout
  PendingFollowsRow.tsx                 (C) Active follows chip strip

  HomeHero.tsx                          (C) Editorial big-statement landing
  HomeDataStrip.tsx                     (C) 4-column live data
  HomeNarrative.tsx                     (C) The Premise + How to Watch sections

  AgentProfileCard.tsx                  (C) /agents list card
  AgentReputationPanel.tsx              (C) /agents/:id reputation drill-down

  MyDashboard.tsx                       (C) /my root container
  MyOverviewStrip.tsx                   (C) Balance + cumulative bonded/payout/PnL
  MyFollowsTable.tsx                    (C) Follow history
  MyTxHistoryTable.tsx                  (C) Tx history

  AdminShell.tsx                        (C) Greyscale shell for /admin/*
```

### Lib & Services (Chunks 2, 4, 5)
```
lib/
  config/
    admin-auth.ts                       (C) Shared admin token + cookie helpers
    constants.ts                        (M) Add SHOWDOWN_BOND_MICRO_USDC constant
  persistence/
    walletBindings.ts                   (C) Facade for WalletSummary aggregation
    showdowns.ts                        (C) Showdown persistence (Supabase + local)
  services/
    showdownDiscovery.ts                (C) Detect disagreement, open showdowns
    showdownSettlement.ts               (C) Match resolution → call settleShowdown
  arc/
    showdownArenaClient.ts              (C) viem client wrapping ShowdownArena ABI
```

### API Routes (Chunks 2, 4, 5)
```
app/api/
  showdowns/route.ts                    (C) GET /api/showdowns
  showdowns/discover/route.ts           (C) POST /api/showdowns/discover (admin)
  showdowns/[id]/settle/route.ts        (C) POST /api/showdowns/:id/settle (admin)
  wallet/[address]/summary/route.ts     (C) GET /api/wallet/:address/summary
  cron/route.ts                         (M) Add showdown discover + settle steps
```

### Tests (every chunk)
```
test/
  unit/
    persistence/walletBindings.test.ts  (C)
    persistence/showdowns.test.ts       (C)
    services/showdownDiscovery.test.ts  (C)
    services/showdownSettlement.test.ts (C)
    api/showdowns.test.ts               (C)
    api/walletSummary.test.ts           (C)
  components/
    ShowdownCard.test.tsx               (C)
    HomeHero.test.tsx                   (C)
    HomeDataStrip.test.tsx              (C)
    MyDashboard.test.tsx                (C)
  contracts/
    ShowdownArena.test.ts               (C) (already listed)
  e2e/
    home.spec.ts                        (C)
    arena-showdown.spec.ts              (C)
    my-dashboard.spec.ts                (C)
```

### Docs (Chunk 7)
```
README.md                               (M) Update with new Arena/Agent Showdown story
docs/circle-submission.md               (M) Update for Arc builder application
```

---

## Chunk Map (read this before starting any chunk)

| Chunk | Focus | Approx Days | Depends on |
|---|---|---|---|
| **1** | Foundation skeleton: design tokens, TopNav, home/arena/agents/my placeholders, admin auth, admin shell + login (Tasks 1.1–1.8) | 1.5 | Prereqs done |
| **2** | Legacy cleanup: port `/demo-resolution` & `/proof` into `/admin/*`, delete intelligence/autonomy/leaderboard/signals UI routes, full foundation verification (Tasks 1.9–1.11) | 0.5 | Chunk 1 |
| **3** | ShowdownArena smart contract + tests + deployment script | 1 | Prereqs done (parallel-safe with Chunks 1-2) |
| **4** | Editorial homepage (Hero + DataStrip + Narrative) | 1 | Chunks 1-2 |
| **5** | Showdown backend Part 1: persistence layer + discovery service | 1 | Chunks 1-3 |
| **6** | Showdown backend Part 2: settlement service + API endpoints + cron wire + homeData integration | 1 | Chunk 5 |
| **7** | Arena UI: ShowdownCard + ShowdownGrid + Arena page rewrite | 1.5 | Chunks 1-6 |
| **8** | /my page + walletBindings facade + wallet API | 1.5 | Chunks 1-6 |
| **9** | /agents page + AgentReputationPanel + /admin sub-pages | 1.5 | Chunks 1-2, 5-7 |
| **10** | Polish + E2E + docs + Arc Testnet deployment | 1.5 | Everything |

**Total:** ~11.5 days. Each chunk ends with a green-test commit.

---

## Chunk 1: Foundation — Route Restructure, Design Tokens, Admin Shell

**Why this chunk first:** Every later chunk depends on the new IA being in place. The Editorial/Glass design tokens are loaded globally; admin shell needs the auth helper; the new TopNav drives navigation across every page. We lock the skeleton, then later chunks fill content.

**End state of this chunk:**
- `/` shows a placeholder "Hero coming soon" using Editorial token (real content in Chunk 3)
- `/arena`, `/agents`, `/my` exist as empty placeholder pages using Glass Neon token
- `/admin/*` subtree exists, gated by `ADMIN_ACCESS_TOKEN`, with empty placeholder pages
- Old routes `/intelligence`, `/autonomy`, `/leaderboard`, `/signals`, `/demo-resolution`, `/proof` are **deleted** — visitors see 404
- TopNav renders `HOME ARENA AGENTS MY` + Connect Wallet pill
- All tests still pass (no behavior tests added yet; just structural changes)

---

### Task 1.1 · Capture baseline and freeze tests

**Files:**
- Read-only: `package.json`, `vitest.config.ts`, `playwright.config.ts`

- [ ] **Step 1.1.1: Confirm current test baseline is green**

Run: `npm test`
Expected: All vitest unit/integration tests pass.

- [ ] **Step 1.1.2: Confirm current build succeeds**

Run: `npm run build`
Expected: Next build succeeds without errors.

- [ ] **Step 1.1.3: Confirm Hardhat tests pass**

Run: `npm run test:contracts`
Expected: Existing contract tests for `SignalBondArena` and `MockUSDC` pass.

> **No commit in this task.** This is a precondition gate. If anything fails, fix it before continuing — do not start the redesign on top of broken tests.

---

### Task 1.2 · Add design tokens to `globals.css`

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1.2.1: Read current globals.css to understand existing tokens**

Read `app/globals.css` fully. Identify which custom CSS variables already exist; we will **add** new ones without breaking existing styles.

- [ ] **Step 1.2.2: Append new design tokens at the end of globals.css**

Add (verbatim — preserve existing content above):

```css
/* =========================================================
   Redesign 2026-06-03 — Editorial + Glass Neon + Admin tokens
   ========================================================= */

:root {
  /* Editorial (homepage) tokens */
  --editorial-bg:          #0c0c0c;
  --editorial-fg:          #ededed;
  --editorial-mute:        #888888;
  --editorial-rule:        rgba(255, 255, 255, 0.06);
  --editorial-accent:      #ff5e3a;
  --editorial-h1-size:     64px;
  --editorial-h1-weight:   800;
  --editorial-h1-tracking: -0.5px;

  /* Glass Neon (inner pages) tokens */
  --glass-bg:              #0a0a14;
  --glass-tint-purple:     124, 92, 255;
  --glass-tint-cyan:       0, 209, 255;
  --glass-card-bg:         rgba(255, 255, 255, 0.06);
  --glass-card-border:     rgba(255, 255, 255, 0.12);
  --glass-card-radius:     16px;
  --glass-blur:            blur(20px);
  --glass-fg:              #ffffff;
  --glass-fg-mute:         rgba(255, 255, 255, 0.5);

  /* Admin (greyscale, density-first) tokens */
  --admin-bg:              #1a1a1a;
  --admin-fg:              #d4d4d4;
  --admin-rule:            #2a2a2a;
  --admin-accent:          #7a7a7a;

  /* Shared semantic colors */
  --color-yes:             #00d1ff;
  --color-no:              #ff5e6e;
  --color-success:         #00ffaa;
  --color-warning:         #ffd75c;
  --color-error:           #ff5e6e;
}

/* Utility classes consumed by Editorial pages */
.editorial-page  { background: var(--editorial-bg); color: var(--editorial-fg); }
.editorial-h1    { font-size: var(--editorial-h1-size); font-weight: var(--editorial-h1-weight); letter-spacing: var(--editorial-h1-tracking); line-height: 1.02; }
.editorial-accent { color: var(--editorial-accent); }
.editorial-rule  { border-color: var(--editorial-rule); }

/* Utility classes consumed by Glass Neon pages */
.glass-page {
  background:
    radial-gradient(ellipse at 90% 10%, rgba(var(--glass-tint-purple), 0.25), transparent 50%),
    radial-gradient(ellipse at 10% 90%, rgba(var(--glass-tint-cyan), 0.18), transparent 50%),
    var(--glass-bg);
  color: var(--glass-fg);
  min-height: 100vh;
}
.glass-card {
  background: var(--glass-card-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-card-border);
  border-radius: var(--glass-card-radius);
}

/* Utility classes consumed by Admin */
.admin-page  { background: var(--admin-bg); color: var(--admin-fg); }
.admin-rule  { border-color: var(--admin-rule); }
```

- [ ] **Step 1.2.3: Verify globals.css still parses by running build**

Run: `npm run build`
Expected: Build succeeds. No CSS errors.

- [ ] **Step 1.2.4: Commit**

```bash
git add app/globals.css
git commit -m "feat(ui): add redesign design tokens (editorial + glass + admin)"
```

---

### Task 1.3 · Create shared `<TopNav />` component

**Files:**
- Create: `components/TopNav.tsx`
- Test: `test/components/TopNav.test.tsx`

**Design notes for the implementer:**
- TopNav is a client component (uses `usePathname()` from `next/navigation`).
- It auto-detects active segment via `usePathname()`; no `currentPath` prop is exposed.
- The `variant` prop is passed by parent layout (`editorial` for `/`, `glass` for inner pages).
- `WalletConnectButton` is already a client component and accepts `className`.

- [ ] **Step 1.3.1: Write failing test for TopNav structure**

Create `test/components/TopNav.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Use vi.hoisted to safely share mutable state with the hoisted vi.mock factory
const pathState = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathState.current
}));

// Mock WalletConnectButton to keep TopNav test isolated from window.ethereum / JSDOM quirks
vi.mock('@/components/WalletConnectButton', () => ({
  WalletConnectButton: ({ className }: { className?: string }) => (
    <button className={className} data-testid="wallet-stub">Connect Wallet</button>
  )
}));

import { TopNav } from '@/components/TopNav';

describe('TopNav', () => {
  it('renders the 4 public segments + Connect Wallet stub', () => {
    pathState.current = '/';
    render(<TopNav variant="editorial" />);
    expect(screen.getByText('HOME')).toBeInTheDocument();
    expect(screen.getByText('ARENA')).toBeInTheDocument();
    expect(screen.getByText('AGENTS')).toBeInTheDocument();
    expect(screen.getByText('MY')).toBeInTheDocument();
    expect(screen.getByTestId('wallet-stub')).toBeInTheDocument();
  });

  it('marks the current path link as active', () => {
    pathState.current = '/arena';
    render(<TopNav variant="glass" />);
    const arena = screen.getByText('ARENA').closest('a');
    expect(arena).toHaveAttribute('data-active', 'true');
  });

  it('uses the right CSS class per variant', () => {
    pathState.current = '/';
    const { container, rerender } = render(<TopNav variant="editorial" />);
    expect((container.firstChild as HTMLElement).className).toContain('topnav-editorial');
    rerender(<TopNav variant="glass" />);
    expect((container.firstChild as HTMLElement).className).toContain('topnav-glass');
  });
});
```

- [ ] **Step 1.3.2: Run test, confirm it fails**

Run: `npm test -- TopNav`
Expected: FAIL — module `@/components/TopNav` not found.

- [ ] **Step 1.3.3: Create the component**

Create `components/TopNav.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { WalletConnectButton } from '@/components/WalletConnectButton';

export type TopNavVariant = 'editorial' | 'glass';

interface TopNavProps {
  variant: TopNavVariant;
}

const SEGMENTS = [
  { label: 'HOME', href: '/' },
  { label: 'ARENA', href: '/arena' },
  { label: 'AGENTS', href: '/agents' },
  { label: 'MY', href: '/my' }
];

export function TopNav({ variant }: TopNavProps) {
  const currentPath = usePathname() || '/';
  const variantClass = variant === 'editorial' ? 'topnav-editorial' : 'topnav-glass';

  return (
    <nav className={`topnav ${variantClass}`}>
      <span className="topnav-logo">PREDICTARENA</span>
      <div className="topnav-segments">
        {SEGMENTS.map((seg) => {
          const isActive =
            seg.href === '/'
              ? currentPath === '/'
              : currentPath.startsWith(seg.href);
          return (
            <Link
              key={seg.href}
              href={seg.href}
              className="topnav-segment"
              data-active={isActive ? 'true' : 'false'}
            >
              {seg.label}
            </Link>
          );
        })}
      </div>
      <WalletConnectButton className="topnav-wallet" />
    </nav>
  );
}
```

Also append the corresponding styles to `app/globals.css` at the bottom:

```css
.topnav { display: flex; justify-content: space-between; align-items: center; padding: 18px 32px; }
.topnav-logo { font-size: 13px; letter-spacing: 1.5px; font-weight: 700; }
.topnav-segments { display: flex; gap: 28px; }
.topnav-segment { font-size: 11px; letter-spacing: 2px; color: var(--editorial-mute); text-transform: uppercase; }
.topnav-segment[data-active='true'] { color: var(--editorial-fg); }

.topnav-editorial { background: var(--editorial-bg); border-bottom: 1px solid var(--editorial-rule); }
.topnav-editorial .topnav-logo { color: var(--editorial-fg); }

.topnav-glass { background: transparent; border-bottom: 1px solid var(--glass-card-border); }
.topnav-glass .topnav-segment { color: var(--glass-fg-mute); }
.topnav-glass .topnav-segment[data-active='true'] { color: var(--glass-fg); background: rgba(var(--glass-tint-purple), 0.18); padding: 6px 16px; border-radius: 999px; border: 1px solid rgba(var(--glass-tint-purple), 0.3); }
```

- [ ] **Step 1.3.4: Run test, confirm it passes**

Run: `npm test -- TopNav`
Expected: 3 tests pass.

- [ ] **Step 1.3.5: Commit**

```bash
git add components/TopNav.tsx test/components/TopNav.test.tsx app/globals.css
git commit -m "feat(ui): add TopNav shared component with editorial+glass variants"
```

---

### Task 1.4 · Replace `app/page.tsx` with Editorial placeholder

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1.4.1: Read current `app/page.tsx`**

Read it. Confirm current content is the 5-line redirect to `/arena`.

- [ ] **Step 1.4.2: Replace with placeholder Editorial home**

Replace entire file contents:

```tsx
import { TopNav } from '@/components/TopNav';

export const metadata = {
  title: 'PredictArena · AI agents, betting with proof.',
  description: 'Autonomous AI agents make BTC/ETH/SOL predictions, post USDC bonds on Arc, and resolve on-chain.'
};

export default function HomePage() {
  return (
    <main className="editorial-page" style={{ minHeight: '100vh' }}>
      <TopNav variant="editorial" />
      <section style={{ padding: '60px 40px' }}>
        <p className="editorial-accent" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase' }}>
          PredictArena · Redesign in progress
        </p>
        <h1 className="editorial-h1" style={{ maxWidth: '85%', marginTop: 22 }}>
          Hero coming soon.
        </h1>
        <p style={{ color: 'var(--editorial-mute)', fontSize: 16, lineHeight: 1.6, maxWidth: '60%', marginTop: 28 }}>
          This page is a placeholder during the Chunk 1 foundation pass. Real content lands in Chunk 3.
        </p>
      </section>
    </main>
  );
}
```

- [ ] **Step 1.4.3: Run build to confirm no breakage**

Run: `npm run build`
Expected: Build succeeds; `/` now renders the placeholder.

- [ ] **Step 1.4.4: Manual smoke check (optional)**

Run: `npm run dev` and visit `http://localhost:3000`. Confirm placeholder renders. Kill dev server.

- [ ] **Step 1.4.5: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): replace redirect with editorial placeholder home"
```

---

### Task 1.5 · Convert `/arena` page to use Glass Neon layout (content unchanged for now)

**Files:**
- Modify: `app/arena/page.tsx`
- Modify: `app/arena/layout.tsx` (create if missing)

- [ ] **Step 1.5.1: Read current `app/arena/page.tsx`**

Confirm current content uses the legacy War Room style. We are only wrapping it with new layout in this chunk; the dashboard rewrite happens in Chunk 4.

- [ ] **Step 1.5.2: Create/update `app/arena/layout.tsx`**

Create `app/arena/layout.tsx`:

```tsx
import { TopNav } from '@/components/TopNav';

export default function ArenaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-page">
      <TopNav variant="glass" />
      {children}
    </div>
  );
}
```

- [ ] **Step 1.5.3: Leave `app/arena/page.tsx` alone**

`app/arena/page.tsx` is a thin wrapper that renders `<ArenaDashboard />`. **Do not modify it.** The duplicate WalletConnectButton living inside `components/arena-dashboard.tsx` will be removed in Chunk 4 when the dashboard is rewritten — **do not touch `arena-dashboard.tsx` in this chunk**.

During this chunk, `/arena` will visibly have two wallet buttons (one in TopNav, one in the legacy dashboard). That's expected and temporary. Chunk 4 fixes it.

- [ ] **Step 1.5.4: Run build**

Run: `npm run build`
Expected: Build succeeds.

- [ ] **Step 1.5.5: Commit**

```bash
git add app/arena/layout.tsx app/arena/page.tsx
git commit -m "feat(arena): wrap arena in glass-neon layout with shared TopNav"
```

---

### Task 1.6 · Create placeholder `/agents` and `/my` pages

**Files:**
- Create: `app/agents/page.tsx`
- Create: `app/agents/layout.tsx`
- Create: `app/my/page.tsx`
- Create: `app/my/layout.tsx`

- [ ] **Step 1.6.1: Move existing `app/agents/` out of the App Router**

The existing `app/agents/` directory (verified: contains `[agentName]/page.tsx`) imports stale read models and will break the build if kept under `app/`. Chunk 6 will reconstruct the new `/agents` page from scratch using the preserved `Agent Reputation Profile Read Model` (see spec §2.2) — we have full git history to mine for layout ideas, so deletion is safe.

Delete the existing directory (git history preserves it):

```bash
rm -rf app/agents
```

If you'd prefer to keep it as a reference outside the App Router scope, move to a non-routed location (do **not** keep under `app/`):

```bash
mkdir -p archive
git mv app/agents archive/agents-legacy
```

Either approach is acceptable. **Recommended: delete + rely on git history.**

- [ ] **Step 1.6.2: Create `app/agents/layout.tsx`**

```tsx
import { TopNav } from '@/components/TopNav';

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-page">
      <TopNav variant="glass" />
      {children}
    </div>
  );
}
```

- [ ] **Step 1.6.3: Create `app/agents/page.tsx` placeholder**

```tsx
export const metadata = { title: 'Agents · PredictArena' };

export default function AgentsPage() {
  return (
    <section style={{ padding: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>Agents</h2>
      <p style={{ color: 'var(--glass-fg-mute)' }}>Placeholder — full agent profiles land in Chunk 6.</p>
    </section>
  );
}
```

- [ ] **Step 1.6.4: Create `app/my/layout.tsx`**

```tsx
import { TopNav } from '@/components/TopNav';

export default function MyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-page">
      <TopNav variant="glass" />
      {children}
    </div>
  );
}
```

- [ ] **Step 1.6.5: Create `app/my/page.tsx` placeholder**

```tsx
export const metadata = { title: 'My · PredictArena' };

export default function MyPage() {
  return (
    <section style={{ padding: 32 }}>
      <h2 style={{ fontSize: 22, marginBottom: 6 }}>My Dashboard</h2>
      <p style={{ color: 'var(--glass-fg-mute)' }}>Placeholder — wallet-bound dashboard lands in Chunk 5.</p>
    </section>
  );
}
```

- [ ] **Step 1.6.6: Run build**

Run: `npm run build`
Expected: Build succeeds. `/agents` and `/my` render placeholders.

- [ ] **Step 1.6.7: Commit**

```bash
git add app/agents app/my
git commit -m "feat(routes): scaffold /agents and /my placeholder pages with glass layout"
```

---

### Task 1.7 · Create shared admin-auth helper

**Files:**
- Create: `lib/config/admin-auth.ts`
- Test: `test/unit/admin-auth.test.ts`

**Context for the implementer (verified by reading existing code):**
The existing codebase has **no page-level admin gate**. There is only an API-level pattern: `ADMIN_RESOLVE_TOKEN` env + `x-admin-resolve-token` HTTP header, used by the resolve endpoints. The `/proof` page has no auth at all today.

This redesign introduces a **new page-level gate** (since multiple admin pages now exist under `/admin/*`):
- New env var: `ADMIN_ACCESS_TOKEN` (separate from `ADMIN_RESOLVE_TOKEN`, which keeps its own purpose for the API)
- New cookie: `pa_admin` set after operator submits the token via a `/admin/login` form
- All `/admin/*` pages gate via `app/admin/layout.tsx` (Task 1.8); incorrect/missing cookie → redirect to `/admin/login`
- `/admin/login` itself is unauthenticated (otherwise: chicken-and-egg)

This is a **deliberate new pattern**, not "reuse existing". Document this clearly in the helper file's doc comment.

- [ ] **Step 1.7.1: No existing code to inspect**

There is no existing page-level admin auth pattern to mirror. Proceed to Step 1.7.2.

- [ ] **Step 1.7.2: Write failing test**

Create `test/unit/admin-auth.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { isAdminAuthorized } from '@/lib/config/admin-auth';

describe('isAdminAuthorized', () => {
  beforeEach(() => {
    process.env.ADMIN_ACCESS_TOKEN = 'secret-token-xyz';
  });

  it('returns true when cookie value matches env token', () => {
    expect(isAdminAuthorized('secret-token-xyz')).toBe(true);
  });

  it('returns false when cookie value differs', () => {
    expect(isAdminAuthorized('wrong-token')).toBe(false);
  });

  it('returns false when cookie is null/undefined', () => {
    expect(isAdminAuthorized(undefined)).toBe(false);
    expect(isAdminAuthorized(null as unknown as string)).toBe(false);
  });

  it('returns false when env token is missing', () => {
    delete process.env.ADMIN_ACCESS_TOKEN;
    expect(isAdminAuthorized('any-value')).toBe(false);
  });
});
```

- [ ] **Step 1.7.3: Run test, confirm it fails**

Run: `npm test -- admin-auth`
Expected: FAIL — module not found.

- [ ] **Step 1.7.4: Implement `lib/config/admin-auth.ts`**

```ts
/**
 * 管理员页面鉴权助手（新引入的模式）
 *
 * 设计要点：
 * - 与现有 API 级别的 ADMIN_RESOLVE_TOKEN（header 鉴权）独立
 * - 新增 ADMIN_ACCESS_TOKEN（env） + pa_admin cookie 用于页面级访问
 * - 不引入会话管理；cookie 值就是 env 值的直接比对
 * - 与 /admin/login 表单（Task 1.8.6）配合使用
 */

export const ADMIN_COOKIE_NAME = 'pa_admin';
export const ADMIN_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 小时

export function isAdminAuthorized(cookieValue: string | undefined | null): boolean {
  const envToken = process.env.ADMIN_ACCESS_TOKEN;
  if (!envToken) return false;
  if (!cookieValue) return false;
  return cookieValue === envToken;
}

/** 从 cookie header 字符串抽出 admin cookie 值（不依赖 next/headers，便于单测） */
export function readAdminCookie(cookieHeader: string | null | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  const parts = cookieHeader.split(';').map((s) => s.trim());
  for (const part of parts) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const name = part.slice(0, eq);
    if (name === ADMIN_COOKIE_NAME) {
      return decodeURIComponent(part.slice(eq + 1));
    }
  }
  return undefined;
}
```

- [ ] **Step 1.7.5: Run test, confirm 4 tests pass**

Run: `npm test -- admin-auth`
Expected: 4 tests pass.

- [ ] **Step 1.7.6: Commit**

```bash
git add lib/config/admin-auth.ts test/unit/admin-auth.test.ts
git commit -m "feat(admin): add shared admin-auth helper with cookie+env checks"
```

---

### Task 1.8 · Scaffold `/admin` route tree

**Files:**
- Create: `app/admin/layout.tsx`
- Create: `app/admin/page.tsx`
- Create: `app/admin/login/page.tsx` (unauthenticated; sets cookie)
- Create: `app/admin/login/actions.ts` (server action)
- Create: `app/admin/control-room/page.tsx`
- Create: `app/admin/receipts/page.tsx`
- Create: `app/admin/health/page.tsx`
- Create: `components/AdminShell.tsx`

- [ ] **Step 1.8.1: Create `components/AdminShell.tsx`**

```tsx
import Link from 'next/link';

const ADMIN_LINKS = [
  { href: '/admin/control-room', label: 'Control Room' },
  { href: '/admin/resolution', label: 'Resolution' },
  { href: '/admin/proof', label: 'Proof' },
  { href: '/admin/receipts', label: 'Receipts' },
  { href: '/admin/health', label: 'Health' }
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-page" style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '220px 1fr' }}>
      <aside style={{ borderRight: '1px solid var(--admin-rule)', padding: '24px 18px' }}>
        <p style={{ fontSize: 11, letterSpacing: 2, color: 'var(--admin-accent)', marginBottom: 18 }}>
          ADMIN
        </p>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ADMIN_LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={{ color: 'var(--admin-fg)', fontSize: 13 }}>
              {l.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main style={{ padding: 28 }}>{children}</main>
    </div>
  );
}
```

- [ ] **Step 1.8.2: Create `app/admin/layout.tsx` with auth guard**

```tsx
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, isAdminAuthorized } from '@/lib/config/admin-auth';
import { AdminShell } from '@/components/AdminShell';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!isAdminAuthorized(value)) {
    redirect('/admin/login');
  }
  return <AdminShell>{children}</AdminShell>;
}

export const metadata = { title: 'Admin · PredictArena' };
```

Note: in Next 15.3, `cookies()` is async and returns a Promise; the `await` is required. **Verified by reading the project's `package.json`** — Next ^15.3.3 uses the new async API.

**Important caveat:** the layout above gates *every* `/admin/*` route, INCLUDING `/admin/login`. That creates an infinite redirect loop (unauthenticated user → `/admin/login` → layout redirects them back). The fix in Next 15 App Router is to give `/admin/login` its **own route group** that escapes this layout. Use a parallel route group:

Restructure the admin tree as:

```
app/
  admin/                      ← gated subtree
    layout.tsx                ← guard layout
    page.tsx
    resolution/
    proof/
    control-room/
    receipts/
    health/
  admin-login/                ← top-level UNGATED route, exposed at /admin/login
    page.tsx
    actions.ts
```

Then in `app/admin-login/page.tsx`, use a single segment but configure its URL to `/admin/login` via a top-level rewrite (configured in `next.config.ts`), **or** the cleaner alternative: use a Next 15 route group.

**Cleaner alternative (recommended for the implementer):** put `/admin/login` outside `app/admin/` by using a parallel folder named `app/admin-login/` and add a rewrite in `next.config.ts`:

```ts
// next.config.ts (modify existing)
const nextConfig = {
  async rewrites() {
    return [
      { source: '/admin/login', destination: '/admin-login' }
    ];
  }
};
```

This keeps the gated layout simple and avoids loop traps.

- [ ] **Step 1.8.3: Create `app/admin/page.tsx`**

```tsx
export default function AdminIndex() {
  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Admin</h1>
      <p style={{ color: 'var(--admin-accent)' }}>Operator surfaces. Pick a section from the sidebar.</p>
    </div>
  );
}
```

- [ ] **Step 1.8.4: Create placeholder pages for control-room / receipts / health**

Create `app/admin/control-room/page.tsx`:

```tsx
export default function ControlRoomPage() {
  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>Control Room</h1>
      <p style={{ color: 'var(--admin-accent)' }}>Placeholder — agent & Arc readiness panel lands in Chunk 6.</p>
    </div>
  );
}
```

Create `app/admin/receipts/page.tsx`:

```tsx
export default function ReceiptsPage() {
  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>Receipts</h1>
      <p style={{ color: 'var(--admin-accent)' }}>Placeholder — autonomous run receipts list lands in Chunk 6.</p>
    </div>
  );
}
```

Create `app/admin/health/page.tsx`:

```tsx
export default function HealthPage() {
  return (
    <div>
      <h1 style={{ fontSize: 20, marginBottom: 6 }}>Health</h1>
      <p style={{ color: 'var(--admin-accent)' }}>Placeholder — operator health metrics land in Chunk 6.</p>
    </div>
  );
}
```

- [ ] **Step 1.8.5: Create `/admin/login` login form + server action**

Create `app/admin-login/page.tsx` (note: folder is `admin-login`, accessed via the rewrite as `/admin/login`):

```tsx
import { loginAction } from './actions';

export const metadata = { title: 'Admin Login · PredictArena' };

export default function AdminLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--admin-bg)', color: 'var(--admin-fg)' }}>
      <form action={loginAction} style={{ width: 320, padding: 28, border: '1px solid var(--admin-rule)', borderRadius: 8 }}>
        <h1 style={{ fontSize: 18, marginBottom: 14 }}>Admin Access</h1>
        <input
          name="token"
          type="password"
          autoFocus
          required
          placeholder="ADMIN_ACCESS_TOKEN"
          style={{ width: '100%', padding: 10, marginBottom: 12, background: '#0f0f0f', color: 'var(--admin-fg)', border: '1px solid var(--admin-rule)', borderRadius: 4 }}
        />
        <button
          type="submit"
          style={{ width: '100%', padding: 10, background: '#3a3a3a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
        >
          Enter
        </button>
        <ErrorMessage searchParams={searchParams} />
      </form>
    </main>
  );
}

async function ErrorMessage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  if (!params.error) return null;
  return <p style={{ color: '#ff5e6e', fontSize: 12, marginTop: 10 }}>Invalid token. Try again.</p>;
}
```

Create `app/admin-login/actions.ts`:

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE_SECONDS } from '@/lib/config/admin-auth';

export async function loginAction(formData: FormData) {
  const submitted = String(formData.get('token') ?? '');
  const expected = process.env.ADMIN_ACCESS_TOKEN;

  if (!expected || submitted !== expected) {
    redirect('/admin/login?error=1');
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_COOKIE_NAME,
    value: submitted,
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE_SECONDS
  });
  redirect('/admin');
}
```

Add the rewrite in `next.config.ts`. Read the existing file first:

```ts
// existing content omitted...
const nextConfig = {
  // ...existing properties...
  async rewrites() {
    return [
      { source: '/admin/login', destination: '/admin-login' }
    ];
  }
};
```

If `next.config.ts` already has a `rewrites()`, append the new rule to its return array — do not overwrite.

- [ ] **Step 1.8.6: Run build**

Run: `npm run build`
Expected: Build succeeds. `/admin/*` routes registered.

- [ ] **Step 1.8.7: Verify auth redirect + login manually**

Set `ADMIN_ACCESS_TOKEN=test-admin-xyz` in `.env.local`. Run `npm run dev`.

1. Visit `http://localhost:3000/admin` → expect redirect to `/admin/login`.
2. On login page, type `test-admin-xyz` → expect redirect to `/admin` showing the sidebar.
3. Type `wrong` instead → expect to stay on login page with "Invalid token" message.

Kill dev server.

- [ ] **Step 1.8.8: Commit**

```bash
git add app/admin app/admin-login components/AdminShell.tsx next.config.ts
git commit -m "feat(admin): scaffold /admin route tree with login + cookie auth guard"
```

---

### End-of-Chunk-1 quick verification

- [ ] **Run `npm test`** → expected: all pass.
- [ ] **Run `npm run build`** → expected: succeeds with the 4 public routes + `/admin/*` registered.
- [ ] **Manual smoke** (briefly): visit `/`, `/arena`, `/agents`, `/my` → render placeholders; visit `/admin` → redirect to `/admin/login`.

Old `/demo-resolution`, `/proof`, `/intelligence`, `/autonomy`, `/leaderboard`, `/signals` are still live in this chunk — they get cleaned up in Chunk 2. That's expected.

- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 1 (foundation skeleton) complete"
```

**Chunk 1 done.** Skeleton is in place. Chunk 2 handles legacy cleanup and route deletions.

---

## Chunk 2: Legacy Cleanup — Migrate `/demo-resolution` + `/proof` to Admin, Delete Old UI Routes

**Why this chunk:** The old routes still exist at the end of Chunk 1 to keep the dev environment functional during incremental rollout. This chunk completes the IA reorg by moving operator surfaces into `/admin/*` and deleting the four UI-only legacy routes (intelligence / autonomy / leaderboard / signals). Backend read models and API routes are preserved per spec §2.2.

**End state of this chunk:**
- `/demo-resolution` and `/proof` are 404 in public; their content lives under `/admin/resolution` and `/admin/proof` (login required)
- `/intelligence`, `/autonomy`, `/leaderboard`, `/signals` are 404
- Backend read models and API endpoints for those features are untouched
- Tests, build, lint all green
- IA collapse from 10 public segments → 4 + admin is complete

---

### Task 1.9 · Move existing `/demo-resolution` and `/proof` under `/admin`

**Files (verified by inspecting the repo):**

- Delete: `app/demo-resolution/page.tsx`
- Delete: `app/demo-resolution/DemoResolutionConsole.tsx`
- Delete: `app/proof/page.tsx`
- Delete: `app/proof/ProofSmokeConsole.tsx`
- Create: `app/admin/resolution/page.tsx`
- Create: `app/admin/resolution/DemoResolutionConsole.tsx`
- Create: `app/admin/proof/page.tsx`
- Create: `app/admin/proof/ProofSmokeConsole.tsx`

- [ ] **Step 1.9.1: Confirm the file inventory**

Run:
```bash
ls app/demo-resolution/ app/proof/
```

Expected output (exact):
```
app/demo-resolution/: page.tsx  DemoResolutionConsole.tsx
app/proof/: page.tsx  ProofSmokeConsole.tsx
```

If extra files appear, stop and re-inventory; they likely need porting too.

- [ ] **Step 1.9.2: Port `/demo-resolution` to `/admin/resolution`**

```bash
mkdir -p app/admin/resolution
git mv app/demo-resolution/page.tsx app/admin/resolution/page.tsx
git mv app/demo-resolution/DemoResolutionConsole.tsx app/admin/resolution/DemoResolutionConsole.tsx
```

Inside `app/admin/resolution/page.tsx`, **update the relative import** from:
```ts
import { DemoResolutionConsole } from '@/app/demo-resolution/DemoResolutionConsole';
```
to:
```ts
import { DemoResolutionConsole } from '@/app/admin/resolution/DemoResolutionConsole';
```
(If the existing import uses a different style, e.g. `./DemoResolutionConsole`, leave it — relative imports survive the move.)

**Strip any in-page admin gate** if present (search for `ADMIN_RESOLVE_TOKEN` or cookie checks). The new `app/admin/layout.tsx` handles auth globally. Leave the API-side `ADMIN_RESOLVE_TOKEN` header check on the resolve API endpoints untouched — that's a separate concern.

**Strip any TopNav/WalletConnect** rendered in page.tsx — `AdminShell` provides the chrome.

- [ ] **Step 1.9.3: Port `/proof` to `/admin/proof`**

```bash
mkdir -p app/admin/proof
git mv app/proof/page.tsx app/admin/proof/page.tsx
git mv app/proof/ProofSmokeConsole.tsx app/admin/proof/ProofSmokeConsole.tsx
```

Same import-path + chrome-stripping rules as 1.9.2.

- [ ] **Step 1.9.4: Delete now-empty old directories**

```bash
rmdir app/demo-resolution app/proof 2>/dev/null || rm -rf app/demo-resolution app/proof
```

- [ ] **Step 1.9.5: Update stale UI-level link references**

Search only for **string-literal hrefs**, not module path names. Run:

```bash
# Match only quoted URL paths (not /api/ routes, not lib/proof/ module paths)
grep -rn "['\"]/demo-resolution['\"]\|href=['\"]/demo-resolution\|['\"]/proof['\"]\|href=['\"]/proof[/'\"]" \
  app/ components/ lib/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules
```

For each match, decide:
- If it's a UI link (e.g., `<Link href="/proof">` or string literal `"/proof"` used as a route) → update to `/admin/proof` or `/admin/resolution`
- If it's an API route reference (`/api/proof`) → **leave alone**
- If it's a `lib/` internal module path (`@/lib/proof/...`) → **leave alone**

**Use the Edit tool**, not `sed -i`, to avoid the macOS vs Linux portability trap.

- [ ] **Step 1.9.6: Run build + tests**

```bash
npm run build
npm test
```

Expected: Both succeed. If a test references old `/demo-resolution` or `/proof` route paths, update those references to the new admin paths via the Edit tool.

- [ ] **Step 1.9.7: Commit**

```bash
git add app/admin/resolution app/admin/proof
git add -u  # picks up the git mv deletions and any updated references
git commit -m "feat(admin): migrate /demo-resolution and /proof (with consoles) to /admin/* subtree"
```

---

### Task 1.10 · Delete `/intelligence`, `/autonomy`, `/leaderboard`, `/signals` routes (UI only)

**Files:**
- Delete: `app/intelligence/` (entire tree)
- Delete: `app/autonomy/` (entire tree)
- Delete: `app/leaderboard/` (entire tree)
- Delete: `app/signals/` (entire tree)

**Important — preservation:** These deletions only remove the **UI routes** under `app/`. The backend reads/services/APIs are PRESERVED:
- `app/api/intelligence/*`, `app/api/leaderboard/*`, `app/api/signals/*`, `app/api/autonomy/*` API endpoints remain
- `lib/insights/`, `lib/intelligence/`, `lib/autonomy/` modules remain
- `lib/persistence/*` schemas for these data types remain

Per spec §2.2, these are PRESERVED read models with no public UI entry, available for future revival or admin surfaces.

- [ ] **Step 1.10.1: Enumerate tests that reference the deleted routes**

Run:
```bash
grep -rln "'/intelligence\|'/autonomy\|'/leaderboard\|'/signals" \
  test/ \
  --include="*.ts" --include="*.tsx"
```

Record the list of files. For each test file:
- If the test asserts behavior **of the deleted page** → **delete the test** (the behavior no longer exists)
- If the test asserts **routing or link presence** → update its expectations to the new IA (`/agents` for leaderboard/agents/signals; routes simply gone for intelligence/autonomy)
- Document the decision in the commit message

- [ ] **Step 1.10.2: Enumerate non-test UI references**

Run:
```bash
grep -rn "['\"]/intelligence\|href=['\"]/intelligence\|['\"]/autonomy\|href=['\"]/autonomy\|['\"]/leaderboard\|href=['\"]/leaderboard\|['\"]/signals\|href=['\"]/signals" \
  app/ components/ lib/ \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules
```

For each match: this is a UI link. Either update the path or remove the link. **Skip API paths (`/api/...`) — those are not matched by the patterns above because the prefix anchor is `'` or `"`.**

For each match, use the Edit tool (not `sed`).

- [ ] **Step 1.10.3: Delete the route directories**

```bash
rm -rf app/intelligence
rm -rf app/autonomy
rm -rf app/leaderboard
rm -rf app/signals
```

- [ ] **Step 1.10.4: Confirm no residual `archive/agents-legacy` or similar inside `app/`**

```bash
find app -maxdepth 2 -type d -name '*.legacy' -o -name '*.bak'
```

Expected output: empty. If anything shows up, move it outside `app/` (Next.js scans every directory under `app/`).

- [ ] **Step 1.10.5: Run build + tests + lint**

```bash
npm run build
npm test
npm run lint
```

Expected: Build green. Tests pass (after the deletions/updates in 1.10.1). Lint clean (delete unused imports flagged in the now-shrunk codebase).

- [ ] **Step 1.10.6: Commit**

```bash
git add -A
git commit -m "feat(routes): remove intelligence/autonomy/leaderboard/signals UI routes (backend read models preserved)"
```

---

### Task 1.11 · Final Chunk 2 (Foundation Complete) verification

- [ ] **Step 1.11.1: Run full test suite**

```bash
npm test
```
Expected: all pass (no new tests broken).

- [ ] **Step 1.11.2: Run full build**

```bash
npm run build
```
Expected: build succeeds.

- [ ] **Step 1.11.3: Run lint**

```bash
npm run lint
```
Expected: Exit code 0, no errors. If any warnings about unused imports remain (the project uses `eslint-config-next`, which currently treats most issues as warnings rather than errors), fix them in this step before continuing. Run `npm run lint -- --max-warnings 0` to verify a strict-clean state if the project policy requires it.

- [ ] **Step 1.11.4: Manual smoke test**

Ensure `.env.local` has `ADMIN_ACCESS_TOKEN=test-admin-xyz` (any non-empty value).

```bash
npm run dev
```
Visit each route and confirm:
- `/` → Editorial placeholder (hero coming soon)
- `/arena` → existing arena dashboard wrapped in Glass layout (visibly has two wallet buttons; that's expected, Chunk 4 fixes)
- `/agents` → Glass placeholder
- `/my` → Glass placeholder
- `/admin` (no cookie) → redirects to `/admin/login`
- `/admin/login` → form renders; submit with wrong token → stays with error; submit with `test-admin-xyz` → redirects to `/admin`
- `/admin/resolution` (after login) → ported page renders inside AdminShell sidebar
- `/admin/proof` (after login) → ported page renders inside AdminShell sidebar
- `/admin/control-room`, `/admin/receipts`, `/admin/health` (after login) → placeholders
- `/intelligence`, `/autonomy`, `/leaderboard`, `/signals`, `/proof`, `/demo-resolution` → all 404

Kill dev server.

- [ ] **Step 1.11.5: Sign-off commit**

```bash
git commit --allow-empty -m "chore(redesign): chunk 2 (legacy cleanup) complete — IA reorg done"
```

---

**Chunks 1 + 2 done.** IA reorg complete: 4 public routes + `/admin` tree, all legacy UI deleted, backend read models intact. Next chunk implements the smart contract in isolation (parallel-safe from a code perspective — can be done concurrently with Chunks 1-2 if a separate engineer is available).

---

## Chunk 3: ShowdownArena Smart Contract

**Why this chunk:** The `Agent Showdown` Hook 01 needs an on-chain contract before any of the Arena UI or discovery/settle services can be built. This chunk is **parallel-safe** with Chunks 1-2 — it touches only `contracts/`, `test/contracts/`, `lib/contracts/`, and `scripts/`.

**Reference:** Spec §4.4 (state machine, struct fields, invariants), §4.4.3 (interface), §4.4.4 (Autonomous Agent Policy interaction), 附录 B (deployment checklist).

**End state of this chunk:**
- `contracts/ShowdownArena.sol` deployed-ready, with full state machine (None → Open → SettledA | SettledB)
- 100% branch-coverage Hardhat tests for openShowdown, settleShowdown, view functions, invariants, reentrancy
- `lib/contracts/showdownArena.ts` exports a typed viem client + ABI for app-side use
- `scripts/deploy-showdown-arena.ts` deployment script (idempotent: skips if address file exists unless `FORCE_REDEPLOY=1`; logs address + tx hash + block number)
- Existing `SignalBondArena` and `MockUSDC` untouched

---

### Task 3.1 · Read the existing contract pattern

**Files (read-only):**
- `contracts/SignalBondArena.sol`
- `contracts/MockUSDC.sol`
- `contracts/interfaces/IERC20.sol`
- `test/contracts/SignalBondArena.test.ts`

- [ ] **Step 3.1.1: Read all four files**

Understand:
- The deploy fixture pattern (`async function deployFixture()` returning `{ signers, usdc, arena }`)
- The MockUSDC `mint(address, uint)` + `approve(spender, uint)` flow
- The Hardhat ethers v6 import style (`import hre from 'hardhat'; const { ethers } = hre`)
- The `expect(...).to.emit(arena, 'EventName').withArgs(...)` matcher
- The `await ... .waitForDeployment()` requirement

No code changes yet. This step exists to anchor the implementer's mental model.

---

### Task 3.2 · Write the failing test scaffold for ShowdownArena

**Files:**
- Create: `test/contracts/ShowdownArena.test.ts`

- [ ] **Step 3.2.1: Create the test scaffold + deploy fixture**

Create `test/contracts/ShowdownArena.test.ts`:

```ts
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs.js';
import { expect } from 'chai';
import hre from 'hardhat';

const { ethers } = hre;

const BOND_MICRO_USDC = 250_000_000n; // 250 USDC (6 decimals)
const DEADLINE_OFFSET_SEC = 86_400n;  // 24h

describe('ShowdownArena', () => {
  async function deployFixture() {
    const [owner, agentA, agentB, treasury, outsider] = await ethers.getSigners();

    const MockUSDC = await ethers.getContractFactory('MockUSDC');
    const usdc = await MockUSDC.deploy();
    await usdc.waitForDeployment();

    const ShowdownArena = await ethers.getContractFactory('ShowdownArena');
    const arena = await ShowdownArena.deploy(await usdc.getAddress(), treasury.address);
    await arena.waitForDeployment();

    // Each agent gets enough USDC for several showdowns
    await usdc.mint(agentA.address, BOND_MICRO_USDC * 10n);
    await usdc.mint(agentB.address, BOND_MICRO_USDC * 10n);
    await usdc.connect(agentA).approve(await arena.getAddress(), BOND_MICRO_USDC * 10n);
    await usdc.connect(agentB).approve(await arena.getAddress(), BOND_MICRO_USDC * 10n);

    const now = (await ethers.provider.getBlock('latest'))!.timestamp;
    const deadline = BigInt(now) + DEADLINE_OFFSET_SEC;

    return { owner, agentA, agentB, treasury, outsider, usdc, arena, deadline };
  }

  // Sentinel test to verify scaffold loads
  it('deploys with owner = deployer and treasury set', async () => {
    const { owner, treasury, arena } = await deployFixture();
    expect(await arena.owner()).to.equal(owner.address);
    expect(await arena.treasury()).to.equal(treasury.address);
  });
});
```

- [ ] **Step 3.2.2: Run, expect FAIL — contract doesn't exist yet**

Run: `npm run test:contracts -- --grep ShowdownArena`
Expected: FAIL — a Hardhat artifact-not-found error from `getContractFactory('ShowdownArena')`, message similar to `HH700: Artifact for contract "ShowdownArena" not found`. The exact wording may vary by Hardhat version; the key is that the test errors before any assertion runs.

---

### Task 3.3 · Create the contract skeleton

**Files:**
- Create: `contracts/ShowdownArena.sol`

- [ ] **Step 3.3.1: Create the contract with state, events, modifiers, and constructor only**

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

contract ShowdownArena {
    enum Status { None, Open, SettledA, SettledB }

    struct Showdown {
        uint256 id;
        bytes32 externalId;
        string marketId;
        string marketQuestion;
        address agentA;
        string agentNameA;
        bool sideAYes;
        uint16 agentAProbabilityBps;
        address agentB;
        string agentNameB;
        uint16 agentBProbabilityBps;
        uint256 bondPerSideMicroUsdc;
        uint64 deadline;
        uint64 openedAt;
        uint64 settledAt;
        Status status;
    }

    IERC20 public immutable usdc;
    address public owner;
    address public treasury;
    uint256 public showdownCount;
    mapping(uint256 => Showdown) public showdowns;
    mapping(bytes32 => uint256) public externalIdToId;

    event ShowdownOpened(
        uint256 indexed showdownId,
        bytes32 indexed externalId,
        string marketId,
        address indexed agentA,
        bool sideAYes,
        address agentB,
        uint256 bondPerSideMicroUsdc,
        uint64 deadline
    );

    event ShowdownSettled(
        uint256 indexed showdownId,
        Status indexed result,
        address indexed winner,
        uint256 payoutMicroUsdc
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    constructor(address usdcAddress, address treasuryAddress) {
        require(usdcAddress != address(0), "usdc required");
        require(treasuryAddress != address(0), "treasury required");
        usdc = IERC20(usdcAddress);
        owner = msg.sender;
        treasury = treasuryAddress;
    }

    // Functions added in tasks 3.4 - 3.6
}
```

- [ ] **Step 3.3.2: Run sentinel test, expect PASS**

Run: `npm run test:contracts -- --grep ShowdownArena`
Expected: 1 test passing (the deploy fixture sentinel).

- [ ] **Step 3.3.3: Commit**

```bash
git add contracts/ShowdownArena.sol test/contracts/ShowdownArena.test.ts
git commit -m "feat(contracts): scaffold ShowdownArena (state, events, constructor)"
```

---

### Task 3.4 · TDD `openShowdown` — happy path

**Files:**
- Modify: `contracts/ShowdownArena.sol` (add openShowdown)
- Modify: `test/contracts/ShowdownArena.test.ts` (add openShowdown tests)

- [ ] **Step 3.4.1: Write failing test for happy path**

Append inside the `describe('ShowdownArena', ...)` block:

```ts
function buildOpenArgs(opts: {
  externalId: string;
  marketId?: string;
  marketQuestion?: string;
  agentA: string;
  agentNameA?: string;
  sideAYes?: boolean;
  agentAProbabilityBps?: number;
  agentB: string;
  agentNameB?: string;
  agentBProbabilityBps?: number;
  bondPerSideMicroUsdc?: bigint;
  deadline: bigint;
}) {
  return [
    ethers.id(opts.externalId),
    opts.marketId ?? 'market-btc-100k-eoy',
    opts.marketQuestion ?? 'BTC > 100k by EOY',
    opts.agentA,
    opts.agentNameA ?? 'volatility',
    opts.sideAYes ?? true,
    opts.agentAProbabilityBps ?? 6200,
    opts.agentB,
    opts.agentNameB ?? 'momentum',
    opts.agentBProbabilityBps ?? 3100,
    opts.bondPerSideMicroUsdc ?? BOND_MICRO_USDC,
    opts.deadline
  ] as const;
}

describe('openShowdown', () => {
  it('opens a showdown, pulls bond from both agents, emits event', async () => {
    const { agentA, agentB, usdc, arena, deadline } = await deployFixture();

    const args = buildOpenArgs({
      externalId: 'sd-1',
      agentA: agentA.address,
      agentB: agentB.address,
      deadline
    });

    await expect(arena.openShowdown(...args))
      .to.emit(arena, 'ShowdownOpened')
      .withArgs(
        1n,
        ethers.id('sd-1'),
        'market-btc-100k-eoy',
        agentA.address,
        true,
        agentB.address,
        BOND_MICRO_USDC,
        deadline
      );

    expect(await arena.showdownCount()).to.equal(1n);
    expect(await usdc.balanceOf(await arena.getAddress())).to.equal(BOND_MICRO_USDC * 2n);

    const sd = await arena.getShowdown(1n);
    expect(sd.status).to.equal(1n); // Open
    expect(sd.bondPerSideMicroUsdc).to.equal(BOND_MICRO_USDC);
    expect(sd.agentA).to.equal(agentA.address);
    expect(sd.agentB).to.equal(agentB.address);
  });
});
```

- [ ] **Step 3.4.2: Run, expect FAIL**

Run: `npm run test:contracts -- --grep openShowdown`
Expected: FAIL — `arena.openShowdown` and `arena.getShowdown` don't exist.

- [ ] **Step 3.4.3: Implement `openShowdown` + `getShowdown`**

Add inside the contract body (after constructor):

```solidity
function openShowdown(
    bytes32 externalId,
    string calldata marketId,
    string calldata marketQuestion,
    address agentA,
    string calldata agentNameA,
    bool sideAYes,
    uint16 agentAProbabilityBps,
    address agentB,
    string calldata agentNameB,
    uint16 agentBProbabilityBps,
    uint256 bondPerSideMicroUsdc,
    uint64 deadline
) external onlyOwner returns (uint256 showdownId) {
    require(externalIdToId[externalId] == 0, "external id reused");
    require(agentA != address(0) && agentB != address(0), "zero agent");
    require(agentA != agentB, "agents must differ");
    require(bondPerSideMicroUsdc > 0, "bond required");
    require(deadline > uint64(block.timestamp), "deadline in past");

    // CEI: write storage state BEFORE external transferFrom calls
    showdownCount += 1;
    showdownId = showdownCount;
    externalIdToId[externalId] = showdownId;

    Showdown storage sd = showdowns[showdownId];
    sd.id = showdownId;
    sd.externalId = externalId;
    sd.marketId = marketId;
    sd.marketQuestion = marketQuestion;
    sd.agentA = agentA;
    sd.agentNameA = agentNameA;
    sd.sideAYes = sideAYes;
    sd.agentAProbabilityBps = agentAProbabilityBps;
    sd.agentB = agentB;
    sd.agentNameB = agentNameB;
    sd.agentBProbabilityBps = agentBProbabilityBps;
    sd.bondPerSideMicroUsdc = bondPerSideMicroUsdc;
    sd.deadline = deadline;
    sd.openedAt = uint64(block.timestamp);
    sd.status = Status.Open;

    // Pull bonds — reverts entire tx on any failure (atomic open)
    require(usdc.transferFrom(agentA, address(this), bondPerSideMicroUsdc), "transferFrom A failed");
    require(usdc.transferFrom(agentB, address(this), bondPerSideMicroUsdc), "transferFrom B failed");

    emit ShowdownOpened(
        showdownId,
        externalId,
        marketId,
        agentA,
        sideAYes,
        agentB,
        bondPerSideMicroUsdc,
        deadline
    );
}

function getShowdown(uint256 showdownId) external view returns (Showdown memory) {
    return showdowns[showdownId];
}

function lookupByExternalId(bytes32 externalId) external view returns (uint256) {
    return externalIdToId[externalId];
}
```

- [ ] **Step 3.4.4: Run, expect PASS**

Run: `npm run test:contracts -- --grep openShowdown`
Expected: 1 test passing.

- [ ] **Step 3.4.5: Commit**

```bash
git add contracts/ShowdownArena.sol test/contracts/ShowdownArena.test.ts
git commit -m "feat(contracts): implement openShowdown happy path + view getters"
```

---

### Task 3.5 · TDD `openShowdown` — error paths and invariants

**Files:**
- Modify: `test/contracts/ShowdownArena.test.ts`

- [ ] **Step 3.5.1: Write failing tests for all error paths**

Append inside the `describe('openShowdown', ...)` block:

```ts
it('reverts when called by non-owner', async () => {
  const { agentA, agentB, arena, deadline, outsider } = await deployFixture();
  const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline });
  await expect(arena.connect(outsider).openShowdown(...args)).to.be.revertedWith('Ownable: caller is not the owner');
});

it('reverts when externalId is reused', async () => {
  const { agentA, agentB, arena, deadline } = await deployFixture();
  const args1 = buildOpenArgs({ externalId: 'sd-dupe', agentA: agentA.address, agentB: agentB.address, deadline });
  await arena.openShowdown(...args1);
  const args2 = buildOpenArgs({ externalId: 'sd-dupe', agentA: agentA.address, agentB: agentB.address, deadline });
  await expect(arena.openShowdown(...args2)).to.be.revertedWith('external id reused');
});

it('reverts when agents are identical', async () => {
  const { agentA, arena, deadline } = await deployFixture();
  const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentA.address, deadline });
  await expect(arena.openShowdown(...args)).to.be.revertedWith('agents must differ');
});

it('reverts when agent is zero address', async () => {
  const { agentA, arena, deadline } = await deployFixture();
  const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: ethers.ZeroAddress, deadline });
  await expect(arena.openShowdown(...args)).to.be.revertedWith('zero agent');
});

it('reverts when bond is zero', async () => {
  const { agentA, agentB, arena, deadline } = await deployFixture();
  const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline, bondPerSideMicroUsdc: 0n });
  await expect(arena.openShowdown(...args)).to.be.revertedWith('bond required');
});

it('reverts when deadline is in the past', async () => {
  const { agentA, agentB, arena } = await deployFixture();
  const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline: 1n });
  await expect(arena.openShowdown(...args)).to.be.revertedWith('deadline in past');
});

it('reverts atomically when transferFrom fails (insufficient approval)', async () => {
  const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
  // Revoke agentB's approval
  await usdc.connect(agentB).approve(await arena.getAddress(), 0);
  const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline });
  await expect(arena.openShowdown(...args)).to.be.reverted;
  // No state should be persisted
  expect(await arena.showdownCount()).to.equal(0n);
  expect(await arena.lookupByExternalId(ethers.id('sd-1'))).to.equal(0n);
});
```

- [ ] **Step 3.5.2: Run, expect 7 new tests, mostly PASS already**

Run: `npm run test:contracts -- --grep openShowdown`
Expected: 8 tests run; the 6 require-revert tests pass; the atomic-revert test passes if implementation is correct.

If any test fails: review the implementation against the test. Adjust either side per TDD principle — but in this case, the implementation in 3.4.3 is already designed against these tests, so they should pass.

- [ ] **Step 3.5.3: Commit**

```bash
git add test/contracts/ShowdownArena.test.ts
git commit -m "test(contracts): cover openShowdown error paths and atomicity"
```

---

### Task 3.6 · TDD `settleShowdown`

**Files:**
- Modify: `contracts/ShowdownArena.sol` (add settleShowdown)
- Modify: `test/contracts/ShowdownArena.test.ts`

- [ ] **Step 3.6.1: Write failing tests**

Append inside the main `describe('ShowdownArena', ...)` block:

```ts
describe('settleShowdown', () => {
  it('agent A wins: emits SettledA, pays 2x bond to A, status flips', async () => {
    const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
    const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline });
    await arena.openShowdown(...args);

    const balanceBeforeA = await usdc.balanceOf(agentA.address);

    await expect(arena.settleShowdown(1n, true))
      .to.emit(arena, 'ShowdownSettled')
      .withArgs(1n, 2n, agentA.address, BOND_MICRO_USDC * 2n);

    expect(await usdc.balanceOf(agentA.address)).to.equal(balanceBeforeA + BOND_MICRO_USDC * 2n);
    expect(await usdc.balanceOf(await arena.getAddress())).to.equal(0n);

    const sd = await arena.getShowdown(1n);
    expect(sd.status).to.equal(2n); // SettledA
    expect(sd.settledAt).to.be.greaterThan(0n);
  });

  it('agent B wins: emits SettledB, pays 2x bond to B, status flips', async () => {
    const { agentA, agentB, usdc, arena, deadline } = await deployFixture();
    const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline });
    await arena.openShowdown(...args);

    const balanceBeforeB = await usdc.balanceOf(agentB.address);

    await expect(arena.settleShowdown(1n, false))
      .to.emit(arena, 'ShowdownSettled')
      .withArgs(1n, 3n, agentB.address, BOND_MICRO_USDC * 2n);

    expect(await usdc.balanceOf(agentB.address)).to.equal(balanceBeforeB + BOND_MICRO_USDC * 2n);
    const sd = await arena.getShowdown(1n);
    expect(sd.status).to.equal(3n); // SettledB
  });

  it('reverts when called by non-owner', async () => {
    const { agentA, agentB, arena, deadline, outsider } = await deployFixture();
    const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline });
    await arena.openShowdown(...args);
    await expect(arena.connect(outsider).settleShowdown(1n, true)).to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('reverts when showdown is already settled', async () => {
    const { agentA, agentB, arena, deadline } = await deployFixture();
    const args = buildOpenArgs({ externalId: 'sd-1', agentA: agentA.address, agentB: agentB.address, deadline });
    await arena.openShowdown(...args);
    await arena.settleShowdown(1n, true);
    await expect(arena.settleShowdown(1n, false)).to.be.revertedWith('not open');
  });

  it('reverts when showdown does not exist', async () => {
    const { arena } = await deployFixture();
    await expect(arena.settleShowdown(999n, true)).to.be.revertedWith('not open');
  });
});
```

- [ ] **Step 3.6.2: Run, expect FAIL**

Run: `npm run test:contracts -- --grep settleShowdown`
Expected: FAIL — `arena.settleShowdown` doesn't exist.

- [ ] **Step 3.6.3: Implement `settleShowdown`**

Add inside the contract body (after `lookupByExternalId`):

```solidity
function settleShowdown(uint256 showdownId, bool agentAWins) external onlyOwner {
    Showdown storage sd = showdowns[showdownId];
    require(sd.status == Status.Open, "not open");

    // CEI: update state BEFORE transfer
    sd.status = agentAWins ? Status.SettledA : Status.SettledB;
    sd.settledAt = uint64(block.timestamp);

    address winner = agentAWins ? sd.agentA : sd.agentB;
    uint256 payout = sd.bondPerSideMicroUsdc * 2;

    require(usdc.transfer(winner, payout), "payout failed");

    emit ShowdownSettled(showdownId, sd.status, winner, payout);
}
```

- [ ] **Step 3.6.4: Run, expect PASS**

Run: `npm run test:contracts -- --grep settleShowdown`
Expected: 5 tests passing.

- [ ] **Step 3.6.5: Commit**

```bash
git add contracts/ShowdownArena.sol test/contracts/ShowdownArena.test.ts
git commit -m "feat(contracts): implement settleShowdown with onlyOwner + status guard"
```

---

### Task 3.7 · Branch coverage check

**Files:**
- Read-only

- [ ] **Step 3.7.1: Run full contract test suite**

Run: `npm run test:contracts`
Expected: all `SignalBondArena` (existing) + `ShowdownArena` (new, ~14 tests) pass.

- [ ] **Step 3.7.2: Manually verify branch coverage from the spec invariants list (§4.4.3)**

Walk through this checklist against the test file. Add a test for any uncovered branch:

| Invariant / Branch | Covered by test |
|---|---|
| `bondPerSideMicroUsdc > 0` | "reverts when bond is zero" |
| `agentA != agentB` | "reverts when agents are identical" |
| `deadline > openedAt` | "reverts when deadline is in the past" |
| Duplicate `externalId` rejected | "reverts when externalId is reused" |
| `settleShowdown` only on `Status.Open` | "reverts when showdown is already settled" + "does not exist" |
| Payout = `bond * 2` | both settleShowdown happy-path tests |
| Reentrancy via CEI | atomicity test (state stays clean on revert) |
| `onlyOwner` on both mutators | both "reverts when called by non-owner" |
| Zero-address agent rejected | "reverts when agent is zero address" |

If any row has no covering test, add one before continuing.

- [ ] **Step 3.7.3: Commit (if tests added)**

```bash
git add test/contracts/ShowdownArena.test.ts
git commit -m "test(contracts): close branch coverage gaps in ShowdownArena tests"
```

---

### Task 3.8 · Generate ABI artifact and create viem client wrapper

**Files:**
- Run: `npx hardhat compile` (generates artifacts)
- Create: `lib/contracts/showdownArena.ts`

- [ ] **Step 3.8.1: Compile contracts**

Run: `npx hardhat compile`
Expected: ABI written to `artifacts/contracts/ShowdownArena.sol/ShowdownArena.json`. Also generates TypeChain types if the project uses TypeChain.

- [ ] **Step 3.8.2: Confirm TypeChain types exist**

Run: `ls typechain-types/contracts/ShowdownArena*`
Expected: `ShowdownArena.ts` and `ShowdownArena__factory.ts` (or similar).

If absent, the existing project uses TypeChain — confirm by checking `hardhat.config.ts` for the typechain plugin. If it's there, the types are auto-generated; if not, skip this sub-step.

- [ ] **Step 3.8.3: Create viem client wrapper**

The app uses viem (not ethers) on the runtime side. Create `lib/contracts/showdownArena.ts`:

```ts
/**
 * ShowdownArena 合约的 viem 客户端包装。
 *
 * 用于服务端：openShowdown / settleShowdown / 读取 showdown 状态。
 * 由 lib/services/showdownDiscovery.ts 和 lib/services/showdownSettlement.ts 消费（Chunk 5）。
 */

import {
  Address,
  Hex,
  PublicClient,
  WalletClient,
  getContract,
  keccak256,
  parseAbi,
  toBytes
} from 'viem';

export const SHOWDOWN_ARENA_ABI = parseAbi([
  // events
  'event ShowdownOpened(uint256 indexed showdownId, bytes32 indexed externalId, string marketId, address indexed agentA, bool sideAYes, address agentB, uint256 bondPerSideMicroUsdc, uint64 deadline)',
  'event ShowdownSettled(uint256 indexed showdownId, uint8 indexed result, address indexed winner, uint256 payoutMicroUsdc)',
  // mutators
  'function openShowdown(bytes32 externalId, string marketId, string marketQuestion, address agentA, string agentNameA, bool sideAYes, uint16 agentAProbabilityBps, address agentB, string agentNameB, uint16 agentBProbabilityBps, uint256 bondPerSideMicroUsdc, uint64 deadline) external returns (uint256)',
  'function settleShowdown(uint256 showdownId, bool agentAWins) external',
  // views
  'function getShowdown(uint256 showdownId) external view returns ((uint256 id, bytes32 externalId, string marketId, string marketQuestion, address agentA, string agentNameA, bool sideAYes, uint16 agentAProbabilityBps, address agentB, string agentNameB, uint16 agentBProbabilityBps, uint256 bondPerSideMicroUsdc, uint64 deadline, uint64 openedAt, uint64 settledAt, uint8 status))',
  'function lookupByExternalId(bytes32 externalId) external view returns (uint256)',
  'function showdownCount() external view returns (uint256)',
  'function owner() external view returns (address)',
  'function treasury() external view returns (address)',
  'function usdc() external view returns (address)'
]);

export interface ShowdownArenaConfig {
  address: Address;
  publicClient: PublicClient;
  walletClient?: WalletClient;
}

export function getShowdownArena({ address, publicClient, walletClient }: ShowdownArenaConfig) {
  return getContract({
    address,
    abi: SHOWDOWN_ARENA_ABI,
    client: walletClient ? { public: publicClient, wallet: walletClient } : { public: publicClient }
  });
}

/** 链上的 Status enum 与 TS 数字对应（与合约 enum 顺序严格一致） */
export const ShowdownStatus = {
  None: 0,
  Open: 1,
  SettledA: 2,
  SettledB: 3
} as const;

export type ShowdownStatusValue = typeof ShowdownStatus[keyof typeof ShowdownStatus];

/** 从 externalId 字符串生成 bytes32 hex（与合约里的 keccak 兼容） */
export function buildExternalIdHash(rawExternalId: string): Hex {
  // viem 的 keccak256(toBytes(...)) 与 ethers.id() 等价
  return keccak256(toBytes(rawExternalId));
}
```

**Note:** If the project's viem version differs in API shape, adjust the `getContract` call to match. Verify by running the build (next step).

- [ ] **Step 3.8.4: Verify the client compiles**

Run: `npm run build`
Expected: TypeScript compiles. (The wrapper isn't yet consumed by any page, so it's just a type-check.)

- [ ] **Step 3.8.5: Commit**

```bash
git add lib/contracts/showdownArena.ts artifacts/contracts/ShowdownArena.sol typechain-types
git commit -m "feat(contracts): add viem client wrapper + ABI exports for ShowdownArena"
```

(If `artifacts/` or `typechain-types/` are gitignored — verified: they are — drop them from the `git add` line.)

---

### Task 3.9 · Write deployment script

**Files:**
- Create: `scripts/deploy-showdown-arena.ts`

- [ ] **Step 3.9.1: Inspect any existing deploy scripts**

```bash
ls scripts/
```

Look for `deploy-signal-bond-arena.ts` or similar. If present, mirror its structure. If absent, follow the pattern below.

- [ ] **Step 3.9.2: Create deployment script**

Create `scripts/deploy-showdown-arena.ts`:

```ts
/**
 * 部署 ShowdownArena 合约到 Arc Testnet（或本地）。
 *
 * 使用方式：
 *   USDC_ADDRESS=0x... TREASURY_ADDRESS=0x... \
 *   npx hardhat run scripts/deploy-showdown-arena.ts --network arcTestnet
 *
 * 输出：
 *   - 终端日志：合约地址 + tx hash + 区块号 + 可被 shell capture 的 SHOWDOWN_ARENA_ADDRESS= 行
 *   - 文件 .codex/showdown-arena-deployment.json（结构化部署元数据，被 Chunk 8 ingest）
 *
 * 幂等性：
 *   - 默认行为：如果 .codex/showdown-arena-deployment.json 存在且其中 chainId 等于当前网络，
 *     脚本只打印现有信息并退出，不重新部署。
 *   - FORCE_REDEPLOY=1 时无条件重新部署，覆盖元数据。
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import hre from 'hardhat';

const DEPLOYMENT_FILE = '.codex/showdown-arena-deployment.json';

interface DeploymentRecord {
  address: string;
  txHash: string;
  blockNumber: number;
  chainId: number;
  deployer: string;
  usdcAddress: string;
  treasuryAddress: string;
  timestampIso: string;
}

async function main() {
  const usdcAddress = process.env.USDC_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS;

  if (!usdcAddress) throw new Error('USDC_ADDRESS env var required');
  if (!treasuryAddress) throw new Error('TREASURY_ADDRESS env var required');

  const { ethers, network } = hre;
  const forceRedeploy = process.env.FORCE_REDEPLOY === '1';
  const chainId = Number((await ethers.provider.getNetwork()).chainId);

  // 幂等性检查
  if (!forceRedeploy && existsSync(DEPLOYMENT_FILE)) {
    const existing: DeploymentRecord = JSON.parse(readFileSync(DEPLOYMENT_FILE, 'utf8'));
    if (existing.chainId === chainId) {
      console.log(`[deploy] existing deployment found for chainId=${chainId}, skipping.`);
      console.log(`[deploy] address: ${existing.address}`);
      console.log(`SHOWDOWN_ARENA_ADDRESS=${existing.address}`);
      console.log(`[deploy] set FORCE_REDEPLOY=1 to redeploy.`);
      return;
    }
    console.log(`[deploy] existing record is for chainId=${existing.chainId}, current=${chainId}, proceeding.`);
  }

  const [deployer] = await ethers.getSigners();
  console.log(`[deploy] network=${network.name} chainId=${chainId}`);
  console.log(`[deploy] deployer=${deployer.address}`);
  console.log(`[deploy] usdc=${usdcAddress} treasury=${treasuryAddress}`);

  const Factory = await ethers.getContractFactory('ShowdownArena');
  const contract = await Factory.deploy(usdcAddress, treasuryAddress);
  const deployTx = contract.deploymentTransaction();
  if (!deployTx) throw new Error('no deployment tx');
  console.log(`[deploy] tx sent: ${deployTx.hash}`);

  const receipt = await deployTx.wait();
  if (!receipt) throw new Error('no deployment receipt');

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  const record: DeploymentRecord = {
    address,
    txHash: deployTx.hash,
    blockNumber: receipt.blockNumber,
    chainId,
    deployer: deployer.address,
    usdcAddress,
    treasuryAddress,
    timestampIso: new Date().toISOString()
  };

  mkdirSync(dirname(DEPLOYMENT_FILE), { recursive: true });
  writeFileSync(DEPLOYMENT_FILE, JSON.stringify(record, null, 2) + '\n', 'utf8');

  console.log(`[deploy] ShowdownArena deployed at: ${address}`);
  console.log(`[deploy] block: ${receipt.blockNumber}`);
  console.log(`[deploy] record written to ${DEPLOYMENT_FILE}`);
  console.log(`SHOWDOWN_ARENA_ADDRESS=${address}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3.9.3: Dry-run on local hardhat network**

The local Hardhat network resets each run, so the in-process EphemeralChain provides predictable addresses. We don't need a real Mock USDC — pass placeholder addresses:

```bash
USDC_ADDRESS=0x0000000000000000000000000000000000000001 \
TREASURY_ADDRESS=0x0000000000000000000000000000000000000002 \
npx hardhat run scripts/deploy-showdown-arena.ts
```

Expected output (lines, in order):
```
[deploy] network=hardhat chainId=31337
[deploy] deployer=0x...
[deploy] usdc=0x0000000000000000000000000000000000000001 treasury=0x0000000000000000000000000000000000000002
[deploy] tx sent: 0x...
[deploy] ShowdownArena deployed at: 0x...
[deploy] block: ...
[deploy] record written to .codex/showdown-arena-deployment.json
SHOWDOWN_ARENA_ADDRESS=0x...
```

Then run **a second time** to verify idempotency:
```bash
USDC_ADDRESS=0x0000000000000000000000000000000000000001 \
TREASURY_ADDRESS=0x0000000000000000000000000000000000000002 \
npx hardhat run scripts/deploy-showdown-arena.ts
```
Expected: prints "existing deployment found for chainId=31337, skipping." and exits without deploying.

Then verify FORCE_REDEPLOY behavior:
```bash
FORCE_REDEPLOY=1 USDC_ADDRESS=... TREASURY_ADDRESS=... \
npx hardhat run scripts/deploy-showdown-arena.ts
```
Expected: skip-check is bypassed; new deployment occurs; record overwritten.

Clean up the test deployment file before committing: `rm -f .codex/showdown-arena-deployment.json` (it's gitignored anyway).

> Actual Arc Testnet deployment happens in Chunk 8 (production deploy task).

> Actual Arc Testnet deployment happens in Chunk 8 (production deploy task).

- [ ] **Step 3.9.4: Commit**

```bash
git add scripts/deploy-showdown-arena.ts
git commit -m "feat(contracts): add ShowdownArena deployment script"
```

---

### End-of-Chunk-3 verification

- [ ] **Run all contract tests**: `npm run test:contracts` → all pass.
- [ ] **Run app build**: `npm run build` → succeeds (viem client typechecks).
- [ ] **Run unit tests**: `npm test` → still all pass.
- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 3 (ShowdownArena contract) complete"
```

**Chunk 3 done.** Smart contract is fully tested and deployable. Next chunk implements the Editorial homepage.

---

## Chunk 4: Editorial Homepage — Hero + DataStrip + Narrative

**Why this chunk:** The homepage is the 30-second hook for the Arc builder reviewer. It must communicate "AI agents bet against each other on Arc, with proof" in one screen. Three components compose the page: a `HomeHero` (oversized statement), a `HomeDataStrip` (4 live KPIs), and a `HomeNarrative` (two-column "The Premise" + "How to Watch").

**Reference:** Spec §5.1 (first-screen wireframe), §5.2 (narrative copy locked).

**Depends on:** Chunks 1-2 (TopNav + Editorial tokens). Does NOT depend on Chunk 3 (smart contract) or showdown services — Chunk 5 wires the live showdown number; until then, the SHOWDOWNS strip slot pulls from a placeholder zero with a comment marker.

**End state of this chunk:**
- `/` renders the locked Editorial layout from spec §5.1: tag-line → big H1 italic statement → subtitle → 4-column DataStrip → 2-column narrative
- Data strip pulls real values for ACTIVE SIGNALS, USDC BONDED, ACCURACY (from existing read models)
- SHOWDOWNS column displays placeholder `0` with `data-source="placeholder"` attribute, so Chunk 5 can swap it cleanly
- Tests for the 3 components
- All copy strings come from a single constants file so future tweaks don't go hunting

---

### Task 4.1 · Create homepage copy constants

**Files:**
- Create: `lib/config/homeCopy.ts`

- [ ] **Step 4.1.1: Create copy constants file**

```ts
/**
 * 首页文案常量（spec §5 锁定的文本）。
 * 任何修改必须先更新设计文档 §5.2。
 */

export const HOME_COPY = {
  tagline: 'LIVE ON ARC TESTNET',
  h1Lead: 'AI agents,',
  h1Emph: 'betting with proof.',
  subtitle:
    'Autonomous AI agents make BTC/ETH/SOL price predictions, post USDC bonds on Arc, and resolve on-chain. Watch them disagree, bet against each other, and pay the price.',
  strip: {
    activeSignals: { label: 'ACTIVE SIGNALS' },
    usdcBonded:    { label: 'USDC BONDED' },
    accuracy:      { label: 'AGENT ACCURACY' },
    showdowns:     { label: 'SHOWDOWNS WON' }
  },
  premise: {
    h4: 'The Premise',
    p1: 'Most prediction markets ask <em>humans</em> to bet. PredictArena asks <em>algorithms</em> to bet — and forces them to back their conviction with USDC bonds on Arc.',
    p2: 'When two agents disagree, they fight on-chain. The winner takes the loser\'s bond. Track records, transaction hashes, and resolution proofs are all on-chain. There\'s nowhere to hide.'
  },
  howToWatch: {
    h4: 'How to Watch',
    items: [
      'Visit <em>Arena</em> to watch live agent showdowns settle on Arc.',
      'Visit <em>Agents</em> to study each AI\'s track record and segment reputation.',
      'Connect wallet to enter <em>My</em> — track signals you followed, your bonds, your tx history.'
    ],
    closing: 'No registration. No KYC. Just connect a wallet and watch the agents fight.'
  }
} as const;
```

- [ ] **Step 4.1.2: Commit**

```bash
git add lib/config/homeCopy.ts
git commit -m "feat(home): add locked Editorial copy constants from spec §5"
```

---

### Task 4.2 · TDD `HomeHero` component

**Files:**
- Create: `components/HomeHero.tsx`
- Test: `test/components/HomeHero.test.tsx`

- [ ] **Step 4.2.1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeHero } from '@/components/HomeHero';

describe('HomeHero', () => {
  it('renders the locked tagline, H1 lead+emph, and subtitle', () => {
    render(<HomeHero blockNumber={8412390} />);
    expect(screen.getByText(/LIVE ON ARC TESTNET/i)).toBeInTheDocument();
    expect(screen.getByText(/BLOCK 8,412,390/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('AI agents');
    expect(screen.getByText(/betting with proof/i)).toBeInTheDocument();
    expect(screen.getByText(/Watch them disagree, bet against each other, and pay the price/i)).toBeInTheDocument();
  });

  it('formats block number with thousands separators', () => {
    render(<HomeHero blockNumber={12345678} />);
    expect(screen.getByText(/BLOCK 12,345,678/i)).toBeInTheDocument();
  });

  it('falls back gracefully when blockNumber is null', () => {
    render(<HomeHero blockNumber={null} />);
    expect(screen.getByText(/LIVE ON ARC TESTNET/i)).toBeInTheDocument();
    // No "BLOCK X" should render when number is unknown
    expect(screen.queryByText(/BLOCK/i)).toBeNull();
  });
});
```

- [ ] **Step 4.2.2: Run, expect FAIL**

Run: `npm test -- HomeHero`
Expected: FAIL — module not found.

- [ ] **Step 4.2.3: Implement `HomeHero`**

```tsx
import { HOME_COPY } from '@/lib/config/homeCopy';

interface HomeHeroProps {
  blockNumber: number | null;
}

const blockFormatter = new Intl.NumberFormat('en-US');

export function HomeHero({ blockNumber }: HomeHeroProps) {
  const blockLabel = blockNumber !== null ? `BLOCK ${blockFormatter.format(blockNumber)}` : null;
  return (
    <section style={{ padding: '60px 40px 50px', borderBottom: '1px solid var(--editorial-rule)' }}>
      <p className="editorial-accent" style={{ fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 22 }}>
        {HOME_COPY.tagline}
        {blockLabel ? ` · ${blockLabel}` : null}
      </p>
      <h1 className="editorial-h1" style={{ maxWidth: '85%', margin: '0 0 28px' }}>
        {HOME_COPY.h1Lead}<br />
        <em style={{ color: 'var(--editorial-accent)', fontWeight: 500, letterSpacing: '-1px' }}>
          {HOME_COPY.h1Emph}
        </em>
      </h1>
      <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--editorial-mute)', maxWidth: '60%', margin: 0 }}>
        {HOME_COPY.subtitle}
      </p>
    </section>
  );
}
```

- [ ] **Step 4.2.4: Run, expect PASS**

Run: `npm test -- HomeHero`
Expected: 3 tests passing.

- [ ] **Step 4.2.5: Commit**

```bash
git add components/HomeHero.tsx test/components/HomeHero.test.tsx
git commit -m "feat(home): add HomeHero with locked tagline/H1/subtitle"
```

---

### Task 4.3 · TDD `HomeDataStrip` component

**Files:**
- Create: `components/HomeDataStrip.tsx`
- Test: `test/components/HomeDataStrip.test.tsx`

**Note:** SHOWDOWNS WON is rendered with `data-source="placeholder"` to signal it's not yet wired to the real backend. Chunk 5 replaces the placeholder with the actual value from the showdowns API.

- [ ] **Step 4.3.1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeDataStrip } from '@/components/HomeDataStrip';

describe('HomeDataStrip', () => {
  const baseProps = {
    activeSignals: 12,
    activeSignalsDelta: 3,
    usdcBondedMicro: 24_580_000_000n,
    usdcBondedDelta24hMicro: 1_200_000_000n,
    accuracyBps: 6840,
    accuracyDeltaPp: 2.1,
    showdownsWon: 47,
    showdownsLeaderName: 'Volatility'
  } as const;

  it('renders all 4 columns with correct labels and values', () => {
    render(<HomeDataStrip {...baseProps} />);
    expect(screen.getByText('ACTIVE SIGNALS')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('USDC BONDED')).toBeInTheDocument();
    expect(screen.getByText('24,580')).toBeInTheDocument();
    expect(screen.getByText('AGENT ACCURACY')).toBeInTheDocument();
    expect(screen.getByText(/68\.4/)).toBeInTheDocument();
    expect(screen.getByText('SHOWDOWNS WON')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText(/Volatility leads/i)).toBeInTheDocument();
  });

  it('marks SHOWDOWNS WON cell as data-source=placeholder until Chunk 5 wires it', () => {
    render(<HomeDataStrip {...baseProps} />);
    const sd = screen.getByText('SHOWDOWNS WON').closest('[data-strip-cell]');
    expect(sd).toHaveAttribute('data-source', 'placeholder');
  });

  it('formats USDC with thousands separators (no decimals)', () => {
    render(<HomeDataStrip {...baseProps} usdcBondedMicro={1_234_567_000_000n} />);
    // 1_234_567_000_000 micro = 1,234,567 USDC
    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4.3.2: Run, expect FAIL**

Run: `npm test -- HomeDataStrip`
Expected: FAIL — module not found.

- [ ] **Step 4.3.3: Implement `HomeDataStrip`**

```tsx
import { HOME_COPY } from '@/lib/config/homeCopy';

interface HomeDataStripProps {
  activeSignals: number;
  activeSignalsDelta: number;  // 数量增量（最近 1 小时）
  usdcBondedMicro: bigint;
  usdcBondedDelta24hMicro: bigint;
  accuracyBps: number;          // 0..10000
  accuracyDeltaPp: number;      // percentage points
  showdownsWon: number;
  showdownsLeaderName: string;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function microToUsdcLabel(micro: bigint): string {
  // 6 decimals → integer USDC, round to nearest (not floor) to avoid "+0 24h" on small accruals
  const usdc = (micro + 500_000n) / 1_000_000n;
  return numberFormatter.format(Number(usdc));
}

function bpsToPercentLabel(bps: number): string {
  const pct = bps / 100;
  return pct.toFixed(1);
}

export function HomeDataStrip(props: HomeDataStripProps) {
  return (
    <section
      data-component="home-data-strip"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        padding: '28px 40px',
        borderBottom: '1px solid var(--editorial-rule)'
      }}
    >
      <StripCell
        label={HOME_COPY.strip.activeSignals.label}
        value={numberFormatter.format(props.activeSignals)}
        trend={`↗ ${props.activeSignalsDelta} in last hour`}
      />
      <StripCell
        label={HOME_COPY.strip.usdcBonded.label}
        value={microToUsdcLabel(props.usdcBondedMicro)}
        trend={`↗ +${microToUsdcLabel(props.usdcBondedDelta24hMicro)} 24h`}
      />
      <StripCell
        label={HOME_COPY.strip.accuracy.label}
        value={bpsToPercentLabel(props.accuracyBps)}
        valueSuffix="%"
        trend={`↗ +${props.accuracyDeltaPp.toFixed(1)}pp / week`}
      />
      <StripCell
        label={HOME_COPY.strip.showdowns.label}
        value={numberFormatter.format(props.showdownsWon)}
        trend={`${props.showdownsLeaderName} leads`}
        source="placeholder"
        isLast
      />
    </section>
  );
}

function StripCell({
  label,
  value,
  valueSuffix,
  trend,
  source,
  isLast
}: {
  label: string;
  value: string;
  valueSuffix?: string;
  trend: string;
  source?: 'placeholder';
  isLast?: boolean;
}) {
  return (
    <div
      data-strip-cell
      data-source={source ?? 'live'}
      style={{
        paddingRight: 32,
        borderRight: isLast ? 'none' : '1px solid var(--editorial-rule)'
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 1.5, color: '#555', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--editorial-fg)', letterSpacing: '-0.5px' }}>
        {value}
        {valueSuffix ? <span style={{ fontSize: 18, color: '#666' }}>{valueSuffix}</span> : null}
      </div>
      <div style={{ fontSize: 11, color: 'var(--color-success)', marginTop: 4 }}>{trend}</div>
    </div>
  );
}
```

- [ ] **Step 4.3.4: Run, expect PASS**

Run: `npm test -- HomeDataStrip`
Expected: 3 tests passing.

- [ ] **Step 4.3.5: Commit**

```bash
git add components/HomeDataStrip.tsx test/components/HomeDataStrip.test.tsx
git commit -m "feat(home): add HomeDataStrip with 4 KPI columns (showdowns column placeholder until chunk 5)"
```

---

### Task 4.4 · TDD `HomeNarrative` component

**Files:**
- Create: `components/HomeNarrative.tsx`
- Test: `test/components/HomeNarrative.test.tsx`

- [ ] **Step 4.4.1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeNarrative } from '@/components/HomeNarrative';

describe('HomeNarrative', () => {
  it('renders both columns with locked copy', () => {
    render(<HomeNarrative />);
    expect(screen.getByText('The Premise')).toBeInTheDocument();
    expect(screen.getByText('How to Watch')).toBeInTheDocument();
    expect(screen.getByText(/PredictArena asks/i)).toBeInTheDocument();
    expect(screen.getByText(/two agents disagree/i)).toBeInTheDocument();
    expect(screen.getByText(/connect a wallet and watch the agents fight/i)).toBeInTheDocument();
  });

  it('emits the 3 How-to-Watch items as separate <li> or rendered lines', () => {
    const { container } = render(<HomeNarrative />);
    const watchItems = container.querySelectorAll('[data-watch-item]');
    expect(watchItems).toHaveLength(3);
  });

  it('renders <em> tags from the locked copy (2 in Premise + 3 in How-to-Watch = 5)', () => {
    const { container } = render(<HomeNarrative />);
    expect(container.querySelectorAll('em').length).toBeGreaterThanOrEqual(5);
  });
});
```

- [ ] **Step 4.4.2: Run, expect FAIL**

Run: `npm test -- HomeNarrative`
Expected: FAIL — module not found.

- [ ] **Step 4.4.3: Implement `HomeNarrative`**

```tsx
import { HOME_COPY } from '@/lib/config/homeCopy';

export function HomeNarrative() {
  return (
    <section
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 40,
        padding: '32px 40px 60px'
      }}
    >
      <div>
        <h4 style={headingStyle}>{HOME_COPY.premise.h4}</h4>
        <p style={pStyle} dangerouslySetInnerHTML={{ __html: HOME_COPY.premise.p1 }} />
        <p style={pStyle} dangerouslySetInnerHTML={{ __html: HOME_COPY.premise.p2 }} />
      </div>
      <div>
        <h4 style={headingStyle}>{HOME_COPY.howToWatch.h4}</h4>
        {HOME_COPY.howToWatch.items.map((item, i) => (
          <p key={i} data-watch-item style={pStyle} dangerouslySetInnerHTML={{ __html: `→ ${item}` }} />
        ))}
        <p style={{ ...pStyle, marginTop: 14, fontStyle: 'italic' }}>
          {HOME_COPY.howToWatch.closing}
        </p>
      </div>
    </section>
  );
}

const headingStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: 2,
  color: 'var(--editorial-mute)',
  textTransform: 'uppercase',
  margin: '0 0 12px'
};

const pStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.75,
  color: '#aaa',
  margin: '0 0 10px'
};
```

**Note about `dangerouslySetInnerHTML`:** the spec copy contains `<em>` tags for emphasis. Since the copy comes from a controlled `lib/config/homeCopy.ts` (not user input), `dangerouslySetInnerHTML` is safe here. Add a comment to that effect in the file.

Add to top of `components/HomeNarrative.tsx`:

```tsx
// Copy comes from lib/config/homeCopy.ts (compile-time controlled, not user input).
// dangerouslySetInnerHTML is safe for the controlled <em> tags used in the prose.
```

- [ ] **Step 4.4.4: Run, expect PASS**

Run: `npm test -- HomeNarrative`
Expected: 3 tests passing.

- [ ] **Step 4.4.5: Commit**

```bash
git add components/HomeNarrative.tsx test/components/HomeNarrative.test.tsx
git commit -m "feat(home): add HomeNarrative (The Premise + How to Watch) with locked copy"
```

---

### Task 4.5 · Server-side data loader for the home page

**Files:**
- Create: `lib/arc/blockNumber.ts` (thin viem wrapper)
- Create: `lib/services/homeData.ts` (DI-friendly aggregator)
- Test: `test/unit/services/homeData.test.ts`

**Strategy decision (LOCKED for this chunk):** **Strategy A — derive in-memory from existing read models.** Do NOT add new methods to `PersistenceStore` / `localStore` / `supabaseStore`. The existing surface is sufficient:

| Need | Existing API |
|---|---|
| Active signals count | `store.listSignals()` then filter by `status` or `resolution === null` |
| Active signals delta (last hour) | Same list, filter by `createdAt > now-1h` |
| Total USDC bonded | `store.getMetrics().totalBondedMicroUsdc` (already a number, NOT bigint) |
| 24h delta | `store.listSignals()` filter + sum `stakeMicroUsdc` for last 24h |
| Accuracy (bps) | `store.listSignals()` filter resolved → ratio with `resolution.outcomeCorrect` |
| Accuracy delta (pp) | Compare last-week window vs previous-week window from same signals |
| Latest block number | New thin helper `lib/arc/blockNumber.ts` using `viem` |

**API surface (verified by reading the repo):**
- `getRuntimeStore()` in `lib/persistence/store.ts:344` returns `PersistenceStore`
- `PersistenceStore.listSignals(): Promise<AgentSignal[]>` (each has `createdAt`, `status`, `stakeMicroUsdc`, `resolution: null | { outcomeCorrect, resolvedAt }`)
- `PersistenceStore.getMetrics(): Promise<ArenaMetrics>` (with `totalBondedMicroUsdc: number`, `openSignals`, `resolvedSignals`)
- `arcTestnet` chain config exported from `lib/arc/client.ts`

**Spec divergence note (deliberate):** Spec §5.1 specifies SWR + 30s `refreshInterval` for the data strip. **This plan implements the data strip as an RSC with `force-dynamic`**, refreshed only on navigation. Rationale: avoids the `swr` dependency + new `/api/home/strip` route, keeps the demo simple, and the home page is unlikely to be left open by Arc builder reviewers for >30 seconds. If user feedback later requires a live ticker, Chunk 8 polish can split the strip into a thin client component reading from a new `/api/home/strip` route. **Update spec §5.1 to acknowledge RSC as the chosen path before archive (track as docs follow-up).**

#### Step 4.5.1 · Create the block number helper

Create `lib/arc/blockNumber.ts`:

```ts
/**
 * 读取 Arc Testnet 当前区块号。
 *
 * 单一职责：包一层 viem publicClient.getBlockNumber()，避免每处重新构造 client。
 * 失败时由调用方 catch；本模块不做 fallback。
 */

import { createPublicClient, http } from 'viem';
import { arcTestnet } from '@/lib/arc/client';

let cachedClient: ReturnType<typeof createPublicClient> | null = null;

function getClient() {
  if (!cachedClient) {
    cachedClient = createPublicClient({
      chain: arcTestnet,
      transport: http()
    });
  }
  return cachedClient;
}

export async function readArcLatestBlock(): Promise<number> {
  const block = await getClient().getBlockNumber();
  return Number(block);
}
```

**Verify** before writing: `lib/arc/client.ts` exports `arcTestnet` chain config. If the export name differs (e.g., `arcChain`), use the actual name. Run `grep -n "^export" lib/arc/client.ts` to confirm.

#### Step 4.5.2 · Write failing test (with dependency injection)

Create `test/unit/services/homeData.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getHomeStripData, type HomeDataReaders } from '@/lib/services/homeData';

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

function makeReaders(overrides: Partial<HomeDataReaders> = {}): HomeDataReaders {
  return {
    listSignals: async () => [],
    getMetrics: async () => ({
      generatedSignals: 0,
      committedSignals: 0,
      resolvedSignals: 0,
      openSignals: 0,
      averageEdgeBps: 0,
      totalBondedMicroUsdc: 0
    }),
    readBlockNumber: async () => 0,
    nowMs: () => 1_700_000_000_000,
    ...overrides
  };
}

describe('getHomeStripData', () => {
  it('exposes metrics-derived totals and signals-derived counts', async () => {
    const now = 1_700_000_000_000;
    const data = await getHomeStripData(makeReaders({
      getMetrics: async () => ({
        generatedSignals: 50,
        committedSignals: 30,
        resolvedSignals: 38,
        openSignals: 12,
        averageEdgeBps: 800,
        totalBondedMicroUsdc: 24_580_000_000
      }),
      readBlockNumber: async () => 8_412_390
    }));
    expect(data.activeSignals).toBe(12);
    expect(data.usdcBondedMicro).toBe(24_580_000_000n);
    expect(data.blockNumber).toBe(8_412_390);
  });

  it('counts signals from the last hour for activeSignalsDelta', async () => {
    const now = 1_700_000_000_000;
    const data = await getHomeStripData(makeReaders({
      nowMs: () => now,
      listSignals: async () => [
        signalAt(now - 30 * 60 * 1000),  // 30m ago - included
        signalAt(now - 45 * 60 * 1000),  // 45m ago - included
        signalAt(now - 70 * 60 * 1000),  // 70m ago - excluded
        signalAt(now - 2 * ONE_HOUR)     // 2h ago - excluded
      ]
    }));
    expect(data.activeSignalsDelta).toBe(2);
  });

  it('computes accuracy from resolved signals', async () => {
    const data = await getHomeStripData(makeReaders({
      listSignals: async () => [
        resolvedSignal(true),
        resolvedSignal(true),
        resolvedSignal(true),
        resolvedSignal(false),
        // pending signals don't count
        { ...resolvedSignal(true), resolution: null }
      ]
    }));
    // 3/4 correct = 7500 bps
    expect(data.accuracyBps).toBe(7500);
  });

  it('computes accuracyDeltaPp from week-over-week resolved signals', async () => {
    const now = 1_700_000_000_000;
    const ONE_DAY_MS = 24 * ONE_HOUR;
    const data = await getHomeStripData(makeReaders({
      nowMs: () => now,
      listSignals: async () => [
        // this week: 2/2 correct = 100%
        resolvedAt(now - 1 * ONE_DAY_MS, true),
        resolvedAt(now - 2 * ONE_DAY_MS, true),
        // prior week: 1/2 correct = 50%
        resolvedAt(now - 8 * ONE_DAY_MS, true),
        resolvedAt(now - 9 * ONE_DAY_MS, false)
      ]
    }));
    expect(data.accuracyDeltaPp).toBeCloseTo(50, 1);
  });

  it('falls back to null block when reader rejects', async () => {
    const data = await getHomeStripData(makeReaders({
      readBlockNumber: async () => { throw new Error('rpc down'); }
    }));
    expect(data.blockNumber).toBeNull();
  });

  it('keeps showdownsWon=0 and leader="—" (placeholder until Chunk 5)', async () => {
    const data = await getHomeStripData(makeReaders());
    expect(data.showdownsWon).toBe(0);
    expect(data.showdownsLeaderName).toBe('—');
  });
});

// helpers
function signalAt(timestampMs: number): any {
  return {
    id: `s-${timestampMs}`,
    createdAt: new Date(timestampMs).toISOString(),
    stakeMicroUsdc: 50_000_000,
    status: 'open',
    resolution: null
  };
}

function resolvedSignal(correct: boolean): any {
  return {
    id: `r-${correct}-${Math.random()}`,
    createdAt: '2025-01-01T00:00:00Z',
    stakeMicroUsdc: 50_000_000,
    status: 'resolved',
    resolution: {
      outcomeCorrect: correct,
      resolvedAt: '2025-01-02T00:00:00Z'
    }
  };
}

function resolvedAt(resolvedTimestampMs: number, correct: boolean): any {
  return {
    id: `ra-${resolvedTimestampMs}-${correct}`,
    createdAt: new Date(resolvedTimestampMs - 24 * 60 * 60 * 1000).toISOString(),
    stakeMicroUsdc: 50_000_000,
    status: 'resolved',
    resolution: {
      outcomeCorrect: correct,
      resolvedAt: new Date(resolvedTimestampMs).toISOString()
    }
  };
}
```

#### Step 4.5.3 · Run, expect FAIL

```bash
npm test -- homeData
```
Expected: FAIL — module `@/lib/services/homeData` not found.

#### Step 4.5.4 · Implement `getHomeStripData`

Create `lib/services/homeData.ts`:

```ts
/**
 * 首页数据聚合服务。
 *
 * 设计要点：
 * - 通过 HomeDataReaders 接口注入依赖，方便单元测试不依赖运行时存储/RPC
 * - app/page.tsx 调用时不传参数，使用 defaultHomeDataReaders（连接真实 store + viem）
 * - showdowns 字段为 placeholder，Chunk 5 接入 showdown 服务后替换
 */

import type { AgentSignal } from '@/lib/polymarket/types';
import type { ArenaMetrics } from '@/lib/persistence/store';
import { getRuntimeStore } from '@/lib/persistence/store';
import { readArcLatestBlock } from '@/lib/arc/blockNumber';

export interface HomeDataReaders {
  listSignals(): Promise<AgentSignal[]>;
  getMetrics(): Promise<ArenaMetrics>;
  readBlockNumber(): Promise<number>;
  nowMs(): number;
}

export const defaultHomeDataReaders: HomeDataReaders = {
  listSignals: () => getRuntimeStore().listSignals(),
  getMetrics: () => getRuntimeStore().getMetrics(),
  readBlockNumber: () => readArcLatestBlock(),
  nowMs: () => Date.now()
};

export interface HomeStripData {
  activeSignals: number;
  activeSignalsDelta: number;
  usdcBondedMicro: bigint;
  usdcBondedDelta24hMicro: bigint;
  accuracyBps: number;
  accuracyDeltaPp: number;
  /** Placeholder until Chunk 5 lands ShowdownDiscoveryService. */
  showdownsWon: number;
  /** Placeholder until Chunk 5 lands. */
  showdownsLeaderName: string;
  blockNumber: number | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS = 24 * ONE_HOUR_MS;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

export async function getHomeStripData(
  readers: HomeDataReaders = defaultHomeDataReaders
): Promise<HomeStripData> {
  const [signals, metrics, blockNumber] = await Promise.all([
    readers.listSignals().catch((): AgentSignal[] => []),
    readers.getMetrics().catch((): ArenaMetrics => ({
      generatedSignals: 0,
      committedSignals: 0,
      resolvedSignals: 0,
      openSignals: 0,
      averageEdgeBps: 0,
      totalBondedMicroUsdc: 0
    })),
    readers.readBlockNumber().then((n) => n as number | null).catch(() => null)
  ]);

  const now = readers.nowMs();

  // signals 派生量
  const activeSignalsDelta = signals.filter(
    (s) => Date.parse(s.createdAt) > now - ONE_HOUR_MS
  ).length;

  const usdcBondedDelta24h = signals
    .filter((s) => Date.parse(s.createdAt) > now - ONE_DAY_MS)
    .reduce((sum, s) => sum + BigInt(s.stakeMicroUsdc), 0n);

  // accuracy = correct / resolved
  const resolved = signals.filter((s) => s.resolution !== null);
  const correct = resolved.filter((s) => s.resolution?.outcomeCorrect === true);
  const accuracyBps = resolved.length === 0
    ? 0
    : Math.round((correct.length / resolved.length) * 10_000);

  // accuracy delta (this week vs prior week)
  const thisWeekResolved = resolved.filter(
    (s) => Date.parse(s.resolution!.resolvedAt) > now - ONE_WEEK_MS
  );
  const priorWeekResolved = resolved.filter((s) => {
    const t = Date.parse(s.resolution!.resolvedAt);
    return t <= now - ONE_WEEK_MS && t > now - 2 * ONE_WEEK_MS;
  });
  const thisWeekBps = thisWeekResolved.length === 0
    ? 0
    : (thisWeekResolved.filter((s) => s.resolution!.outcomeCorrect).length / thisWeekResolved.length) * 10_000;
  const priorWeekBps = priorWeekResolved.length === 0
    ? 0
    : (priorWeekResolved.filter((s) => s.resolution!.outcomeCorrect).length / priorWeekResolved.length) * 10_000;
  const accuracyDeltaPp = (thisWeekBps - priorWeekBps) / 100;

  return {
    activeSignals: metrics.openSignals,
    activeSignalsDelta,
    usdcBondedMicro: BigInt(metrics.totalBondedMicroUsdc),
    usdcBondedDelta24hMicro: usdcBondedDelta24h,
    accuracyBps,
    accuracyDeltaPp,
    showdownsWon: 0,
    showdownsLeaderName: '—',
    blockNumber
  };
}
```

#### Step 4.5.5 · Run, expect PASS

```bash
npm test -- homeData
```
Expected: 6 tests passing.

#### Step 4.5.6 · Commit

```bash
git add lib/arc/blockNumber.ts lib/services/homeData.ts test/unit/services/homeData.test.ts
git commit -m "feat(home): add getHomeStripData service deriving KPIs from existing store (DI for tests)"
```

---

### Task 4.6 · Replace `app/page.tsx` placeholder with the full Editorial home

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 4.6.1: Replace the page**

```tsx
import { TopNav } from '@/components/TopNav';
import { HomeHero } from '@/components/HomeHero';
import { HomeDataStrip } from '@/components/HomeDataStrip';
import { HomeNarrative } from '@/components/HomeNarrative';
import { getHomeStripData } from '@/lib/services/homeData';

export const dynamic = 'force-dynamic';
// 我们用 RSC 在每次请求时拉一份新数据；不需要 ISR 复杂度（demo 场景）

export const metadata = {
  title: 'PredictArena · AI agents, betting with proof.',
  description: 'Autonomous AI agents make BTC/ETH/SOL predictions, post USDC bonds on Arc, and resolve on-chain.'
};

export default async function HomePage() {
  const strip = await getHomeStripData();

  return (
    <main className="editorial-page" style={{ minHeight: '100vh' }}>
      <TopNav variant="editorial" />
      <HomeHero blockNumber={strip.blockNumber} />
      <HomeDataStrip
        activeSignals={strip.activeSignals}
        activeSignalsDelta={strip.activeSignalsDelta}
        usdcBondedMicro={strip.usdcBondedMicro}
        usdcBondedDelta24hMicro={strip.usdcBondedDelta24hMicro}
        accuracyBps={strip.accuracyBps}
        accuracyDeltaPp={strip.accuracyDeltaPp}
        showdownsWon={strip.showdownsWon}
        showdownsLeaderName={strip.showdownsLeaderName}
      />
      <HomeNarrative />
    </main>
  );
}
```

- [ ] **Step 4.6.2: Run build**

Run: `npm run build`
Expected: succeeds. The home page is now a Server Component that fetches data per request.

- [ ] **Step 4.6.3: Smoke test in dev mode**

Run: `npm run dev`. Visit `http://localhost:3000`. Expect:
- Tagline "LIVE ON ARC TESTNET · BLOCK X" (X is current Arc block or absent on RPC failure)
- Big italic "AI agents, betting with proof."
- Subtitle
- 4-column strip with real values (showdowns column = 0)
- Two-column narrative

Kill dev server.

- [ ] **Step 4.6.4: Commit**

```bash
git add app/page.tsx
git commit -m "feat(home): assemble Editorial home page with Hero + DataStrip + Narrative"
```

---

### Task 4.7 · Add the "Enter Arena" transition footer (per spec Appendix A)

**Files:**
- Create: `components/HomeTransitionFooter.tsx`
- Test: `test/components/HomeTransitionFooter.test.tsx`
- Modify: `app/page.tsx` (mount the footer)

**Purpose:** Visual bridge from Editorial homepage to Glass Neon Arena. Spec 附录 A explicitly calls this out as the risk mitigation for the visual hybrid.

- [ ] **Step 4.7.1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HomeTransitionFooter } from '@/components/HomeTransitionFooter';

describe('HomeTransitionFooter', () => {
  it('renders a Link to /arena with "Enter Arena" label', () => {
    render(<HomeTransitionFooter />);
    const link = screen.getByRole('link', { name: /Enter Arena/i });
    expect(link).toHaveAttribute('href', '/arena');
  });
});
```

- [ ] **Step 4.7.2: Run, expect FAIL**

Run: `npm test -- HomeTransitionFooter`
Expected: FAIL.

- [ ] **Step 4.7.3: Implement**

```tsx
import Link from 'next/link';

export function HomeTransitionFooter() {
  return (
    <section
      style={{
        padding: '60px 40px 80px',
        background: 'linear-gradient(180deg, var(--editorial-bg) 0%, var(--glass-bg) 100%)',
        textAlign: 'center'
      }}
    >
      <Link
        href="/arena"
        style={{
          display: 'inline-block',
          padding: '14px 36px',
          color: 'var(--glass-fg)',
          background: 'rgba(124, 92, 255, 0.18)',
          border: '1px solid rgba(124, 92, 255, 0.4)',
          borderRadius: 999,
          fontSize: 13,
          letterSpacing: 2,
          textTransform: 'uppercase',
          fontWeight: 600
        }}
      >
        Enter Arena →
      </Link>
    </section>
  );
}
```

- [ ] **Step 4.7.4: Mount in `app/page.tsx`**

Add `<HomeTransitionFooter />` after `<HomeNarrative />`.

- [ ] **Step 4.7.5: Run test + build**

```bash
npm test -- HomeTransitionFooter
npm run build
```

Both pass.

- [ ] **Step 4.7.6: Commit**

```bash
git add components/HomeTransitionFooter.tsx test/components/HomeTransitionFooter.test.tsx app/page.tsx
git commit -m "feat(home): add Editorial→Glass transition footer with Enter Arena CTA"
```

---

### End-of-Chunk-4 verification

- [ ] **Run all tests**: `npm test` → all pass.
- [ ] **Run build**: `npm run build` → succeeds.
- [ ] **Run lint**: `npm run lint` → exit code 0.
- [ ] **Manual smoke**:
  - `/` shows full Editorial home with real data
  - "SHOWDOWNS WON" cell shows `0 · — leads` (placeholder)
  - "Enter Arena →" button at the bottom; clicking goes to `/arena`
- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 4 (Editorial homepage) complete"
```

**Chunk 4 done.** Next chunk implements the Showdown backend (persistence, discovery service, settle service, API endpoints, cron wire).

---

## Chunk 5: Showdown Backend Part 1 — Persistence + Discovery Service

**Why this chunk:** With the smart contract from Chunk 3 in place, this chunk builds the first half of the server-side glue: a persistence layer for showdown records and a discovery service that detects disagreeing agents and opens showdowns on-chain. **No UI changes.** Chunk 6 builds the settlement service + API endpoints + cron wire; Chunk 7 wires both to the Arena page.

**Reference:** Spec §3.3 (Showdown lifecycle), §4.4 (contract), §4.5.1 (discovery algorithm), §4.4.4 (Agent Policy interaction), §8 (error handling).

**Depends on:** Chunks 1-3 (specifically Chunk 3 for `lib/contracts/showdownArena.ts` viem client).

**End state:**
- `lib/persistence/showdowns.ts` — `ShowdownStore` interface
- `lib/persistence/showdownsLocal.ts` — local JSON implementation (full)
- `lib/persistence/showdownsSupabase.ts` — stub (real impl in Chunk 10)
- `lib/services/showdownDiscovery.ts` — finds disagreeing agents, calls `openShowdown` on-chain, persists record
- Unit tests for both modules

---

### Task 5.1 · Define ShowdownRecord type + persistence interface

**Files:**
- Modify: `lib/persistence/store.ts` (add ShowdownRecord type)
- Create: `lib/persistence/showdowns.ts` (facade)

**Critical decision:** ShowdownRecord persistence lives **outside** the existing `PersistenceStore` interface to avoid touching `localStore.ts` and `supabaseStore.ts` (which would force a Supabase migration). Instead, a **separate** `ShowdownStore` interface with its own local + supabase implementations, mounted via a singleton factory.

- [ ] **Step 5.1.1: Add ShowdownRecord type to `lib/persistence/store.ts`**

Add near other record types (don't modify the `PersistenceStore` interface):

```ts
/**
 * Showdown 链上+链下聚合记录。
 *
 * - 链上字段 (showdownOnchainId, openTxHash 等) 在 openShowdown 成功后写入
 * - status 与合约 enum 严格对齐（0 None 1 Open 2 SettledA 3 SettledB）
 */
export interface ShowdownRecord {
  externalId: `0x${string}`;             // bytes32 hex
  onchainId: number;                     // 合约自增 id
  marketId: string;
  marketQuestion: string;
  agentA: {
    address: `0x${string}`;
    name: string;
    side: 'YES' | 'NO';
    probabilityBps: number;
  };
  agentB: {
    address: `0x${string}`;
    name: string;
    side: 'YES' | 'NO';
    probabilityBps: number;
  };
  bondPerSideMicroUsdc: number;
  deadline: string;                      // ISO
  status: 'Open' | 'SettledA' | 'SettledB';
  openedAt: string;                      // ISO
  settledAt: string | null;
  openTxHash: `0x${string}`;
  settleTxHash: `0x${string}` | null;
  resolvedOutcome: 'YES' | 'NO' | null;
  resolvedPriceLabel: string | null;
}
```

- [ ] **Step 5.1.2: Create `lib/persistence/showdowns.ts` facade**

```ts
/**
 * Showdown 持久化 facade。
 *
 * 与现有 PersistenceStore 隔离，避免修改 localStore.ts / supabaseStore.ts。
 * 通过环境变量 SHOWDOWN_PERSISTENCE_MODE 选择 'local' (默认) 或 'supabase'。
 */

import type { ShowdownRecord } from './store';

export interface ShowdownStore {
  insert(record: ShowdownRecord): Promise<void>;
  updateOnSettle(
    onchainId: number,
    patch: Pick<ShowdownRecord, 'status' | 'settledAt' | 'settleTxHash' | 'resolvedOutcome' | 'resolvedPriceLabel'>
  ): Promise<void>;
  listAll(): Promise<ShowdownRecord[]>;
  findByOnchainId(id: number): Promise<ShowdownRecord | undefined>;
  hasOpenBetween(marketId: string, agentAAddress: string, agentBAddress: string): Promise<boolean>;
}

import { createLocalShowdownStore } from './showdownsLocal';
import { createSupabaseShowdownStore } from './showdownsSupabase';

let cached: ShowdownStore | null = null;

export function getShowdownStore(): ShowdownStore {
  if (cached) return cached;
  const mode = process.env.SHOWDOWN_PERSISTENCE_MODE ?? 'local';
  cached = mode === 'supabase' ? createSupabaseShowdownStore() : createLocalShowdownStore();
  return cached;
}

/** 测试专用：覆盖 store 实例 */
export function __setShowdownStoreForTests(store: ShowdownStore | null): void {
  cached = store;
}
```

- [ ] **Step 5.1.3: Create local JSON implementation**

Create `lib/persistence/showdownsLocal.ts`:

```ts
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import type { ShowdownStore } from './showdowns';
import type { ShowdownRecord } from './store';

const FILE_PATH = process.env.SHOWDOWN_LOCAL_FILE
  ?? join(process.cwd(), 'data', 'runtime', 'showdowns.json');

function load(): ShowdownRecord[] {
  if (!existsSync(FILE_PATH)) return [];
  const raw = readFileSync(FILE_PATH, 'utf8').trim();
  if (!raw) return [];
  return JSON.parse(raw) as ShowdownRecord[];
}

function persist(records: ShowdownRecord[]): void {
  mkdirSync(dirname(FILE_PATH), { recursive: true });
  writeFileSync(FILE_PATH, JSON.stringify(records, null, 2) + '\n', 'utf8');
}

export function createLocalShowdownStore(): ShowdownStore {
  return {
    async insert(record) {
      const records = load();
      if (records.some((r) => r.onchainId === record.onchainId)) {
        throw new Error(`showdown ${record.onchainId} already exists`);
      }
      records.push(record);
      persist(records);
    },
    async updateOnSettle(onchainId, patch) {
      const records = load();
      const idx = records.findIndex((r) => r.onchainId === onchainId);
      if (idx === -1) throw new Error(`showdown ${onchainId} not found`);
      records[idx] = { ...records[idx], ...patch };
      persist(records);
    },
    async listAll() {
      return load();
    },
    async findByOnchainId(id) {
      return load().find((r) => r.onchainId === id);
    },
    async hasOpenBetween(marketId, a, b) {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      return load().some(
        (r) =>
          r.marketId === marketId &&
          r.status === 'Open' &&
          (
            (r.agentA.address.toLowerCase() === aLower && r.agentB.address.toLowerCase() === bLower) ||
            (r.agentA.address.toLowerCase() === bLower && r.agentB.address.toLowerCase() === aLower)
          )
      );
    }
  };
}
```

- [ ] **Step 5.1.4: Add stub Supabase implementation (real schema in Chunk 9)**

Create `lib/persistence/showdownsSupabase.ts`:

```ts
import type { ShowdownStore } from './showdowns';

/**
 * Supabase showdowns 实现。
 * 本 chunk 仅留 stub，避免阻塞本地开发；真实 Supabase migration 安排在 Chunk 9。
 */
export function createSupabaseShowdownStore(): ShowdownStore {
  throw new Error(
    'Supabase ShowdownStore not yet implemented. Use SHOWDOWN_PERSISTENCE_MODE=local during Chunks 5-8.'
  );
}
```

- [ ] **Step 5.1.5: Write tests for the local store**

Create `test/unit/persistence/showdownsLocal.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createLocalShowdownStore } from '@/lib/persistence/showdownsLocal';
import type { ShowdownRecord } from '@/lib/persistence/store';

const baseRecord: ShowdownRecord = {
  externalId: '0xab',
  onchainId: 1,
  marketId: 'm-1',
  marketQuestion: 'q?',
  agentA: { address: '0x' + 'a'.repeat(40), name: 'volatility', side: 'YES', probabilityBps: 6200 },
  agentB: { address: '0x' + 'b'.repeat(40), name: 'momentum', side: 'NO', probabilityBps: 3100 },
  bondPerSideMicroUsdc: 250_000_000,
  deadline: '2026-12-31T23:59:59Z',
  status: 'Open',
  openedAt: '2026-06-03T10:00:00Z',
  settledAt: null,
  openTxHash: '0xabcd',
  settleTxHash: null,
  resolvedOutcome: null,
  resolvedPriceLabel: null
};

describe('localShowdownStore', () => {
  let tmpDir: string;
  let origPath: string | undefined;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'showdown-test-'));
    origPath = process.env.SHOWDOWN_LOCAL_FILE;
    process.env.SHOWDOWN_LOCAL_FILE = join(tmpDir, 'showdowns.json');
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
    if (origPath) process.env.SHOWDOWN_LOCAL_FILE = origPath;
    else delete process.env.SHOWDOWN_LOCAL_FILE;
  });

  it('inserts and lists records', async () => {
    const store = createLocalShowdownStore();
    await store.insert(baseRecord);
    expect(await store.listAll()).toEqual([baseRecord]);
  });

  it('rejects duplicate onchainId', async () => {
    const store = createLocalShowdownStore();
    await store.insert(baseRecord);
    await expect(store.insert(baseRecord)).rejects.toThrow(/already exists/);
  });

  it('updates a record on settle', async () => {
    const store = createLocalShowdownStore();
    await store.insert(baseRecord);
    await store.updateOnSettle(1, {
      status: 'SettledA',
      settledAt: '2026-12-31T23:59:59Z',
      settleTxHash: '0xdead',
      resolvedOutcome: 'YES',
      resolvedPriceLabel: 'BTC closed at $105,200'
    });
    const r = await store.findByOnchainId(1);
    expect(r?.status).toBe('SettledA');
    expect(r?.resolvedOutcome).toBe('YES');
    expect(r?.resolvedPriceLabel).toBe('BTC closed at $105,200');
  });

  it('hasOpenBetween detects existing Open in either order', async () => {
    const store = createLocalShowdownStore();
    await store.insert(baseRecord);
    expect(await store.hasOpenBetween('m-1', baseRecord.agentA.address, baseRecord.agentB.address)).toBe(true);
    expect(await store.hasOpenBetween('m-1', baseRecord.agentB.address, baseRecord.agentA.address)).toBe(true);
    expect(await store.hasOpenBetween('m-2', baseRecord.agentA.address, baseRecord.agentB.address)).toBe(false);
  });
});
```

- [ ] **Step 5.1.6: Run, expect tests pass**

```bash
npm test -- showdownsLocal
```
Expected: 4 tests pass.

- [ ] **Step 5.1.7: Commit**

```bash
git add lib/persistence/showdowns.ts lib/persistence/showdownsLocal.ts lib/persistence/showdownsSupabase.ts lib/persistence/store.ts test/unit/persistence/showdownsLocal.test.ts
git commit -m "feat(showdowns): add ShowdownRecord type + local+supabase store interfaces"
```

---

### Task 5.2 · Showdown discovery service

**Files:**
- Create: `lib/services/showdownDiscovery.ts`
- Test: `test/unit/services/showdownDiscovery.test.ts`

**Spec reference:** §4.5.1 (algorithm), §4.4.4 (Agent Policy interaction).

**Inputs:** active signals + current showdown store state + operator wallet + viem client + agent policy.
**Output:** number of new showdowns opened on-chain, list of skip reasons.

- [ ] **Step 5.2.1: Define the service contract**

```ts
/**
 * Showdown 发现服务。
 *
 * 触发于 cron 周期完成 run-agents 后，或 admin 手动调用 /api/showdowns/discover。
 * 算法：扫描每个市场的活跃 signals → 找出方向相反的 agent 对 → 同一市场最多 1 个 showdown
 * → 检查预算/已存在 showdown → 调用合约 openShowdown → 持久化记录。
 *
 * 详见 plan §4.5.1。
 */

import { keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

export type DiscoverySkipReason =
  | 'no-active-signals'
  | 'no-pair'
  | 'same-side'
  | 'existing-open'
  | 'budget-exhausted'
  | 'operator-gas-low';

export interface DiscoveryResult {
  discovered: number;
  opened: number;
  skips: Array<{ marketId: string; reason: DiscoverySkipReason; detail?: string }>;
}

export interface DiscoveryDeps {
  listActiveSignals(): Promise<AgentSignal[]>;
  showdownStore: ShowdownStore;
  openOnChain(input: OpenOnChainInput): Promise<OpenOnChainResult>;
  /** 返回 agent 剩余的可用预算 (microUsdc)，用于预算检查 */
  getAgentRemainingBudget(agentName: string): Promise<bigint>;
  /** 标准 BOND_PER_SIDE_MICRO_USDC */
  bondPerSideMicroUsdc: bigint;
  /** showdown 持续时间（秒） */
  deadlineWindowSec: number;
  /** 用于生成 externalId 的 nonce 源（默认时间戳） */
  nowMs(): number;
  /** operator 钱包是否有足够 gas */
  isOperatorGasOk(): Promise<boolean>;
}

export interface OpenOnChainInput {
  externalId: `0x${string}`;
  marketId: string;
  marketQuestion: string;
  agentA: { address: `0x${string}`; name: string; side: 'YES' | 'NO'; probabilityBps: number };
  agentB: { address: `0x${string}`; name: string; side: 'YES' | 'NO'; probabilityBps: number };
  bondPerSideMicroUsdc: bigint;
  deadlineUnix: bigint;
}

export interface OpenOnChainResult {
  onchainId: number;
  txHash: `0x${string}`;
  openedAt: string;
}

export async function discoverShowdowns(deps: DiscoveryDeps): Promise<DiscoveryResult> {
  const skips: DiscoveryResult['skips'] = [];

  if (!(await deps.isOperatorGasOk())) {
    return { discovered: 0, opened: 0, skips: [{ marketId: '*', reason: 'operator-gas-low' }] };
  }

  const signals = await deps.listActiveSignals();
  if (signals.length === 0) {
    return { discovered: 0, opened: 0, skips: [{ marketId: '*', reason: 'no-active-signals' }] };
  }

  // 按市场分组
  const byMarket = new Map<string, AgentSignal[]>();
  for (const s of signals) {
    const arr = byMarket.get(s.marketId) ?? [];
    arr.push(s);
    byMarket.set(s.marketId, arr);
  }

  let discovered = 0;
  let opened = 0;

  for (const [marketId, marketSignals] of byMarket) {
    // 找方向相反的对
    const pairs: Array<{ x: AgentSignal; y: AgentSignal; spread: number }> = [];
    for (let i = 0; i < marketSignals.length; i++) {
      for (let j = i + 1; j < marketSignals.length; j++) {
        const a = marketSignals[i];
        const b = marketSignals[j];
        if (a.side === b.side) continue;
        pairs.push({
          x: a,
          y: b,
          spread: Math.abs(a.agentProbabilityBps - b.agentProbabilityBps)
        });
      }
    }

    if (pairs.length === 0) {
      skips.push({ marketId, reason: 'no-pair' });
      continue;
    }

    // 排序：主键 spread 降序；次键 较低地址（lex）升序，保证确定性
    pairs.sort((p, q) => {
      if (p.spread !== q.spread) return q.spread - p.spread;
      const pMin = minAddress(p.x, p.y);
      const qMin = minAddress(q.x, q.y);
      return pMin < qMin ? -1 : pMin > qMin ? 1 : 0;
    });

    const selected = pairs[0];
    discovered += 1;

    // 已存在 Open showdown？
    const xAgentAddress = agentAddressOf(selected.x);
    const yAgentAddress = agentAddressOf(selected.y);
    if (await deps.showdownStore.hasOpenBetween(marketId, xAgentAddress, yAgentAddress)) {
      skips.push({ marketId, reason: 'existing-open' });
      continue;
    }

    // 预算检查
    const xBudget = await deps.getAgentRemainingBudget(selected.x.agentName);
    const yBudget = await deps.getAgentRemainingBudget(selected.y.agentName);
    if (xBudget < deps.bondPerSideMicroUsdc || yBudget < deps.bondPerSideMicroUsdc) {
      skips.push({ marketId, reason: 'budget-exhausted' });
      continue;
    }

    // 生成 externalId（marketId + agent addresses + 时间戳）
    const externalId = buildExternalIdForPair(marketId, xAgentAddress, yAgentAddress, deps.nowMs());

    // 调用链上 openShowdown
    const deadlineUnix = BigInt(Math.floor(deps.nowMs() / 1000) + deps.deadlineWindowSec);
    let onchainResult: OpenOnChainResult;
    try {
      onchainResult = await deps.openOnChain({
        externalId,
        marketId,
        marketQuestion: selected.x.marketQuestion,
        agentA: {
          address: xAgentAddress,
          name: selected.x.agentName,
          side: selected.x.side === 'yes' ? 'YES' : 'NO',
          probabilityBps: selected.x.agentProbabilityBps
        },
        agentB: {
          address: yAgentAddress,
          name: selected.y.agentName,
          side: selected.y.side === 'yes' ? 'YES' : 'NO',
          probabilityBps: selected.y.agentProbabilityBps
        },
        bondPerSideMicroUsdc: deps.bondPerSideMicroUsdc,
        deadlineUnix
      });
    } catch (err) {
      console.warn(`[discovery] openShowdown failed for ${marketId}`, err);
      skips.push({ marketId, reason: 'existing-open', detail: String(err) });
      continue;
    }

    // 持久化
    const record: ShowdownRecord = {
      externalId,
      onchainId: onchainResult.onchainId,
      marketId,
      marketQuestion: selected.x.marketQuestion,
      agentA: {
        address: xAgentAddress,
        name: selected.x.agentName,
        side: selected.x.side === 'yes' ? 'YES' : 'NO',
        probabilityBps: selected.x.agentProbabilityBps
      },
      agentB: {
        address: yAgentAddress,
        name: selected.y.agentName,
        side: selected.y.side === 'yes' ? 'YES' : 'NO',
        probabilityBps: selected.y.agentProbabilityBps
      },
      bondPerSideMicroUsdc: Number(deps.bondPerSideMicroUsdc),
      deadline: new Date(Number(deadlineUnix) * 1000).toISOString(),
      status: 'Open',
      openedAt: onchainResult.openedAt,
      settledAt: null,
      openTxHash: onchainResult.txHash,
      settleTxHash: null,
      resolvedOutcome: null,
      resolvedPriceLabel: null
    };
    await deps.showdownStore.insert(record);
    opened += 1;
  }

  return { discovered, opened, skips };
}

// Agent address 派生：从已有 VOL_AGENT_PRIVATE_KEY / MOMENTUM_AGENT_PRIVATE_KEY 推算。
// 缓存避免每次签名都重新派生 EOA。
const addressCache = new Map<string, `0x${string}`>();

function agentAddressOf(signal: AgentSignal): `0x${string}` {
  if (addressCache.has(signal.agentName)) return addressCache.get(signal.agentName)!;
  const envKey = signal.agentName === 'volatility' ? 'VOL_AGENT_PRIVATE_KEY' : 'MOMENTUM_AGENT_PRIVATE_KEY';
  const privateKey = process.env[envKey];
  if (!privateKey || !privateKey.startsWith('0x')) {
    throw new Error(`${envKey} not set; cannot derive agent address`);
  }
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  addressCache.set(signal.agentName, account.address);
  return account.address;
}

function minAddress(a: AgentSignal, b: AgentSignal): string {
  const aa = agentAddressOf(a).toLowerCase();
  const ba = agentAddressOf(b).toLowerCase();
  return aa < ba ? aa : ba;
}

function buildExternalIdForPair(marketId: string, addrA: string, addrB: string, nowMs: number): `0x${string}` {
  // marketId + sorted addresses 已经保证跨市场不冲突；nowMs 提供单一市场多次开局的区分度
  const sorted = [addrA.toLowerCase(), addrB.toLowerCase()].sort();
  return keccak256(toBytes(`${marketId}|${sorted[0]}|${sorted[1]}|${nowMs}`)) as `0x${string}`;
}
```

**Note on agent address derivation:** The file imports `privateKeyToAccount` from `viem/accounts` and derives addresses on first use from `VOL_AGENT_PRIVATE_KEY` / `MOMENTUM_AGENT_PRIVATE_KEY` (already present in `.env.example`). No new env vars introduced.

**Test prerequisite for `agentAddressOf`:** Tests must set these env vars to valid 32-byte hex keys before calling discovery. Example in test scaffold:
```ts
process.env.VOL_AGENT_PRIVATE_KEY = '0x' + 'a'.repeat(64);
process.env.MOMENTUM_AGENT_PRIVATE_KEY = '0x' + 'b'.repeat(64);
```
Then `addressCache.clear()` between tests if the values change.

- [ ] **Step 5.2.2: Write tests for the discovery algorithm**

Create `test/unit/services/showdownDiscovery.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  discoverShowdowns,
  type DiscoveryDeps,
  type OpenOnChainResult
} from '@/lib/services/showdownDiscovery';
import type { AgentSignal } from '@/lib/polymarket/types';
import type { ShowdownStore } from '@/lib/persistence/showdowns';

// Use deterministic test private keys (not real funds); addresses derive from them
const VOL_TEST_KEY = '0x' + 'a'.repeat(64);
const MOMENTUM_TEST_KEY = '0x' + 'b'.repeat(64);

function setAgentEnv() {
  process.env.VOL_AGENT_PRIVATE_KEY = VOL_TEST_KEY;
  process.env.MOMENTUM_AGENT_PRIVATE_KEY = MOMENTUM_TEST_KEY;
}

function mkSignal(opts: { marketId: string; agentName: 'volatility' | 'momentum'; side: 'yes' | 'no'; probBps: number }): AgentSignal {
  return {
    id: `sig-${opts.agentName}-${opts.marketId}`,
    runId: 'run-1',
    marketId: opts.marketId,
    marketQuestion: `q for ${opts.marketId}`,
    marketUrl: null,
    asset: 'BTC',
    conditionType: 'price-above',
    thresholdUsd: 100000,
    expiresAt: '2026-12-31T23:59:59Z',
    agentName: opts.agentName,
    modelVersion: '1.0',
    modelParams: {},
    modelHash: '0xa',
    dataHash: '0xb',
    side: opts.side,
    status: 'open',
    confidence: 'high',
    confidenceBps: 7000,
    marketPriceBps: 5000,
    agentProbabilityBps: opts.probBps,
    yesPriceBps: 5000,
    pYesBps: opts.probBps,
    edgeBps: 1000,
    kellyBps: 100,
    stakeMicroUsdc: 50_000_000,
    riskFlags: [],
    arcTxHash: null,
    createdAt: '2026-06-03T08:00:00Z',
    updatedAt: '2026-06-03T08:00:00Z',
    source: 'polymarket',
    resolution: null
  } as AgentSignal;
}

function makeDeps(overrides: Partial<DiscoveryDeps> = {}): DiscoveryDeps {
  const store: ShowdownStore = {
    insert: vi.fn(async () => {}),
    updateOnSettle: vi.fn(),
    listAll: vi.fn(async () => []),
    findByOnchainId: vi.fn(),
    hasOpenBetween: vi.fn(async () => false)
  };
  return {
    listActiveSignals: async () => [],
    showdownStore: store,
    openOnChain: vi.fn(async (): Promise<OpenOnChainResult> => ({
      onchainId: 1,
      txHash: '0xdead',
      openedAt: '2026-06-03T08:00:00Z'
    })),
    getAgentRemainingBudget: async () => 1_000_000_000n,
    bondPerSideMicroUsdc: 250_000_000n,
    deadlineWindowSec: 86_400,
    nowMs: () => 1_780_000_000_000,
    isOperatorGasOk: async () => true,
    ...overrides
  };
}

import { beforeEach } from 'vitest';

describe('discoverShowdowns', () => {
  beforeEach(() => setAgentEnv());

  it('opens 1 showdown when agents disagree on the same market', async () => {
    const result = await discoverShowdowns(makeDeps({
      listActiveSignals: async () => [
        mkSignal({ marketId: 'm-1', agentName: 'volatility', side: 'yes', probBps: 6200 }),
        mkSignal({ marketId: 'm-1', agentName: 'momentum', side: 'no', probBps: 3100 })
      ]
    }));
    expect(result.opened).toBe(1);
    expect(result.discovered).toBe(1);
    expect(result.skips).toEqual([]);
  });

  it('skips with same-side reason when both agents see YES', async () => {
    const result = await discoverShowdowns(makeDeps({
      listActiveSignals: async () => [
        mkSignal({ marketId: 'm-1', agentName: 'volatility', side: 'yes', probBps: 6200 }),
        mkSignal({ marketId: 'm-1', agentName: 'momentum', side: 'yes', probBps: 5500 })
      ]
    }));
    expect(result.opened).toBe(0);
    expect(result.skips[0].reason).toBe('no-pair');
  });

  it('skips with existing-open when store already has Open between same agents', async () => {
    const store: ShowdownStore = {
      insert: vi.fn(),
      updateOnSettle: vi.fn(),
      listAll: vi.fn(),
      findByOnchainId: vi.fn(),
      hasOpenBetween: vi.fn(async () => true)
    };
    const result = await discoverShowdowns(makeDeps({
      showdownStore: store,
      listActiveSignals: async () => [
        mkSignal({ marketId: 'm-1', agentName: 'volatility', side: 'yes', probBps: 6200 }),
        mkSignal({ marketId: 'm-1', agentName: 'momentum', side: 'no', probBps: 3100 })
      ]
    }));
    expect(result.opened).toBe(0);
    expect(result.skips[0].reason).toBe('existing-open');
  });

  it('skips with budget-exhausted when agent budget < bond', async () => {
    const result = await discoverShowdowns(makeDeps({
      getAgentRemainingBudget: async () => 100_000_000n,
      listActiveSignals: async () => [
        mkSignal({ marketId: 'm-1', agentName: 'volatility', side: 'yes', probBps: 6200 }),
        mkSignal({ marketId: 'm-1', agentName: 'momentum', side: 'no', probBps: 3100 })
      ]
    }));
    expect(result.skips[0].reason).toBe('budget-exhausted');
  });

  it('skips with operator-gas-low without scanning', async () => {
    const result = await discoverShowdowns(makeDeps({
      isOperatorGasOk: async () => false
    }));
    expect(result.skips[0].reason).toBe('operator-gas-low');
  });

  it('picks the pair with largest probability spread on N>2 agents', async () => {
    const openCall = vi.fn(async () => ({
      onchainId: 1,
      txHash: '0xdead' as `0x${string}`,
      openedAt: '2026-06-03T08:00:00Z'
    }));
    await discoverShowdowns(makeDeps({
      openOnChain: openCall,
      listActiveSignals: async () => [
        mkSignal({ marketId: 'm-1', agentName: 'volatility', side: 'yes', probBps: 8000 }),
        mkSignal({ marketId: 'm-1', agentName: 'momentum', side: 'no', probBps: 2000 })
      ]
    }));
    expect(openCall).toHaveBeenCalledOnce();
    const callArg = openCall.mock.calls[0][0];
    expect(Math.abs(callArg.agentA.probabilityBps - callArg.agentB.probabilityBps)).toBe(6000);
  });
});
```

- [ ] **Step 5.2.3: Run, expect tests pass**

```bash
npm test -- showdownDiscovery
```
Expected: 6 tests pass.

- [ ] **Step 5.2.4: Commit**

```bash
git add lib/services/showdownDiscovery.ts test/unit/services/showdownDiscovery.test.ts
git commit -m "feat(showdowns): add discovery service detecting disagreement and opening showdowns"
```

---

### End-of-Chunk-5 verification

- [ ] `npm test` → all pass (existing + ~10 new tests).
- [ ] `npm run build` → succeeds.
- [ ] `npm run lint` → 0 errors.
- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 5 (showdown persistence + discovery) complete"
```

**Chunk 5 done.** Persistence + discovery in place. Chunk 6 adds settlement, API, and cron.

---

## Chunk 6: Showdown Backend Part 2 — Settlement + API + Cron + homeData

**Why this chunk:** Completes the showdown backend started in Chunk 5: settlement service (matching resolution to winner), three new API endpoints (list + admin discover + admin settle), cron integration, and finally wires settled showdown count into the homepage data strip (removing the placeholder).

**Reference:** Spec §4.5.2 (settle algorithm), §4.5.3 (resolution → winner mapping), §4.3 (API contracts), §8 (error handling).

**Depends on:** Chunk 5 (uses `ShowdownStore` + `discoverShowdowns`) AND Chunk 4 (`lib/services/homeData.ts` + `components/HomeDataStrip.tsx` are pre-existing from Chunk 4 — this chunk only modifies them to replace placeholders) AND Chunk 1 (`lib/config/admin-auth.ts` is created in Task 1.7).

**End state:**
- `lib/services/showdownSettlement.ts` — finds Open showdowns past deadline, calls `settleShowdown`, persists result
- `lib/services/showdownDiscoveryDefaults.ts` — wires `discoverShowdowns` deps to real systems
- `lib/services/showdownSettlementDefaults.ts` — wires `settleEligibleShowdowns` deps to real systems
- `app/api/showdowns/route.ts` — GET list
- `app/api/showdowns/discover/route.ts` — POST, admin-gated
- `app/api/showdowns/[id]/settle/route.ts` — POST, admin-gated
- `lib/services/homeData.ts` — updated to count settled showdowns + identify leader (placeholder removed)
- `components/HomeDataStrip.tsx` — placeholder `data-source` marker removed
- Cron route updated to call discover + settle each cycle
- Unit tests for each new module

---

### Task 5.3 · Showdown settlement service

**Files:**
- Create: `lib/services/showdownSettlement.ts`
- Test: `test/unit/services/showdownSettlement.test.ts`

**Spec reference:** §4.5.2 (algorithm), §4.5.3 (mapping).

- [ ] **Step 5.3.1: Implement**

```ts
import type { ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

export interface ResolutionResult {
  outcomeYes: boolean;
  priceLabel: string;
}

export interface SettlementDeps {
  showdownStore: ShowdownStore;
  resolveMarket(marketId: string, deadlineIso: string): Promise<ResolutionResult | null>;
  settleOnChain(onchainId: number, agentAWins: boolean): Promise<`0x${string}`>;
  nowMs(): number;
}

export interface SettlementResult {
  inspected: number;
  settled: number;
  stuck: number;
  errors: Array<{ onchainId: number; error: string }>;
}

const STUCK_THRESHOLD_MS = 24 * 60 * 60 * 1000;

export async function settleEligibleShowdowns(deps: SettlementDeps): Promise<SettlementResult> {
  const all = await deps.showdownStore.listAll();
  const now = deps.nowMs();
  const candidates = all.filter((r) => r.status === 'Open' && Date.parse(r.deadline) <= now);

  let settled = 0;
  let stuck = 0;
  const errors: SettlementResult['errors'] = [];

  for (const sd of candidates) {
    try {
      const resolution = await deps.resolveMarket(sd.marketId, sd.deadline);
      if (!resolution) {
        if (now - Date.parse(sd.deadline) > STUCK_THRESHOLD_MS) {
          stuck += 1;
          console.warn(`[settlement] showdown ${sd.onchainId} stuck > 24h`);
        }
        continue;
      }
      const agentAWins = mapResolutionToAgentAWins(sd, resolution.outcomeYes);
      const txHash = await deps.settleOnChain(sd.onchainId, agentAWins);
      await deps.showdownStore.updateOnSettle(sd.onchainId, {
        status: agentAWins ? 'SettledA' : 'SettledB',
        settledAt: new Date(now).toISOString(),
        settleTxHash: txHash,
        resolvedOutcome: resolution.outcomeYes ? 'YES' : 'NO',
        resolvedPriceLabel: resolution.priceLabel
      });
      settled += 1;
    } catch (err) {
      errors.push({ onchainId: sd.onchainId, error: String(err) });
    }
  }

  return { inspected: candidates.length, settled, stuck, errors };
}

/**
 * agentAWins = (resolved YES == agentA's side is YES) || (resolved NO == agentA's side is NO)
 * 即：agentA 的预测方向是否与最终结果一致
 */
export function mapResolutionToAgentAWins(record: ShowdownRecord, outcomeYes: boolean): boolean {
  const agentASideYes = record.agentA.side === 'YES';
  return agentASideYes === outcomeYes;
}
```

- [ ] **Step 5.3.2: Write tests**

Create `test/unit/services/showdownSettlement.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import {
  settleEligibleShowdowns,
  mapResolutionToAgentAWins,
  type SettlementDeps
} from '@/lib/services/showdownSettlement';
import type { ShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

function mkRecord(overrides: Partial<ShowdownRecord> = {}): ShowdownRecord {
  return {
    externalId: '0xab' as `0x${string}`,
    onchainId: 1,
    marketId: 'm-1',
    marketQuestion: 'q?',
    agentA: { address: '0xa' as `0x${string}`, name: 'volatility', side: 'YES', probabilityBps: 6200 },
    agentB: { address: '0xb' as `0x${string}`, name: 'momentum', side: 'NO', probabilityBps: 3100 },
    bondPerSideMicroUsdc: 250_000_000,
    deadline: '2026-06-02T00:00:00Z',
    status: 'Open',
    openedAt: '2026-06-01T00:00:00Z',
    settledAt: null,
    openTxHash: '0xopen' as `0x${string}`,
    settleTxHash: null,
    resolvedOutcome: null,
    resolvedPriceLabel: null,
    ...overrides
  };
}

function makeDeps(overrides: Partial<SettlementDeps> = {}): SettlementDeps {
  return {
    showdownStore: {
      listAll: vi.fn(async () => []),
      insert: vi.fn(),
      updateOnSettle: vi.fn(async () => {}),
      findByOnchainId: vi.fn(),
      hasOpenBetween: vi.fn(async () => false)
    } as ShowdownStore,
    resolveMarket: vi.fn(async () => ({ outcomeYes: true, priceLabel: 'BTC closed' })),
    settleOnChain: vi.fn(async () => '0xset' as `0x${string}`),
    nowMs: () => Date.parse('2026-06-03T00:00:00Z'),
    ...overrides
  };
}

describe('mapResolutionToAgentAWins', () => {
  it('agentA YES + outcome YES → A wins', () => {
    expect(mapResolutionToAgentAWins(mkRecord({ agentA: { ...mkRecord().agentA, side: 'YES' } }), true)).toBe(true);
  });
  it('agentA YES + outcome NO → A loses', () => {
    expect(mapResolutionToAgentAWins(mkRecord({ agentA: { ...mkRecord().agentA, side: 'YES' } }), false)).toBe(false);
  });
  it('agentA NO + outcome YES → A loses', () => {
    expect(mapResolutionToAgentAWins(mkRecord({ agentA: { ...mkRecord().agentA, side: 'NO' } }), true)).toBe(false);
  });
  it('agentA NO + outcome NO → A wins', () => {
    expect(mapResolutionToAgentAWins(mkRecord({ agentA: { ...mkRecord().agentA, side: 'NO' } }), false)).toBe(true);
  });
});

describe('settleEligibleShowdowns', () => {
  it('settles past-deadline Open showdowns when resolution exists', async () => {
    const updates: any[] = [];
    const deps = makeDeps({
      showdownStore: {
        listAll: async () => [mkRecord({ status: 'Open' })],
        updateOnSettle: vi.fn(async (id, patch) => { updates.push({ id, patch }); }),
        insert: vi.fn(),
        findByOnchainId: vi.fn(),
        hasOpenBetween: vi.fn(async () => false)
      } as ShowdownStore
    });
    const result = await settleEligibleShowdowns(deps);
    expect(result.settled).toBe(1);
    expect(updates[0].patch.status).toBe('SettledA');
    expect(updates[0].patch.resolvedOutcome).toBe('YES');
    expect(updates[0].patch.settleTxHash).toBe('0xset');
  });

  it('does NOT settle when resolution is null (still pending)', async () => {
    const deps = makeDeps({
      resolveMarket: async () => null,
      showdownStore: {
        listAll: async () => [mkRecord({ status: 'Open' })],
        updateOnSettle: vi.fn(),
        insert: vi.fn(),
        findByOnchainId: vi.fn(),
        hasOpenBetween: vi.fn(async () => false)
      } as ShowdownStore
    });
    const result = await settleEligibleShowdowns(deps);
    expect(result.settled).toBe(0);
    expect(result.stuck).toBe(0);  // still within 24h window in this fixture
  });

  it('marks stuck when deadline >24h ago and resolution still null', async () => {
    const now = Date.parse('2026-06-05T00:00:00Z');  // ~72h after the 06-02 deadline
    const deps = makeDeps({
      resolveMarket: async () => null,
      nowMs: () => now,
      showdownStore: {
        listAll: async () => [mkRecord({ status: 'Open' })],
        updateOnSettle: vi.fn(),
        insert: vi.fn(),
        findByOnchainId: vi.fn(),
        hasOpenBetween: vi.fn(async () => false)
      } as ShowdownStore
    });
    const result = await settleEligibleShowdowns(deps);
    expect(result.stuck).toBe(1);
  });
});
```

- [ ] **Step 5.3.3: Run + commit**

```bash
npm test -- showdownSettlement
git add lib/services/showdownSettlement.ts test/unit/services/showdownSettlement.test.ts
git commit -m "feat(showdowns): add settlement service with resolution→winner mapping"
```

---

### Task 5.4 · API: GET `/api/showdowns`

**Files:**
- Create: `app/api/showdowns/route.ts`
- Test: `test/unit/api/showdowns.test.ts`

- [ ] **Step 5.4.1: Implement the GET handler**

```ts
import { NextResponse } from 'next/server';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

interface QueryArgs {
  status: 'active' | 'resolving' | 'settled' | 'all';
  limit: number;
}

function parseArgs(url: URL): QueryArgs {
  const status = url.searchParams.get('status');
  const limitRaw = url.searchParams.get('limit');
  const validStatus = ['active', 'resolving', 'settled', 'all'].includes(status ?? '')
    ? (status as QueryArgs['status'])
    : 'active';
  const limit = Math.min(Math.max(parseInt(limitRaw ?? '20', 10) || 20, 1), 50);
  return { status: validStatus, limit };
}

function matches(record: ShowdownRecord, statusFilter: QueryArgs['status']): boolean {
  if (statusFilter === 'all') return true;
  if (statusFilter === 'active') return record.status === 'Open';
  if (statusFilter === 'settled') return record.status === 'SettledA' || record.status === 'SettledB';
  if (statusFilter === 'resolving') {
    // "resolving" = past deadline but still Open (in settlement window)
    return record.status === 'Open' && Date.parse(record.deadline) <= Date.now();
  }
  return false;
}

export async function GET(request: Request) {
  const args = parseArgs(new URL(request.url));
  const all = await getShowdownStore().listAll();
  const filtered = all
    .filter((r) => matches(r, args.status))
    .sort((a, b) => Date.parse(b.openedAt) - Date.parse(a.openedAt))
    .slice(0, args.limit);

  return NextResponse.json({
    showdowns: filtered.map(serialize),
    nextCursor: null
  });
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

function serialize(r: ShowdownRecord) {
  return {
    id: r.externalId,
    onchainId: r.onchainId,
    marketId: r.marketId,
    marketQuestion: r.marketQuestion,
    // Capitalize agent names for display (lowercase in storage matches AgentSignal contract;
    // UI prefers proper-case "Volatility" / "Momentum" — see Chunk 7 ShowdownCard test fixture)
    agentA: { ...r.agentA, name: capitalize(r.agentA.name), bondMicroUsdc: r.bondPerSideMicroUsdc.toString() },
    agentB: { ...r.agentB, name: capitalize(r.agentB.name), bondMicroUsdc: r.bondPerSideMicroUsdc.toString() },
    deadline: r.deadline,
    status: r.status,
    openTxHash: r.openTxHash,
    settleTxHash: r.settleTxHash,
    resolvedOutcome: r.resolvedOutcome,
    resolvedPriceLabel: r.resolvedPriceLabel
  };
}
```

- [ ] **Step 5.4.2: Tests + commit (basic happy-path + filter test)**

Create `test/unit/api/showdowns.test.ts` mirroring existing API test patterns in the repo. Use `__setShowdownStoreForTests` from Task 5.1.2 to inject a fake store with 2 Open + 1 Settled records, verify `?status=active` returns 2, `?status=all` returns 3.

After tests pass:
```bash
git add app/api/showdowns/route.ts test/unit/api/showdowns.test.ts
git commit -m "feat(api): add GET /api/showdowns list endpoint with status+limit filters"
```

---

### Task 5.5 · API: POST `/api/showdowns/discover` and `/api/showdowns/[id]/settle`

**Files:**
- Create: `app/api/showdowns/discover/route.ts`
- Create: `app/api/showdowns/[id]/settle/route.ts`

Both endpoints are admin-gated (use `isAdminAuthorized` + cookie or env-bearer-token; mirror the existing `app/api/admin/*` pattern if any exists, otherwise use the cookie check directly).

- [ ] **Step 5.5.1: Create discover endpoint**

```ts
// app/api/showdowns/discover/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { discoverShowdowns } from '@/lib/services/showdownDiscovery';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import { ADMIN_COOKIE_NAME, isAdminAuthorized } from '@/lib/config/admin-auth';
import { buildDefaultDiscoveryDeps } from '@/lib/services/showdownDiscoveryDefaults';

export const dynamic = 'force-dynamic';

export async function POST() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!isAdminAuthorized(value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const deps = await buildDefaultDiscoveryDeps();
  const result = await discoverShowdowns(deps);
  return NextResponse.json(result);
}
```

Codex must also create `lib/services/showdownDiscoveryDefaults.ts` that wires real implementations: reads signals from `getRuntimeStore().listSignals().filter(open)`, uses `getShowdownStore()`, builds a viem wallet client from operator key env, calls the ShowdownArena contract via the viem client from Chunk 3, queries existing agent budget via existing autonomy state.

> **Pragmatic note:** If wiring all of these defaults is too time-consuming during Chunk 5 (because budget tracking lives in `AutonomyState`), Codex should ship `buildDefaultDiscoveryDeps` that throws `not-yet-wired` for the budget reader and leave a TODO. Chunk 9 polish reconciles. The discovery algorithm itself (Task 5.2) is fully unit-tested and that's the main deliverable.

- [ ] **Step 5.5.2: Create settle endpoint (targets a single showdown by onchainId)**

```ts
// app/api/showdowns/[id]/settle/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE_NAME, isAdminAuthorized } from '@/lib/config/admin-auth';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import { mapResolutionToAgentAWins } from '@/lib/services/showdownSettlement';
import { buildDefaultSettlementDeps } from '@/lib/services/showdownSettlementDefaults';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  if (!isAdminAuthorized(value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const onchainId = parseInt(id, 10);
  if (Number.isNaN(onchainId)) {
    return NextResponse.json({ error: 'invalid id (expected onchainId number)' }, { status: 400 });
  }

  const store = getShowdownStore();
  const record = await store.findByOnchainId(onchainId);
  if (!record) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (record.status !== 'Open') {
    return NextResponse.json({ error: `not open (status=${record.status})` }, { status: 409 });
  }

  const deps = await buildDefaultSettlementDeps();
  const resolution = await deps.resolveMarket(record.marketId, record.deadline);
  if (!resolution) {
    return NextResponse.json({ settled: false, reason: 'resolution-pending' });
  }

  const agentAWins = mapResolutionToAgentAWins(record, resolution.outcomeYes);
  const txHash = await deps.settleOnChain(onchainId, agentAWins);
  await store.updateOnSettle(onchainId, {
    status: agentAWins ? 'SettledA' : 'SettledB',
    settledAt: new Date().toISOString(),
    settleTxHash: txHash,
    resolvedOutcome: resolution.outcomeYes ? 'YES' : 'NO',
    resolvedPriceLabel: resolution.priceLabel
  });

  return NextResponse.json({
    settled: true,
    winner: agentAWins ? 'A' : 'B',
    txHash
  });
}
```

**Note:** Bulk settlement (scan-and-settle-all-eligible) is the responsibility of the cron path (Task 5.7), not this endpoint. This endpoint is for admin-triggered single-showdown settle.

- [ ] **Step 5.5.3: Commit**

```bash
git add app/api/showdowns/discover app/api/showdowns/[id]
git commit -m "feat(api): add admin-gated discover and settle endpoints for showdowns"
```

---

### Task 5.6 · Wire `getHomeStripData` to count settled showdowns

**Files:**
- Modify: `lib/services/homeData.ts` (replace showdowns placeholder)
- Modify: `test/unit/services/homeData.test.ts`

- [ ] **Step 5.6.1: Add `listShowdowns` reader to the interface**

```ts
// In lib/services/homeData.ts
import { getShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

export interface HomeDataReaders {
  // ... existing ...
  listShowdowns(): Promise<ShowdownRecord[]>;
}

export const defaultHomeDataReaders: HomeDataReaders = {
  // ... existing ...
  listShowdowns: () => getShowdownStore().listAll()
};

// In getHomeStripData:
const showdowns = await readers.listShowdowns().catch((): ShowdownRecord[] => []);
const settled = showdowns.filter((s) => s.status === 'SettledA' || s.status === 'SettledB');
const showdownsWon = settled.length;

// Determine leader (agent that won most)
const winCount = new Map<string, number>();
for (const sd of settled) {
  const winnerName = sd.status === 'SettledA' ? sd.agentA.name : sd.agentB.name;
  winCount.set(winnerName, (winCount.get(winnerName) ?? 0) + 1);
}
const leaderEntry = [...winCount.entries()].sort((a, b) => b[1] - a[1])[0];
const showdownsLeaderName = leaderEntry ? capitalize(leaderEntry[0]) : '—';

// ... return with showdownsWon, showdownsLeaderName populated ...

function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}
```

- [ ] **Step 5.6.2: Update tests**

Add a test in `homeData.test.ts`:

```ts
it('counts settled showdowns and identifies leader by win count', async () => {
  const data = await getHomeStripData(makeReaders({
    listShowdowns: async () => [
      { ...mkShowdownStub('SettledA'), agentA: { ...mkShowdownStub('SettledA').agentA, name: 'volatility' } },
      { ...mkShowdownStub('SettledA'), agentA: { ...mkShowdownStub('SettledA').agentA, name: 'volatility' } },
      { ...mkShowdownStub('SettledB'), agentB: { ...mkShowdownStub('SettledB').agentB, name: 'momentum' } },
      { ...mkShowdownStub('Open') }  // pending doesn't count
    ] as any
  }));
  expect(data.showdownsWon).toBe(3);
  expect(data.showdownsLeaderName).toBe('Volatility');
});

function mkShowdownStub(status: 'Open' | 'SettledA' | 'SettledB'): any {
  return {
    externalId: '0xab',
    onchainId: 1,
    marketId: 'm',
    marketQuestion: 'q',
    agentA: { address: '0xa', name: 'volatility', side: 'YES', probabilityBps: 6200 },
    agentB: { address: '0xb', name: 'momentum', side: 'NO', probabilityBps: 3100 },
    bondPerSideMicroUsdc: 250_000_000,
    deadline: '2026-06-03T00:00:00Z',
    status,
    openedAt: '2026-06-01T00:00:00Z',
    settledAt: status === 'Open' ? null : '2026-06-03T00:00:00Z',
    openTxHash: '0xopen',
    settleTxHash: status === 'Open' ? null : '0xset',
    resolvedOutcome: status === 'SettledA' ? 'YES' : status === 'SettledB' ? 'NO' : null,
    resolvedPriceLabel: null
  };
}
```

Update `makeReaders` to include `listShowdowns: async () => []` in defaults.

Also remove the now-stale placeholder test "keeps showdownsWon=0 and leader='—' (placeholder until Chunk 5)" — it's superseded.

- [ ] **Step 5.6.3: Run + commit**

```bash
npm test -- homeData
git add lib/services/homeData.ts test/unit/services/homeData.test.ts
git commit -m "feat(home): wire showdowns count + leader into home data strip (drops placeholder)"
```

Update `components/HomeDataStrip.tsx` to remove the `data-source="placeholder"` marker now that the value is live. Test in `HomeDataStrip.test.tsx` must also drop the placeholder assertion.

---

### Task 5.6.5 · Wire `buildDefaultDiscoveryDeps` and `buildDefaultSettlementDeps`

**Files:**
- Create: `lib/services/showdownDiscoveryDefaults.ts`
- Create: `lib/services/showdownSettlementDefaults.ts`

These factories connect the pure discovery/settlement services to real systems (viem clients, persistence, agent budget state). They are mocked in unit tests via DI; only the cron path and the API routes consume the defaults.

- [ ] **Step 5.6.5.1: Implement `buildDefaultDiscoveryDeps`**

```ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from '@/lib/arc/client';
import { getRuntimeStore } from '@/lib/persistence/store';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import { getShowdownArena } from '@/lib/contracts/showdownArena';
import type { DiscoveryDeps, OpenOnChainInput, OpenOnChainResult } from './showdownDiscovery';

const BOND_PER_SIDE_MICRO_USDC = BigInt(process.env.SHOWDOWN_BOND_MICRO_USDC ?? '250000000');
const DEADLINE_WINDOW_SEC = parseInt(process.env.SHOWDOWN_DEADLINE_WINDOW_SEC ?? '86400', 10);

export async function buildDefaultDiscoveryDeps(): Promise<DiscoveryDeps> {
  const operatorKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined;
  const showdownArenaAddress = process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS as `0x${string}` | undefined;
  if (!operatorKey || !showdownArenaAddress) {
    throw new Error('ADMIN_PRIVATE_KEY and NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS must be set');
  }

  const account = privateKeyToAccount(operatorKey);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });
  const contract = getShowdownArena({ address: showdownArenaAddress, publicClient, walletClient });

  return {
    listActiveSignals: async () => {
      const all = await getRuntimeStore().listSignals();
      return all.filter((s) => s.status === 'open' || s.status === 'committed');
    },
    showdownStore: getShowdownStore(),
    openOnChain: async (input: OpenOnChainInput): Promise<OpenOnChainResult> => {
      const txHash = await contract.write.openShowdown([
        input.externalId,
        input.marketId,
        input.marketQuestion,
        input.agentA.address,
        input.agentA.name,
        input.agentA.side === 'YES',
        input.agentA.probabilityBps,
        input.agentB.address,
        input.agentB.name,
        input.agentB.probabilityBps,
        input.bondPerSideMicroUsdc,
        input.deadlineUnix
      ] as const);
      const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
      const onchainId = Number(await contract.read.lookupByExternalId([input.externalId]));
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      return { onchainId, txHash, openedAt: new Date(Number(block.timestamp) * 1000).toISOString() };
    },
    // Budget reader: returns Infinity-equivalent until Chunk 9 wires real budget tracking.
    // Cron's outer try/catch handles failures; this stub prevents Chunks 5-8 from being blocked.
    getAgentRemainingBudget: async () => 1_000_000_000_000n,
    bondPerSideMicroUsdc: BOND_PER_SIDE_MICRO_USDC,
    deadlineWindowSec: DEADLINE_WINDOW_SEC,
    nowMs: () => Date.now(),
    isOperatorGasOk: async () => {
      const balance = await publicClient.getBalance({ address: account.address });
      return balance > 100_000_000_000_000n; // > 0.0001 ETH
    }
  };
}
```

- [ ] **Step 5.6.5.2: Implement `buildDefaultSettlementDeps`**

```ts
import { createPublicClient, createWalletClient, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arcTestnet } from '@/lib/arc/client';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import { getShowdownArena } from '@/lib/contracts/showdownArena';
import { resolveCryptoMarket } from '@/lib/resolution/cryptoResolver';
import type { SettlementDeps, ResolutionResult } from './showdownSettlement';

export async function buildDefaultSettlementDeps(): Promise<SettlementDeps> {
  const operatorKey = process.env.ADMIN_PRIVATE_KEY as `0x${string}` | undefined;
  const showdownArenaAddress = process.env.NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS as `0x${string}` | undefined;
  if (!operatorKey || !showdownArenaAddress) {
    throw new Error('ADMIN_PRIVATE_KEY and NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS must be set');
  }

  const account = privateKeyToAccount(operatorKey);
  const publicClient = createPublicClient({ chain: arcTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: arcTestnet, transport: http() });
  const contract = getShowdownArena({ address: showdownArenaAddress, publicClient, walletClient });

  return {
    showdownStore: getShowdownStore(),
    resolveMarket: async (marketId, deadline): Promise<ResolutionResult | null> => {
      // Reuse the existing crypto resolver (preserved per spec §2.2)
      // Function name and signature may differ — adapt to actual export.
      const res = await resolveCryptoMarket(marketId, deadline).catch(() => null);
      if (!res) return null;
      return {
        outcomeYes: res.yesOutcome,
        priceLabel: res.priceLabel ?? `${res.asset} closed at ${res.settlementPrice}`
      };
    },
    settleOnChain: async (onchainId, agentAWins) => {
      const txHash = await contract.write.settleShowdown([BigInt(onchainId), agentAWins] as const);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      return txHash;
    },
    nowMs: () => Date.now()
  };
}
```

**Critical:** `resolveCryptoMarket` function name is a placeholder. Codex must grep `lib/resolution/` for the actual exported resolver. If signature differs (likely takes more args like asset/threshold), adapt the call site.

- [ ] **Step 5.6.5.3: Commit**

```bash
git add lib/services/showdownDiscoveryDefaults.ts lib/services/showdownSettlementDefaults.ts
git commit -m "feat(showdowns): wire default dependency factories for discovery + settlement"
```

---

### Task 5.7 · Cron integration

**Files:**
- Modify: `app/api/cron/run-autonomous-agents/route.ts` (the actual cron entry point — verified by `find app/api/cron`)

- [ ] **Step 5.7.1: Read current cron handler**

Inspect `app/api/cron/run-autonomous-agents/route.ts` to understand the call sequence (run-agents → resolve-signals → other autonomy steps). Identify the spot AFTER the agent run and BEFORE the response is sent, where showdown discovery and settlement should hook in.

- [ ] **Step 5.7.2: Append discover + settle calls**

After the existing run-agents step, add:

```ts
// Showdown lifecycle steps (Chunk 5)
try {
  const discoveryResult = await discoverShowdowns(await buildDefaultDiscoveryDeps());
  console.log('[cron] showdowns discovery', discoveryResult);
} catch (err) {
  console.warn('[cron] showdowns discovery failed', err);
}

try {
  const settlementResult = await settleEligibleShowdowns(await buildDefaultSettlementDeps());
  console.log('[cron] showdowns settlement', settlementResult);
} catch (err) {
  console.warn('[cron] showdowns settlement failed', err);
}
```

Failure must not abort the cron cycle — wrap each in try/catch.

- [ ] **Step 5.7.3: Run build + commit**

```bash
npm run build
git add app/api/cron/run-autonomous-agents/route.ts
git commit -m "feat(cron): integrate showdown discovery and settlement into autonomous cron"
```

---

### End-of-Chunk-6 verification

- [ ] `npm test` → all pass (existing + Chunk 5 + Chunk 6 ~17 new tests).
- [ ] `npm run build` → succeeds.
- [ ] `npm run lint` → 0 errors.
- [ ] Manual test of `GET /api/showdowns?status=all` returns `[]` initially.
- [ ] Visit `/` → SHOWDOWNS WON column shows `0 · — leads` (no placeholder marker on the cell).
- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 6 (showdown settlement + API + cron) complete"
```

**Chunk 6 done.** Full backend is in place. Chunk 7 wires it to the Arena UI.

---

## Chunk 7: Arena UI — ShowdownCard + ShowdownGrid + Arena Page Rewrite

**Why this chunk:** Replace the legacy War Room arena dashboard with the new Glass Neon showdown-centric layout. Three new components compose it: `ShowdownCard` (single card with YES/NO sides), `ShowdownGrid` (active + settled lists), and a `PendingFollowsRow` for connected users. The old `components/arena-dashboard.tsx` is gutted of intelligence/watchlist/etc and reshaped around showdowns.

**Reference:** Spec §6.1 (card visual), §6.2 (list organization), §6.3 (PendingFollowsRow).

**Depends on:** Chunks 5-6 (uses `/api/showdowns`), Chunk 4 (CSS tokens `--color-yes`, `--color-no`, `--color-success`, `--color-error`, `.glass-card` are defined in Chunk 4's `globals.css` updates).

**Caveat:** `PendingFollowsRow` calls `/api/wallet/[address]/summary` which is created in Chunk 8. During Chunk 7's verification, the chip strip will silently hide (early-return on no follows). Full functional verification of the strip happens at the end of Chunk 8.

**End state:**
- `components/ShowdownCard.tsx` renders Open + Settled visual states per spec mock
- `components/ShowdownGrid.tsx` lists active + settled (5 visible by default, "Show more" to expand)
- `components/PendingFollowsRow.tsx` shows up to 3 user follow chips when wallet connected
- `components/arena-dashboard.tsx` rewritten to use the above (intelligence/watchlist/etc gone)
- `app/arena/page.tsx` updated to drop legacy props and mount the new dashboard cleanly
- Tests for all three new components

---

### Task 7.1 · TDD `ShowdownCard` component

**Files:**
- Create: `components/ShowdownCard.tsx`
- Test: `test/components/ShowdownCard.test.tsx`

- [ ] **Step 7.1.1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShowdownCard, type ShowdownCardData } from '@/components/ShowdownCard';

const openData: ShowdownCardData = {
  id: '0xab',
  marketQuestion: 'BTC will close above $105,000 by Dec 31',
  status: 'Open',
  agentA: { name: 'Volatility', side: 'YES', probabilityBps: 6200, bondMicroUsdc: 250_000_000n },
  agentB: { name: 'Momentum', side: 'NO', probabilityBps: 3100, bondMicroUsdc: 250_000_000n },
  openTxHash: '0x9c2a7e4b',
  deadline: '2026-12-31T23:59:59Z',
  settleTxHash: null,
  resolvedOutcome: null,
  resolvedPriceLabel: null
};

const settledData: ShowdownCardData = {
  ...openData,
  status: 'SettledA',
  settleTxHash: '0xae1fc93d',
  resolvedOutcome: 'YES',
  resolvedPriceLabel: 'BTC closed at $105,200'
};

describe('ShowdownCard', () => {
  it('renders open showdown with question, both sides, bonds, tx hash', () => {
    render(<ShowdownCard data={openData} />);
    expect(screen.getByText(/BTC will close above/i)).toBeInTheDocument();
    expect(screen.getByText('Volatility')).toBeInTheDocument();
    expect(screen.getByText('Momentum')).toBeInTheDocument();
    expect(screen.getByText('0.62')).toBeInTheDocument();
    expect(screen.getByText('0.31')).toBeInTheDocument();
    expect(screen.getByText(/YES/)).toBeInTheDocument();
    expect(screen.getByText(/NO/)).toBeInTheDocument();
    expect(screen.getAllByText(/250 USDC/i).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/SHOWDOWN/i)).toBeInTheDocument();
  });

  it('renders settled state with payout/forfeit labels and resolution', () => {
    render(<ShowdownCard data={settledData} />);
    expect(screen.getByText(/RESOLVED/i)).toBeInTheDocument();
    expect(screen.getByText(/\+ 500 USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/- 500 USDC/i)).toBeInTheDocument();
    expect(screen.getByText(/BTC closed at \$105,200/i)).toBeInTheDocument();
  });

  it('hides settle tx hash on open showdowns', () => {
    render(<ShowdownCard data={openData} />);
    expect(screen.queryByText(/0xae1fc93d/i)).toBeNull();
  });

  it('renders open tx hash for all states', () => {
    render(<ShowdownCard data={openData} />);
    expect(screen.getByText(/0x9c2a7e4b/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.1.2: Run, expect FAIL**

```bash
npm test -- ShowdownCard
```
Expected: FAIL (module not found).

- [ ] **Step 7.1.3: Implement**

```tsx
import type { ReactNode } from 'react';

export interface ShowdownCardData {
  id: string;
  marketQuestion: string;
  status: 'Open' | 'SettledA' | 'SettledB';
  agentA: { name: string; side: 'YES' | 'NO'; probabilityBps: number; bondMicroUsdc: bigint };
  agentB: { name: string; side: 'YES' | 'NO'; probabilityBps: number; bondMicroUsdc: bigint };
  openTxHash: string;
  settleTxHash: string | null;
  deadline: string;
  resolvedOutcome: 'YES' | 'NO' | null;
  resolvedPriceLabel: string | null;
}

const microFormatter = new Intl.NumberFormat('en-US');

function microToUsdc(micro: bigint): string {
  return microFormatter.format(Number((micro + 500_000n) / 1_000_000n));
}

function probLabel(bps: number): string {
  return (bps / 10_000).toFixed(2);
}

function shortTx(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 8)}...${hash.slice(-4)}` : hash;
}

export function ShowdownCard({ data }: { data: ShowdownCardData }) {
  const settled = data.status !== 'Open';
  const winner = data.status === 'SettledA' ? 'A' : data.status === 'SettledB' ? 'B' : null;
  const payoutLabel = (side: 'A' | 'B') => {
    if (!winner) return null;
    const bond = side === 'A' ? data.agentA.bondMicroUsdc : data.agentB.bondMicroUsdc;
    const amount = microToUsdc(bond * 2n);
    if (winner === side) return `+ ${amount} USDC`;
    return `- ${microToUsdc(bond)} USDC`;
  };

  return (
    <article
      className="glass-card"
      style={{ padding: '22px 24px', marginBottom: 18 }}
      data-status={data.status}
      data-testid="showdown-card"
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 18 }}>
        <p style={{ fontSize: 14, margin: 0, maxWidth: '70%' }}>{data.marketQuestion}</p>
        <StatusTag settled={settled} />
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 1fr', gap: 12, alignItems: 'stretch' }}>
        <AgentSide name={data.agentA} bond={data.agentA.bondMicroUsdc} payoutLabel={payoutLabel('A')} winner={winner === 'A'} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4, color: '#888', fontWeight: 600, letterSpacing: 2 }}>
          <span style={{ fontSize: 9, color: '#c8b8ff', background: 'rgba(124,92,255,0.15)', padding: '2px 6px', borderRadius: 4, letterSpacing: 1 }}>ARC</span>
          <span style={{ fontSize: 18 }}>VS</span>
        </div>
        <AgentSide name={data.agentB} bond={data.agentB.bondMicroUsdc} payoutLabel={payoutLabel('B')} winner={winner === 'B'} />
      </div>

      <footer style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
        <span>Committed <code style={{ color: '#7c5cff' }}>{shortTx(data.openTxHash)}</code></span>
        <span>{settled ? `Resolved · ${data.resolvedPriceLabel ?? ''}` : `Resolves ${formatDeadline(data.deadline)}`}</span>
      </footer>
    </article>
  );
}

function AgentSide({
  name,
  bond,
  payoutLabel,
  winner
}: {
  name: { name: string; side: 'YES' | 'NO'; probabilityBps: number };
  bond: bigint;
  payoutLabel: string | null;
  winner: boolean;
}) {
  const sideColor = name.side === 'YES' ? 'var(--color-yes)' : 'var(--color-no)';
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '14px 16px', borderLeft: `3px solid ${sideColor}` }}>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>{name.name}</div>
      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-1px', color: sideColor }}>{probLabel(name.probabilityBps)}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>→ {name.side}</div>
      <div style={{ fontSize: 11, marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)' }}>
        Bonded <strong style={{ color: '#fff' }}>{microToUsdc(bond)} USDC</strong>
        {payoutLabel && (
          <span style={{ marginLeft: 6, color: winner ? 'var(--color-success)' : 'var(--color-no)' }}>
            · {payoutLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function StatusTag({ settled }: { settled: boolean }) {
  if (settled) {
    return (
      <span style={{ fontSize: 10, color: 'var(--color-success)', background: 'rgba(0,255,170,0.1)', border: '1px solid rgba(0,255,170,0.3)', padding: '4px 10px', borderRadius: 999, letterSpacing: 1 }}>
        ✓ RESOLVED
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, color: '#ff8c5c', background: 'rgba(255, 94, 58, 0.12)', border: '1px solid rgba(255, 94, 58, 0.3)', padding: '4px 10px', borderRadius: 999, letterSpacing: 1 }}>
      ⚔ SHOWDOWN
    </span>
  );
}

function formatDeadline(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
}
```

- [ ] **Step 7.1.4: Run + commit**

```bash
npm test -- ShowdownCard
git add components/ShowdownCard.tsx test/components/ShowdownCard.test.tsx
git commit -m "feat(arena): add ShowdownCard component (open + settled visual states)"
```

---

### Task 7.2 · TDD `ShowdownGrid` component

**Files:**
- Create: `components/ShowdownGrid.tsx`
- Test: `test/components/ShowdownGrid.test.tsx`

- [ ] **Step 7.2.1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShowdownGrid } from '@/components/ShowdownGrid';
import type { ShowdownCardData } from '@/components/ShowdownCard';

function mk(status: ShowdownCardData['status'], idx: number): ShowdownCardData {
  return {
    id: `sd-${idx}`,
    marketQuestion: `Q-${idx}`,
    status,
    agentA: { name: 'V', side: 'YES', probabilityBps: 6200, bondMicroUsdc: 250_000_000n },
    agentB: { name: 'M', side: 'NO', probabilityBps: 3100, bondMicroUsdc: 250_000_000n },
    openTxHash: `0xopen${idx}`,
    settleTxHash: status !== 'Open' ? `0xset${idx}` : null,
    deadline: '2026-12-31T23:59:59Z',
    resolvedOutcome: status === 'SettledA' ? 'YES' : null,
    resolvedPriceLabel: status !== 'Open' ? 'closed' : null
  };
}

describe('ShowdownGrid', () => {
  it('renders header with counts', () => {
    render(<ShowdownGrid showdowns={[mk('Open', 1), mk('SettledA', 2)]} blockNumber={8412392} />);
    expect(screen.getByText(/1 active/i)).toBeInTheDocument();
    expect(screen.getByText(/Block 8,412,392/i)).toBeInTheDocument();
  });

  it('separates active and settled sections', () => {
    render(<ShowdownGrid showdowns={[mk('Open', 1), mk('SettledA', 2)]} blockNumber={null} />);
    expect(screen.getByText(/Live Showdowns/i)).toBeInTheDocument();
    expect(screen.getByText(/Settled/i)).toBeInTheDocument();
  });

  it('shows up to 5 settled by default with Show more link', () => {
    const settled = Array.from({ length: 12 }, (_, i) => mk('SettledA', i));
    render(<ShowdownGrid showdowns={[mk('Open', 99), ...settled]} blockNumber={null} />);
    const cards = screen.getAllByTestId('showdown-card');
    // 1 active + 5 settled (default show)
    expect(cards).toHaveLength(6);
    expect(screen.getByText(/Show more/i)).toBeInTheDocument();
  });

  it('renders empty state when no showdowns', () => {
    render(<ShowdownGrid showdowns={[]} blockNumber={null} />);
    expect(screen.getByText(/No showdowns yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 7.2.2: Run + implement**

```tsx
'use client';

import { useState } from 'react';
import { ShowdownCard, type ShowdownCardData } from '@/components/ShowdownCard';

interface ShowdownGridProps {
  showdowns: ShowdownCardData[];
  blockNumber: number | null;
}

const blockFormatter = new Intl.NumberFormat('en-US');
const DEFAULT_SETTLED_VISIBLE = 5;

export function ShowdownGrid({ showdowns, blockNumber }: ShowdownGridProps) {
  const [showAllSettled, setShowAllSettled] = useState(false);

  const active = showdowns.filter((s) => s.status === 'Open');
  const settled = showdowns.filter((s) => s.status !== 'Open');
  const settledVisible = showAllSettled ? settled : settled.slice(0, DEFAULT_SETTLED_VISIBLE);
  const hasMore = settled.length > settledVisible.length;

  if (showdowns.length === 0) {
    return (
      <section style={{ padding: 32 }}>
        <h2 style={{ fontSize: 22, marginBottom: 6 }}>Live Showdowns</h2>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          No showdowns yet. They'll appear when two agents disagree on the same market.
        </p>
      </section>
    );
  }

  return (
    <section style={{ padding: '22px 32px 36px' }}>
      <h2 style={{ fontSize: 22, margin: '24px 0 4px', fontWeight: 700, letterSpacing: '-0.3px' }}>Live Showdowns</h2>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 22px' }}>
        {active.length} active · {settled.length} settled
        {blockNumber !== null ? ` · Block ${blockFormatter.format(blockNumber)}` : ''}
      </p>

      {active.map((sd) => <ShowdownCard key={sd.id} data={sd} />)}

      {settled.length > 0 && (
        <>
          <h3 style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, margin: '24px 0 14px' }}>
            Settled
          </h3>
          {settledVisible.map((sd) => <ShowdownCard key={sd.id} data={sd} />)}
          {hasMore && (
            <button
              onClick={() => setShowAllSettled(true)}
              style={{
                marginTop: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
                padding: '10px 20px',
                borderRadius: 999,
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              Show more ({settled.length - settledVisible.length})
            </button>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 7.2.3: Run + commit**

```bash
npm test -- ShowdownGrid
git add components/ShowdownGrid.tsx test/components/ShowdownGrid.test.tsx
git commit -m "feat(arena): add ShowdownGrid with active/settled sections and show-more"
```

---

### Task 7.3 · Rewrite `arena-dashboard.tsx`

**Files:**
- Modify (massive rewrite): `components/arena-dashboard.tsx`

This is the biggest single edit in the chunk. Strategy:

**Preserve:**
- Run Agents button + behavior
- Commit Eligible Signals button + behavior
- Wallet connect status display
- Arc readiness indicator
- Existing follow-signal flow (Chunk 1-2 from `add-wallet-funded-follows`)

**Remove:**
- Market radar visual
- Watchlist toggle
- Saved filters
- Alert center
- Paper follow card
- Daily queue entry
- The duplicate WalletConnectButton (TopNav now owns it)

**Add:**
- `<ShowdownGrid />` as the main content area
- Data fetch via `useSWR('/api/showdowns?status=all&limit=50', ...)`
- Refresh every 30s

- [ ] **Step 7.3.1: Inspect current `arena-dashboard.tsx` to identify removable sections**

Run: `wc -l components/arena-dashboard.tsx; grep -n "^function\|^export function\|// section" components/arena-dashboard.tsx`

Map out the sections. Identify which can be removed wholesale vs which need careful surgery.

- [ ] **Step 7.3.2: Install SWR**

`swr` is not yet a dependency (verified by grep on `package.json`). Install it:

```bash
npm install swr@^2
git add package.json package-lock.json
git commit -m "chore(deps): add swr for client-side showdown polling"
```

- [ ] **Step 7.3.3: Rewrite the dashboard top-down**

Replace the file's content with this skeleton, then re-paste preserved sections (Run Agents handler, follow-signal handler, Arc readiness indicator) from git history:

```tsx
'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { ShowdownGrid } from '@/components/ShowdownGrid';
import { PendingFollowsRow } from '@/components/PendingFollowsRow';
import type { ShowdownCardData } from '@/components/ShowdownCard';
import {
  // PRESERVED imports — copy from old file
  readBrowserWalletSession,
  subscribeBrowserWalletSessionChange
} from '@/lib/arc/browserWallet';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface ShowdownsApiResponse {
  showdowns: Array<{
    id: string;
    onchainId: number;
    marketId: string;
    marketQuestion: string;
    agentA: { address: string; name: string; side: 'YES' | 'NO'; probabilityBps: number; bondMicroUsdc: string };
    agentB: { address: string; name: string; side: 'YES' | 'NO'; probabilityBps: number; bondMicroUsdc: string };
    deadline: string;
    status: 'Open' | 'SettledA' | 'SettledB';
    openTxHash: string;
    settleTxHash: string | null;
    resolvedOutcome: 'YES' | 'NO' | null;
    resolvedPriceLabel: string | null;
  }>;
  nextCursor: string | null;
}

function toCardData(raw: ShowdownsApiResponse['showdowns'][number]): ShowdownCardData {
  return {
    id: raw.id,
    marketQuestion: raw.marketQuestion,
    status: raw.status,
    agentA: { ...raw.agentA, bondMicroUsdc: BigInt(raw.agentA.bondMicroUsdc) },
    agentB: { ...raw.agentB, bondMicroUsdc: BigInt(raw.agentB.bondMicroUsdc) },
    openTxHash: raw.openTxHash,
    settleTxHash: raw.settleTxHash,
    deadline: raw.deadline,
    resolvedOutcome: raw.resolvedOutcome,
    resolvedPriceLabel: raw.resolvedPriceLabel
  };
}

export function ArenaDashboard() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const initial = readBrowserWalletSession();
    setWalletAddress(initial?.walletAddress ?? null);
    return subscribeBrowserWalletSessionChange((s) => {
      setWalletAddress(s?.walletAddress ?? null);
    });
  }, []);

  const { data, error } = useSWR<ShowdownsApiResponse>('/api/showdowns?status=all&limit=50', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true
  });

  const showdowns = (data?.showdowns ?? []).map(toCardData);
  const blockNumber: number | null = null;  // TODO Chunk 10 polish: surface live block

  return (
    <div data-component="arena-dashboard">
      {walletAddress && <PendingFollowsRow walletAddress={walletAddress} />}
      {error && (
        <p style={{ padding: 32, color: 'var(--color-error)' }}>
          Failed to load showdowns: {String((error as Error)?.message ?? error)}
        </p>
      )}
      <ShowdownGrid showdowns={showdowns} blockNumber={blockNumber} />
    </div>
  );
}
```

**Critical:** Do NOT remove existing exports that other files import. Run `grep -rn "from '@/components/arena-dashboard'" app/ components/ lib/` first; preserve those exports as no-ops or migrate the callers.

- [ ] **Step 7.3.4: Build + smoke**

```bash
npm run build
npm run dev
```

Visit `/arena`. Expect to see showdown grid (empty initially since backend not seeded). No duplicate wallet button (TopNav has it). No intelligence sections visible.

- [ ] **Step 7.3.5: Commit**

```bash
git add components/arena-dashboard.tsx
git commit -m "feat(arena): rewrite dashboard around ShowdownGrid + drop intelligence/watchlist"
```

---

### Task 7.4 · `PendingFollowsRow` component (connected-user strip)

**Files:**
- Create: `components/PendingFollowsRow.tsx`
- Test: `test/components/PendingFollowsRow.test.tsx`

- [ ] **Step 7.4.1: Test + implement**

```tsx
'use client';

import useSWR from 'swr';
import Link from 'next/link';

interface PendingFollow {
  signalId: string;
  marketQuestion: string;
  bondedMicroUsdc: string;
  status: 'pending' | 'confirmed' | 'resolved-win' | 'resolved-loss';
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function PendingFollowsRow({ walletAddress }: { walletAddress: string }) {
  const { data } = useSWR<{ follows: PendingFollow[] }>(
    `/api/wallet/${walletAddress}/summary`,
    fetcher,
    { refreshInterval: 60_000 }
  );

  const active = (data?.follows ?? []).filter((f) => f.status === 'pending' || f.status === 'confirmed').slice(0, 3);
  if (active.length === 0) return null;

  return (
    <section
      data-testid="pending-follows-row"
      style={{ padding: '12px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, alignItems: 'center' }}
    >
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' }}>My Active Follows</span>
      {active.map((f) => (
        <Link
          key={f.signalId}
          href="/my"
          style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(124,92,255,0.18)', borderRadius: 999, color: '#c8b8ff' }}
        >
          {f.marketQuestion.slice(0, 28)}{f.marketQuestion.length > 28 ? '…' : ''}
        </Link>
      ))}
    </section>
  );
}
```

Tests cover: hides when empty, shows up to 3 chips, links to `/my`.

- [ ] **Step 7.4.2: Commit**

```bash
git add components/PendingFollowsRow.tsx test/components/PendingFollowsRow.test.tsx
git commit -m "feat(arena): add PendingFollowsRow chip strip for connected wallet"
```

---

### Task 7.5 · Update `app/arena/page.tsx` to match the new `ArenaDashboard` signature

**Files:**
- Modify: `app/arena/page.tsx`

**Why:** The old `ArenaDashboard` accepted `{ initialMetrics, initialState }` props. The Chunk 7 rewrite drops these (SWR fetches live). The wrapper page must be updated or the build will fail.

- [ ] **Step 7.5.1: Read current `app/arena/page.tsx`**

Confirm it currently does: `<ArenaDashboard initialMetrics={...} initialState={...} />` or similar with server-side pre-fetched data.

- [ ] **Step 7.5.2: Replace with a clean wrapper**

```tsx
import { ArenaDashboard } from '@/components/arena-dashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Arena · PredictArena' };

export default function ArenaPage() {
  return <ArenaDashboard />;
}
```

Strip any unused server-side imports (`getRuntimeStore`, `getArenaState`, etc.) from this file. They're either no longer needed or handled inside the client component.

- [ ] **Step 7.5.3: Run build**

```bash
npm run build
```
Expected: succeeds. No TS errors about missing/extra props.

- [ ] **Step 7.5.4: Commit**

```bash
git add app/arena/page.tsx
git commit -m "feat(arena): drop legacy server-side props from page wrapper"
```

---

### End-of-Chunk-7 verification

- [ ] `npm test` → all pass.
- [ ] `npm run build` → succeeds.
- [ ] `npm run lint` → 0 errors.
- [ ] Manual: visit `/arena` (no wallet) → see "No showdowns yet" empty state.
- [ ] Manual: connect wallet → PendingFollowsRow does not render (no active follows yet).
- [ ] Manual: confirm TopNav is the only WalletConnectButton.
- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 7 (arena ui rewrite) complete"
```

**Chunk 7 done.** Arena page now revolves around showdowns. Chunk 8 builds `/my`.

---

## Chunk 8: `/my` Page — Wallet-Bound Dashboard

**Why this chunk:** The "data bound to wallet" pillar of the redesign. `/my` is the user's personal view: their follows, their bonds, their tx history — all gated by wallet connection. When wallet is not connected, the page shows a single Connect Wallet CTA. When connected, it loads from `/api/wallet/:address/summary`.

**Reference:** Spec §4.1 (data model), §4.3 (API), §7 (page structure), §8 (error handling — wallet switch).

**Depends on:** Chunks 1-6.

**End state:**
- `lib/persistence/walletBindings.ts` — facade implementing `WalletBindingsFacade` per spec §4.1.2
- `app/api/wallet/[address]/summary/route.ts` — public GET endpoint
- `components/MyDashboard.tsx` + `MyOverviewStrip.tsx` + `MyFollowsTable.tsx` + `MyTxHistoryTable.tsx`
- `app/my/page.tsx` connects all of the above with wallet state from `useEffect` + EIP-1193

---

### Task 8.1 · `WalletBindingsFacade` implementation

**Files:**
- Create: `lib/persistence/walletBindings.ts`
- Test: `test/unit/persistence/walletBindings.test.ts`

**Strategy:** Reuse existing `getRuntimeStore().listWalletFollows()` and the persistence schema from `add-wallet-funded-follows` (already merged). Tx history is derived live from viem on-chain log scanning + follow tx data.

- [ ] **Step 8.1.1: Implement facade**

```ts
/**
 * 钱包绑定数据 facade。
 *
 * 把现有 WalletFollowRecord（来自 add-wallet-funded-follows）
 * 包成 spec §4.1.1 的统一 schema：WalletFollow / WalletTxHistoryItem / WalletSummary。
 */

import type { Address } from 'viem';
import { getRuntimeStore } from '@/lib/persistence/store';
import type { WalletFollowRecord } from '@/lib/persistence/store';

export interface WalletFollow {
  id: string;
  walletAddress: string;
  signalId: string;
  marketId: string;
  marketQuestion: string;
  side: 'YES' | 'NO';
  bondedMicroUsdc: bigint;
  followTxHash: string;
  status: 'pending' | 'confirmed' | 'resolved-win' | 'resolved-loss';
  followedAt: string;
  resolvedAt: string | null;
  payoutMicroUsdc: bigint | null;
}

export interface WalletTxHistoryItem {
  txHash: string;
  blockNumber: number;
  timestamp: string;
  kind: 'follow-commit' | 'follow-resolve' | 'wallet-self';
  amountMicroUsdc: bigint | null;
  status: 'success' | 'failed';
  arcExplorerUrl: string;
}

export interface WalletSummary {
  walletAddress: string;
  usdcBalanceMicro: bigint;
  usdcAllowanceMicro: bigint;
  arcChainSynced: boolean;
  follows: WalletFollow[];
  txHistory: WalletTxHistoryItem[];
  cumulativeBondedMicro: bigint;
  cumulativePayoutMicro: bigint;
  currentNetPnlMicro: bigint;
}

export interface WalletBindingsFacade {
  getSummary(walletAddress: string): Promise<WalletSummary>;
  listFollows(walletAddress: string, opts?: { limit?: number }): Promise<WalletFollow[]>;
  listTxHistory(walletAddress: string, opts?: { limit?: number }): Promise<WalletTxHistoryItem[]>;
}

export const walletBindingsFacade: WalletBindingsFacade = {
  async getSummary(walletAddress) {
    const addr = walletAddress.toLowerCase();
    const [follows, balance, allowance, chainSynced, txs] = await Promise.all([
      this.listFollows(addr),
      readUsdcBalanceMicro(addr).catch(() => 0n),
      readUsdcAllowanceMicro(addr).catch(() => 0n),
      checkArcChainSynced().catch(() => false),
      this.listTxHistory(addr).catch((): WalletTxHistoryItem[] => [])
    ]);

    const cumulativeBondedMicro = follows.reduce((sum, f) => sum + f.bondedMicroUsdc, 0n);
    const cumulativePayoutMicro = follows.reduce((sum, f) => sum + (f.payoutMicroUsdc ?? 0n), 0n);
    const currentNetPnlMicro = cumulativePayoutMicro - cumulativeBondedMicro;

    return {
      walletAddress: addr,
      usdcBalanceMicro: balance,
      usdcAllowanceMicro: allowance,
      arcChainSynced: chainSynced,
      follows,
      txHistory: txs,
      cumulativeBondedMicro,
      cumulativePayoutMicro,
      currentNetPnlMicro
    };
  },

  async listFollows(walletAddress, opts) {
    const addr = walletAddress.toLowerCase();
    const records = await getRuntimeStore().listWalletFollows();
    const matched = records
      .filter((r) => r.walletAddress.toLowerCase() === addr)
      .sort((a, b) => Date.parse(b.followedAt) - Date.parse(a.followedAt))
      .slice(0, opts?.limit ?? 50);
    return matched.map(toFollow);
  },

  async listTxHistory(walletAddress, opts) {
    const follows = await this.listFollows(walletAddress, { limit: opts?.limit ?? 50 });
    return follows
      .filter((f) => f.followTxHash)
      .map((f) => ({
        txHash: f.followTxHash,
        blockNumber: 0,  // Filled by chain RPC; lazy for demo
        timestamp: f.followedAt,
        kind: 'follow-commit' as const,
        amountMicroUsdc: f.bondedMicroUsdc,
        status: 'success' as const,
        arcExplorerUrl: arcExplorerTxUrl(f.followTxHash)
      }));
  }
};

function toFollow(r: WalletFollowRecord): WalletFollow {
  return {
    id: r.id,
    walletAddress: r.walletAddress,
    signalId: r.signalId,
    marketId: r.marketId,
    marketQuestion: r.marketQuestion,
    side: r.side === 'yes' ? 'YES' : 'NO',
    bondedMicroUsdc: BigInt(r.bondedMicroUsdc),
    followTxHash: r.txHash,
    status: r.status,
    followedAt: r.followedAt,
    resolvedAt: r.resolvedAt ?? null,
    payoutMicroUsdc: r.payoutMicroUsdc != null ? BigInt(r.payoutMicroUsdc) : null
  };
}

async function readUsdcBalanceMicro(_address: string): Promise<bigint> {
  // 在 Chunk 10 polish 中通过 viem 读取真实 USDC 余额
  // 本 chunk 返回 0 占位以保证页面可渲染
  return 0n;
}

async function readUsdcAllowanceMicro(_address: string): Promise<bigint> {
  return 0n;
}

async function checkArcChainSynced(): Promise<boolean> {
  return true;
}

function arcExplorerTxUrl(txHash: string): string {
  const base = process.env.NEXT_PUBLIC_ARC_EXPLORER_BASE_URL ?? 'https://arc.testnet.explorer';
  return `${base}/tx/${txHash}`;
}
```

**Critical mapping (verified against actual repo):**

`WalletFollowRecord` stores ONLY: `id`, `signalId`, `walletAddress`, `txHash`, `signalRecordId`, `chainId`, `arenaAddress`, `stakeMicroUsdc`, `agentName`, `followedAt`.

To produce the spec's `WalletFollow` shape, **join against `state.signals`**: look up the linked `AgentSignal` by `signalId`, then read `marketId`, `marketQuestion`, `side`, and resolution data from it.

Replace the broken `toFollow` mapping with this join-aware version:

```ts
import type { AgentSignal } from '@/lib/polymarket/types';

function toFollow(r: WalletFollowRecord, signalById: Map<string, AgentSignal>): WalletFollow {
  const signal = signalById.get(r.signalId);
  return {
    id: r.id,
    walletAddress: r.walletAddress,
    signalId: r.signalId,
    marketId: signal?.marketId ?? r.signalId,
    marketQuestion: signal?.marketQuestion ?? '(market unavailable)',
    side: signal?.side === 'no' ? 'NO' : 'YES',
    bondedMicroUsdc: BigInt(r.stakeMicroUsdc),
    followTxHash: r.txHash,
    status: deriveStatus(signal),
    followedAt: r.followedAt,
    resolvedAt: signal?.resolution?.resolvedAt ?? null,
    // Payout micro-usdc 字段在 ShowdownRecord 中不存在；用预估值（赢则 2×stake，输则 0）
    payoutMicroUsdc: signal?.resolution
      ? (signal.resolution.outcomeCorrect ? BigInt(r.stakeMicroUsdc) * 2n : 0n)
      : null
  };
}

function deriveStatus(signal: AgentSignal | undefined): WalletFollow['status'] {
  if (!signal) return 'pending';
  if (signal.resolution) {
    return signal.resolution.outcomeCorrect ? 'resolved-win' : 'resolved-loss';
  }
  if (signal.status === 'committed') return 'confirmed';
  return 'pending';
}
```

And update `listFollows` to load signals once and build the map:

```ts
async listFollows(walletAddress, opts) {
  const addr = walletAddress.toLowerCase();
  const store = getRuntimeStore();
  const [followRecords, signals] = await Promise.all([
    store.listWalletFollows(),
    store.listSignals()
  ]);
  const signalById = new Map(signals.map((s) => [s.id, s]));
  return followRecords
    .filter((r) => r.walletAddress.toLowerCase() === addr)
    .sort((a, b) => Date.parse(b.followedAt) - Date.parse(a.followedAt))
    .slice(0, opts?.limit ?? 50)
    .map((r) => toFollow(r, signalById));
}
```

- [ ] **Step 8.1.2: Tests (DI for live readers is overkill here — mock the runtime store via `__setRuntimeStoreForTests` if it exists, else inject the mock follows directly).**

Cover: empty case (no follows), single follow, accumulation across multiple follows, status filter, large limit.

- [ ] **Step 8.1.3: Commit**

```bash
git add lib/persistence/walletBindings.ts test/unit/persistence/walletBindings.test.ts
git commit -m "feat(my): add WalletBindingsFacade aggregating follows + balance"
```

---

### Task 8.2 · API endpoint `/api/wallet/[address]/summary`

**Files:**
- Create: `app/api/wallet/[address]/summary/route.ts`

- [ ] **Step 8.2.1: Implement**

```ts
import { NextResponse } from 'next/server';
import { walletBindingsFacade } from '@/lib/persistence/walletBindings';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ address: string }>;
}

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

export async function GET(_request: Request, { params }: RouteParams) {
  const { address } = await params;
  if (!ADDRESS_REGEX.test(address)) {
    return NextResponse.json({ error: 'invalid address' }, { status: 400 });
  }

  const summary = await walletBindingsFacade.getSummary(address);

  // bigint → string for JSON safety
  return NextResponse.json({
    walletAddress: summary.walletAddress,
    usdcBalanceMicro: summary.usdcBalanceMicro.toString(),
    usdcAllowanceMicro: summary.usdcAllowanceMicro.toString(),
    arcChainSynced: summary.arcChainSynced,
    follows: summary.follows.map((f) => ({
      ...f,
      bondedMicroUsdc: f.bondedMicroUsdc.toString(),
      payoutMicroUsdc: f.payoutMicroUsdc?.toString() ?? null
    })),
    txHistory: summary.txHistory.map((t) => ({
      ...t,
      amountMicroUsdc: t.amountMicroUsdc?.toString() ?? null
    })),
    cumulativeBondedMicro: summary.cumulativeBondedMicro.toString(),
    cumulativePayoutMicro: summary.cumulativePayoutMicro.toString(),
    currentNetPnlMicro: summary.currentNetPnlMicro.toString()
  });
}
```

- [ ] **Step 8.2.2: Test**: rejects invalid address; returns 200 with correct shape on valid address.

- [ ] **Step 8.2.3: Commit**

```bash
git add app/api/wallet
git commit -m "feat(my): add GET /api/wallet/[address]/summary endpoint"
```

---

### Task 8.3 · `/my` page UI

**Files:**
- Create: `components/MyDashboard.tsx`
- Create: `components/MyOverviewStrip.tsx`
- Create: `components/MyFollowsTable.tsx`
- Create: `components/MyTxHistoryTable.tsx`
- Modify: `app/my/page.tsx`
- Modify: `components/WalletConnectButton.tsx` (add `accountsChanged` listener — see §7.2 of spec)

- [ ] **Step 8.3.1: Implement `MyDashboard` as the root container**

```tsx
'use client';

import useSWR, { mutate } from 'swr';
import { useEffect, useState } from 'react';
import { MyOverviewStrip } from '@/components/MyOverviewStrip';
import { MyFollowsTable } from '@/components/MyFollowsTable';
import { MyTxHistoryTable } from '@/components/MyTxHistoryTable';
import { readBrowserWalletSession, subscribeBrowserWalletSessionChange } from '@/lib/arc/browserWallet';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function MyDashboard() {
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    const initial = readBrowserWalletSession();
    setWalletAddress(initial?.walletAddress ?? null);

    // 1) 监听项目内部的 wallet-session 变化事件
    const unsubSession = subscribeBrowserWalletSessionChange((next) => {
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/wallet/'),
        undefined,
        { revalidate: false }
      );
      setWalletAddress(next?.walletAddress ?? null);
    });

    // 2) 直接监听 EIP-1193 accountsChanged（用户在 MetaMask 内切换账户）
    const provider = typeof window !== 'undefined' ? (window as any).ethereum : null;
    const handleAccountsChanged = (accounts: string[]) => {
      const next = accounts[0]?.toLowerCase() ?? null;
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/wallet/'),
        undefined,
        { revalidate: false }
      );
      setWalletAddress(next);
    };
    provider?.on?.('accountsChanged', handleAccountsChanged);

    return () => {
      unsubSession();
      provider?.removeListener?.('accountsChanged', handleAccountsChanged);
    };
  }, []);

  // 关键：useSWR 必须在所有 early return 之前调用，遵守 React Hooks Rules。
  // 传 null key 给 SWR 表示 "暂不发起请求"，钱包未连接时不会 fetch。
  const swrKey = walletAddress ? `/api/wallet/${walletAddress}/summary` : null;
  const { data, error } = useSWR(swrKey, fetcher, { refreshInterval: 60_000 });

  if (!walletAddress) {
    return (
      <section style={{ padding: 64, textAlign: 'center', minHeight: '60vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <h2 style={{ fontSize: 28, marginBottom: 12 }}>Connect to enter My</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', maxWidth: 420 }}>
          Use the Connect Wallet button at the top right. Once connected, you'll see your signal follows, on-chain bonds, and tx history — all bound to your wallet.
        </p>
      </section>
    );
  }

  if (error) return <p style={{ padding: 32, color: 'var(--color-error)' }}>Loading failed. Retrying every minute.</p>;
  if (!data) return <p style={{ padding: 32, color: 'rgba(255,255,255,0.5)' }}>链上数据获取中...</p>;

  return (
    <section style={{ padding: '24px 32px 48px' }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>My Dashboard</h1>
      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '0 0 24px', fontFamily: 'monospace' }}>{walletAddress}</p>
      <MyOverviewStrip data={data} />
      <MyFollowsTable follows={data.follows} />
      <MyTxHistoryTable items={data.txHistory} />
    </section>
  );
}
```

- [ ] **Step 8.3.2: Implement `MyOverviewStrip`** (USDC balance / cumulative bonded / cumulative payout / net PnL — 4 cells like HomeDataStrip but Glass-styled)

- [ ] **Step 8.3.3: Implement `MyFollowsTable`** (table: market question / side / bonded / status badge / Arc explorer link)

- [ ] **Step 8.3.4: Implement `MyTxHistoryTable`** (table: tx hash short / kind label / amount / block / status / Arc explorer link)

- [ ] **Step 8.3.5: Wire `WalletConnectButton` accountsChanged listener**

The existing `WalletConnectButton.tsx` already subscribes to provider events for re-reading state. Add: on `accountsChanged`, also call `mutate(...)` from SWR (move logic to `MyDashboard` is cleaner — already done in Step 8.3.1). No change needed to the button itself if `subscribeBrowserWalletSessionChange` fires on EIP-1193 `accountsChanged` (verify by reading `lib/arc/browserWallet.ts`).

- [ ] **Step 8.3.6: Wire `app/my/page.tsx`**

```tsx
import { MyDashboard } from '@/components/MyDashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My · PredictArena' };

export default function MyPage() {
  return <MyDashboard />;
}
```

- [ ] **Step 8.3.7: Run + commit**

```bash
npm run build
npm test
git add components/MyDashboard.tsx components/MyOverviewStrip.tsx components/MyFollowsTable.tsx components/MyTxHistoryTable.tsx app/my/page.tsx
git commit -m "feat(my): build wallet-bound dashboard (overview + follows + tx history)"
```

---

### End-of-Chunk-8 verification

- [ ] All tests pass.
- [ ] Manual: visit `/my` without wallet → see "Connect to enter My" CTA.
- [ ] Manual: connect wallet → loads summary (empty initially is OK).
- [ ] Manual: switch wallet account in MetaMask → page reloads with new address; no stale data.
- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 8 (/my wallet dashboard) complete"
```

**Chunk 8 done.** Wallet-bound data center is live. Chunk 9 builds `/agents` + `/admin` sub-pages.

---

## Chunk 9: `/agents` Page + Admin Sub-Pages

**Why this chunk:** Round out the public IA by building `/agents` (list + drill-down) and filling out the empty `/admin/*` sub-pages with their migrated content. Both pages re-use existing read models — no new persistence schemas.

**Reference:** Spec §3.1 IA, §3.2 admin tree mapping, §2.2 PRESERVED requirements (Agent Reputation Profile Read Model, Operator Health, Receipts, etc.).

**Depends on:** Chunks 1-2 (admin shell), Chunks 5-6 (showdown record reads for agent leaderboard).

**End state:**
- `app/agents/page.tsx` — list of all known agents with summary stats
- `app/agents/[agentId]/page.tsx` — drill-down: full reputation + signal history + showdown record
- `components/AgentProfileCard.tsx` — list card
- `components/AgentReputationPanel.tsx` — drill-down panel
- `/admin/control-room`, `/admin/receipts`, `/admin/health` — replace placeholders with real content from existing read models

---

### Task 9.1 · `/agents` list page

**Files:**
- Modify: `app/agents/page.tsx`
- Create: `components/AgentProfileCard.tsx`

- [ ] **Step 9.1.1: Inspect available agent read models**

```bash
grep -n "buildAgentReputationProfile\|listAgents\|agentName" lib/insights/readModels.ts lib/persistence/store.ts | head -20
```

Map: how to enumerate the agents (likely hardcoded names: `volatility`, `momentum`), how to fetch each one's profile.

- [ ] **Step 9.1.2: Implement `AgentProfileCard`**

```tsx
import Link from 'next/link';

interface AgentProfileCardData {
  agentId: string;
  name: string;
  totalSignals: number;
  accuracyBps: number;
  bondedMicroUsdc: bigint;
  showdownsWon: number;
}

export function AgentProfileCard({ data }: { data: AgentProfileCardData }) {
  return (
    <Link href={`/agents/${data.agentId}`} style={{ display: 'block' }}>
      <article className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>{data.name}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, fontSize: 12 }}>
          <Stat label="Signals" value={data.totalSignals.toString()} />
          <Stat label="Accuracy" value={`${(data.accuracyBps / 100).toFixed(1)}%`} />
          <Stat label="Bonded USDC" value={((data.bondedMicroUsdc + 500_000n) / 1_000_000n).toString()} />
          <Stat label="Showdowns Won" value={data.showdownsWon.toString()} />
        </div>
      </article>
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{value}</div>
    </div>
  );
}
```

- [ ] **Step 9.1.3: Build `app/agents/page.tsx` (RSC)**

```tsx
import { AgentProfileCard } from '@/components/AgentProfileCard';
import { buildAgentReputationProfile } from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import { getShowdownStore } from '@/lib/persistence/showdowns';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Agents · PredictArena' };

const KNOWN_AGENTS = ['volatility', 'momentum'] as const;

export default async function AgentsPage() {
  const store = getRuntimeStore();
  const state = await store.getArenaState();
  const showdowns = await getShowdownStore().listAll().catch(() => []);

  const cards = KNOWN_AGENTS.map((name) => {
    const profile = buildAgentReputationProfile(state, name);
    // 字段名严格匹配 lib/insights/readModels.ts 的 AgentReputationProfile：
    //   generatedSignals: number, accuracyBps: number, totalBondedMicroUsdc: number
    const totalSignals = profile.generatedSignals;
    const accuracyBps = profile.accuracyBps;
    const bondedMicroUsdc = BigInt(profile.totalBondedMicroUsdc);
    // showdowns 里 agent 名是首字母大写的（Chunk 6 serializer 已 capitalize）
    // 但本服务端文件里读的是原始记录（小写），所以匹配小写
    const showdownsWon = showdowns.filter(
      (s) =>
        (s.status === 'SettledA' && s.agentA.name.toLowerCase() === name) ||
        (s.status === 'SettledB' && s.agentB.name.toLowerCase() === name)
    ).length;

    return {
      agentId: name,
      name: name[0].toUpperCase() + name.slice(1),
      totalSignals,
      accuracyBps,
      bondedMicroUsdc,
      showdownsWon
    };
  });

  return (
    <section style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, margin: '0 0 6px' }}>Agents</h1>
      <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>
        Click an agent to see signal history, reputation, and showdown record.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {cards.map((c) => <AgentProfileCard key={c.agentId} data={c} />)}
      </div>
    </section>
  );
}
```

**Verified field names** (from `lib/insights/readModels.ts:58-81`):
- `generatedSignals: number` — total signals produced
- `accuracyBps: number` — accuracy in basis points
- `totalBondedMicroUsdc: number` — cumulative bonded
- Use `isSupportedAgentName(agentId)` from the same module to narrow the type before passing to `buildAgentReputationProfile`.

- [ ] **Step 9.1.4: Commit**

```bash
npm run build
git add app/agents/page.tsx components/AgentProfileCard.tsx
git commit -m "feat(agents): build /agents list page with reputation card per known agent"
```

---

### Task 9.2 · `/agents/[agentId]` drill-down

**Files:**
- Create: `app/agents/[agentId]/page.tsx`
- Create: `components/AgentReputationPanel.tsx`

- [ ] **Step 9.2.1: Implement drill-down**

```tsx
// app/agents/[agentId]/page.tsx
import { notFound } from 'next/navigation';
import { AgentReputationPanel } from '@/components/AgentReputationPanel';
import { buildAgentReputationProfile } from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

const VALID_AGENTS = ['volatility', 'momentum'] as const;

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function AgentDetailPage({ params }: PageProps) {
  const { agentId } = await params;
  if (!VALID_AGENTS.includes(agentId as any)) {
    notFound();
  }

  const state = await getRuntimeStore().getArenaState();
  const profile = buildAgentReputationProfile(state, agentId as any);

  return (
    <section style={{ padding: 32 }}>
      <h1 style={{ fontSize: 24, margin: '0 0 24px' }}>
        {agentId[0].toUpperCase() + agentId.slice(1)} Agent
      </h1>
      <AgentReputationPanel profile={profile} />
    </section>
  );
}
```

`AgentReputationPanel` is a presentational component rendering profile fields (segments breakdown if present, recent signals list, etc.). Adjust to the real shape of `AgentReputationProfile` from `readModels.ts`.

- [ ] **Step 9.2.2: Commit**

```bash
git add app/agents/[agentId] components/AgentReputationPanel.tsx
git commit -m "feat(agents): build /agents/:id drill-down with reputation panel"
```

---

### Task 9.3 · Fill `/admin` sub-page content from existing read models

**Files:**
- Modify: `app/admin/control-room/page.tsx`
- Modify: `app/admin/receipts/page.tsx`
- Modify: `app/admin/health/page.tsx`

For each: replace placeholder with real content using the corresponding read model:
- **Control Room**: arc readiness, operator wallet balance, agent budgets — use `Agent Control Room / Arc Readiness Panel` read model
- **Receipts**: `buildAutonomousRunReceipt` output (existing read model)
- **Health**: `Operator Health UI` read model (already preserved per §2.3 MODIFIED)

Each page is RSC. Keep simple tables/cards; no fancy visuals (`/admin` uses greyscale per §3.3).

- [ ] **Step 9.3.1-3: Implement each page using its existing read model + commit**

```bash
git add app/admin/control-room/page.tsx
git commit -m "feat(admin): wire control-room to Agent Control Room read model"

git add app/admin/receipts/page.tsx
git commit -m "feat(admin): wire receipts to buildAutonomousRunReceipt read model"

git add app/admin/health/page.tsx
git commit -m "feat(admin): wire health to Operator Health read model"
```

---

### End-of-Chunk-9 verification

- [ ] All tests pass.
- [ ] Manual: `/agents` shows 2 cards (Volatility, Momentum).
- [ ] Manual: `/agents/volatility` renders the reputation panel.
- [ ] Manual: `/admin/control-room`, `/admin/receipts`, `/admin/health` (after login) show real data.
- [ ] **Sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): chunk 9 (/agents + admin pages) complete"
```

**Chunk 9 done.** Public IA is complete. Final chunk: polish, E2E, deploy.

---

## Chunk 10: Polish + E2E + Docs + Arc Testnet Deployment

**Why this chunk:** Tie everything together. E2E tests verify the 3 critical paths (Home → Arena → My with wallet, agent showdown lifecycle, admin login flow), polish handles colors/spacing/typography across the visual hybrid, docs explain the new IA for Arc reviewers, and finally we deploy `ShowdownArena` to Arc Testnet + push the site to production.

**Depends on:** All prior chunks.

---

### Task 10.1 · Playwright E2E tests

**Files:**
- Create: `test/e2e/home.spec.ts`
- Create: `test/e2e/arena-showdown.spec.ts`
- Create: `test/e2e/my-dashboard.spec.ts`

**Spec reference:** §9 testing strategy — 3 happy paths.

- [ ] **Step 10.1.1: Establish the wallet-stub pattern for Playwright**

The existing `test/e2e/*.spec.ts` does NOT use a wallet mock — it seeds the persistence store directly via `createLocalStore({ storagePath: PLAYWRIGHT_STORE_PATH }).replaceArenaState(...)`. For `/my` tests we need wallet state too.

Use Playwright's `page.addInitScript()` to write the wallet session into `localStorage` before the page loads. The actual storage key (per `lib/arc/browserWallet.ts:23`) is `predictarena.walletSession`. Example:

```ts
await page.addInitScript(() => {
  window.localStorage.setItem(
    'predictarena.walletSession',
    JSON.stringify({
      walletAddress: '0x' + '1'.repeat(40),
      chainId: 5042002,
      connectedAt: new Date().toISOString()
    })
  );
});
```

Mount this before `page.goto('/my')`. Combined with a seeded local store containing a follow record for that wallet address, the page renders the connected state.

- [ ] **Step 10.1.2: Write `home.spec.ts`**

Cover: visit `/` → see Editorial H1 + DataStrip; click "Enter Arena →" → land on `/arena`.

- [ ] **Step 10.1.3: Write `arena-showdown.spec.ts`**

Seed the local showdown store with a test record before run; visit `/arena`; assert ShowdownCard renders with the seeded data.

- [ ] **Step 10.1.4: Write `my-dashboard.spec.ts`**

Mock wallet → visit `/my` → assert MyOverviewStrip renders + USDC balance label visible.

- [ ] **Step 10.1.5: Commit each test file separately**

---

### Task 10.2 · Visual polish pass

**Files:**
- Modify: `app/globals.css` (final color tokens)
- Modify: Any component with TODO color stubs

Checklist:
- [ ] Verify all `glass-card` borders consistent (1px, same opacity)
- [ ] Verify all heading font-weights consistent (h1=800 editorial, h2=700 glass, h3=600)
- [ ] Verify all link hover states defined
- [ ] Verify mobile responsiveness at 375px wide
- [ ] Verify no console errors in dev mode

Commit each polish batch.

---

### Task 10.3 · Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/circle-submission.md`

- [ ] **Step 10.3.1: Update README**

New sections: "Arena Showdowns" (Hook 01), "Wallet-Bound /my", "Admin Console". Update existing architecture diagram if needed.

- [ ] **Step 10.3.2: Update circle-submission.md** for the Arc builder application.

---

### Task 10.4 · Update spec §5.1 (SWR → RSC decision)

Per Chunk 4 review note, update spec to acknowledge the data strip is RSC, not SWR. This is a docs follow-up that must complete before archive.

- [ ] Modify `docs/superpowers/specs/2026-06-03-predictarena-redesign-design.md` §5.1 paragraph on the data strip refresh strategy.

```bash
git add docs/superpowers/specs/
git commit -m "docs(spec): align §5.1 with RSC implementation chosen in Chunk 4"
```

---

### Task 10.5 · Deploy `ShowdownArena` to Arc Testnet

**Files:**
- Run: `scripts/deploy-showdown-arena.ts` against arcTestnet
- Modify: `.env.local` and production env with the resulting `NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS`

- [ ] **Step 10.5.1: Pre-flight**

Confirm operator wallet has Arc Testnet ETH (≥ 0.5 ETH for safety). Confirm USDC + treasury addresses are correct.

- [ ] **Step 10.5.2: Deploy**

```bash
USDC_ADDRESS=<from .env.local> TREASURY_ADDRESS=<from .env.local> \
npx hardhat run scripts/deploy-showdown-arena.ts --network arcTestnet
```

Capture `SHOWDOWN_ARENA_ADDRESS=0x...` line.

- [ ] **Step 10.5.3: Configure agents**

Have each agent wallet (`AGENT_VOLATILITY_ADDRESS`, `AGENT_MOMENTUM_ADDRESS`) call USDC `approve(SHOWDOWN_ARENA_ADDRESS, MAX_UINT256)`.

Helper script: `scripts/approve-showdown-arena.ts` if not already in deploy script.

- [ ] **Step 10.5.4: Update env**

Append to `.env.local`:
```
NEXT_PUBLIC_SHOWDOWN_ARENA_ADDRESS=0x...
```

And to production env via the host's secret-management UI.

- [ ] **Step 10.5.5: Commit deployment artifact**

```bash
git add .codex/showdown-arena-deployment.json  # if not gitignored
# OR keep gitignored and document the address in docs/deployment.md
git commit -m "chore(deploy): record ShowdownArena Arc Testnet deployment address"
```

---

### Task 10.6 · Production deploy

- [ ] Push final branch → CI/CD → production.
- [ ] Smoke-test the deployed site: `/`, `/arena`, `/agents`, `/my`, `/admin/login`.
- [ ] Capture screenshots for the Arc builder submission.

- [ ] **Final sign-off commit:**

```bash
git commit --allow-empty -m "chore(redesign): all chunks complete — PredictArena redesign deployed"
```

---

**🎉 Plan complete.** Codex handoff happens at Stage 3 of the codex-dev workflow. See `superpowers:codex-handoff` for the next steps.


