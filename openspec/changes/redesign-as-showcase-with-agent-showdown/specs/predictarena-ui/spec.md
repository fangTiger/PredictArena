# predictarena-ui · Spec Delta

## ADDED Requirements

### Requirement: Arena Signal Glass Home Landing UI

The `/` route SHALL render an Arena Signal Glass landing page composed of `TopNav` (Glass variant), `HomeHero`, `HomeDataStrip`, `HomeNarrative`, and `HomeTransitionFooter`. The page SHALL be a React Server Component (`force-dynamic`) that fetches KPI data once per request via `getHomeStripData()`.

#### Scenario: Hero displays locked statement

- **WHEN** the home page renders
- **THEN** the H1 element SHALL contain the lead text "AI agents," and an `<em>` element containing "betting with proof." styled in the Arena Signal Glass cyan/coral accent system
- **AND** the tagline "LIVE ON ARC TESTNET" SHALL appear above the H1
- **AND** if the latest Arc block number is available, it SHALL be appended as "· BLOCK X" with thousands separators
- **AND** the first viewport SHALL avoid an enclosed black editorial frame or centered visual box; the hero SHALL render as a full-bleed scene spanning the viewport width on the same dark glass-neon background system used by `/arena`
- **AND** the page SHALL reuse the shared Glass `TopNav` treatment used by `/arena`, `/agents`, and `/my`, without homepage-specific navigation geometry, colors, or active-state overrides
- **AND** the first viewport SHALL NOT visually mimic a single external reference site; specifically it SHALL NOT use a white pill navigation bar or a green-dominant fluid background as the primary identity
- **AND** the first viewport SHALL include a perceptible CSS-driven signal/market motion layer, including a visible scanline or pulsing signal nodes, that reinforces agent activity without blocking content or requiring JavaScript
- **AND** the hero SHALL expose clear `Enter Arena` and `View Agents` calls to action without requiring wallet connection

#### Scenario: Data strip 4 columns

- **WHEN** the home page renders
- **THEN** the page SHALL display 4 cells labeled "ACTIVE SIGNALS", "USDC BONDED", "AGENT ACCURACY", "SHOWDOWNS WON" with numeric values and trend text
- **AND** the showdowns cell SHALL be marked `data-source="placeholder"` only when the showdown service has not yet been wired (Chunk 5 dependency); once Chunk 6 lands the marker SHALL be removed
- **AND** the strip SHALL read as a lightweight live tape or protocol metric row using the same dark glass card treatment as Arena surfaces instead of a heavy grid locked inside a black box

#### Scenario: Narrative two-column layout

- **WHEN** the home page renders
- **THEN** below the data strip the page SHALL display a two-column section with "The Premise" (left) and "How to Watch" (right), with copy strings sourced from `lib/config/homeCopy.ts`
- **AND** the "How to Watch" column SHALL render exactly 3 `<p data-watch-item>` items

#### Scenario: Protocol transition footer

- **WHEN** the home page renders
- **THEN** the page SHALL end with a `HomeTransitionFooter` containing a link to `/arena` labeled "Enter Arena →" styled as an Arena-aligned glass pill on the same page background system

### Requirement: Glass Neon Arena UI

The `/arena` route SHALL render a Glass Neon themed layout consisting of `TopNav` (Glass variant), an optional `PendingFollowsRow`, and `ShowdownGrid`. The dashboard SHALL fetch showdowns client-side via SWR (`/api/showdowns?status=all&limit=50`, 30-second refresh interval).

#### Scenario: Empty showdown grid explains automatic discovery

- **WHEN** `/api/showdowns?status=all&limit=50` returns an empty list
- **THEN** the `ShowdownGrid` SHALL explain that `Run Agents` generates signals and automatically attempts to open eligible on-chain matches
- **AND** it SHALL explain that an empty result can mean the agents agreed, budget/gas safeguards blocked opening, or an open match already exists

#### Scenario: Empty showdown grid can show preview candidates

- **WHEN** `/api/showdowns?status=all&limit=50` returns an empty list AND the latest in-memory agent run contains opposing signals on the same market
- **THEN** the Arena SHALL render preview Showdown candidates in the Showdown area
- **AND** each preview candidate SHALL show the market, both agents, side, probability, spread, and source
- **AND** the preview area SHALL clearly label itself as not on-chain and separate from active/settled Showdowns
- **AND** the preview area SHALL explain that live-only discovery will open a real chain match only when live market data, budget, gas, and idempotency checks pass
- **AND** if the latest in-memory run has same-market agent signals but no opposing YES/NO pair, the Arena MAY render a near-miss preview labeled as not eligible for an on-chain Showdown yet
- **AND** if automatic discovery reports that it opened a real Showdown or found an existing open Showdown, the Arena SHALL NOT show those latest signals as preview candidates while the real Showdown list is refreshing

#### Scenario: Run Agents reports automatic discovery outcome

- **WHEN** a visitor clicks `Run Agents`
- **THEN** the Arena dashboard SHALL save the generated signals in memory
- **AND** revalidate `/api/showdowns?status=all&limit=50`
- **AND** display whether automatic Showdown discovery opened matches, skipped all candidates, or is waiting on safe configuration/budget/gas prerequisites

#### Scenario: Run Agents requires wallet identity before execution

- **WHEN** a visitor clicks `Run Agents` without a connected wallet
- **THEN** the Arena SHALL request wallet connection before calling `POST /api/run-agents`
- **AND** it SHALL NOT call `POST /api/run-agents` until a wallet address is available
- **AND** read-only Arena surfaces, Showdown inspection, and `/agents` browsing SHALL remain visible without wallet connection

#### Scenario: Run output is inspectable

- **WHEN** a visitor clicks `Run Agents` and signals are generated
- **THEN** the Arena SHALL render a prominent Run Output signal browser
- **AND** the browser SHALL paginate generated signals instead of truncating them silently
- **AND** each visible signal row SHALL be clickable and SHALL reveal a detail view containing the market question, agent, side, probability, market price, edge, confidence, source, model/data hash, risk flags, and timestamp
- **AND** the detail view SHALL remain read-only and SHALL NOT trigger wallet approval, wallet follow, or admin actions

#### Scenario: Wallet follow success gives next-step guidance

- **WHEN** a visitor clicks `Run Agents + Follow` and the wallet follow receipt is confirmed
- **THEN** the Arena dashboard SHALL tell the visitor to check `/my` for the saved receipt
- **AND** it SHALL explain that automatic discovery runs after each agent run and the Arena refreshes when a match opens

#### Scenario: Wallet readiness opens from the wallet entry

- **WHEN** a visitor opens `/arena`
- **THEN** the Arena SHALL NOT render a persistent full Wallet Readiness panel in the page sidebar
- **AND** when a connected visitor activates the top-right wallet/address control, the UI SHALL show wallet readiness details including connected address, Arc chain, USDC balance, allowance, contract readiness, and latest tx
- **AND** dismissing the readiness details SHALL return space to the core Showdown and Run Output surfaces

#### Scenario: Showdown card visual states

- **WHEN** a `ShowdownCard` renders for an `Open` Showdown
- **THEN** it SHALL display a `⚔ SHOWDOWN` orange tag and the deadline string in UTC
- **AND** the YES side SHALL use `var(--color-yes)` for the probability number
- **AND** the NO side SHALL use `var(--color-no)`
- **AND** the open tx hash SHALL be rendered as `<code>` shortened to 8 chars + ... + 4 chars

- **WHEN** a `ShowdownCard` renders for a `SettledA` or `SettledB` Showdown
- **THEN** it SHALL display a green `✓ RESOLVED` tag
- **AND** the winner's side SHALL show a `+ X USDC` payout label
- **AND** the loser's side SHALL show a `- X USDC` forfeit label
- **AND** the resolution price label (e.g., "ETH closed at $5,032") SHALL appear in the footer

#### Scenario: Show more for settled list

- **WHEN** more than 5 settled Showdowns are loaded
- **THEN** the grid SHALL initially render only the 5 most recent settled cards
- **AND** display a "Show more (N)" button that, when clicked, expands the list to show all loaded settled cards

### Requirement: Wallet-Bound /my Dashboard UI

The `/my` route SHALL render either a Connect Wallet CTA (when `predictarena.walletSession` is absent) or a personal dashboard for the connected address. The dashboard SHALL show overview KPIs, follow history, and tx history sourced from `GET /api/wallet/[address]/summary`.

#### Scenario: Unconnected wallet shows CTA

- **WHEN** `/my` is opened without a wallet session
- **THEN** the page SHALL render a single centered Connect CTA with no empty-state placeholders for the data sections
- **AND** the page SHALL NOT issue any wallet-summary fetch

#### Scenario: Connected wallet renders 3 sections

- **WHEN** `/my` is opened with an active wallet session
- **THEN** the page SHALL render `MyOverviewStrip` (USDC balance, cumulative bonded, cumulative payout, net PnL), `MyFollowsTable` (up to 50 rows), and `MyTxHistoryTable` (up to 50 rows)

#### Scenario: Wallet account switch

- **WHEN** the user switches the active account in their wallet (firing EIP-1193 `accountsChanged`)
- **THEN** the dashboard SHALL invalidate all SWR caches under `/api/wallet/`
- **AND** update its displayed address to the new one
- **AND** re-fetch the new address's summary

### Requirement: Admin-Only Operator Surface UI

The `/admin/*` subtree SHALL be gated by a server-side cookie check against `ADMIN_ACCESS_TOKEN`. Unauthenticated requests to any `/admin/*` route SHALL redirect to `/admin/login`. The login page SHALL be served at the URL `/admin/login` via a Next.js rewrite to a separate folder outside the gated layout, so the gate does not redirect-loop on the login page itself.

#### Scenario: Unauthenticated access redirects to login

- **WHEN** a request hits any `/admin/*` route without a valid `pa_admin` cookie
- **THEN** the layout SHALL redirect to `/admin/login`

#### Scenario: Successful login sets cookie and redirects

- **WHEN** the user submits the login form with a token matching `ADMIN_ACCESS_TOKEN`
- **THEN** the server action SHALL set the `pa_admin` cookie (httpOnly, sameSite=lax, 12h)
- **AND** redirect to `/admin`

#### Scenario: Failed login shows error inline

- **WHEN** the user submits an incorrect token
- **THEN** the server action SHALL redirect to `/admin/login?error=1`
- **AND** the form SHALL display an "Invalid token" error message

## MODIFIED Requirements

### Requirement: War Room Prediction-Market Atmosphere

The site's visual identity SHALL adopt a deliberate hybrid: **Arena Signal Glass** on the `/` landing page (PredictArena-owned dark glass-neon palette, compact dark translucent navigation, centered proof narrative, lightweight live metrics, full-bleed hero scene, and perceptible signal motion) and **Glass Neon** on `/arena`, `/agents`, `/my` (glass-card surfaces with purple+cyan radial glows). The `/admin/*` subtree SHALL use a minimal greyscale theme distinct from public surfaces. Shared design tokens SHALL be defined as CSS custom properties in `app/globals.css`.

#### Scenario: Token availability

- **WHEN** any redesigned page renders
- **THEN** the CSS variables `--editorial-bg`, `--editorial-fg`, `--editorial-accent`, `--glass-bg`, `--glass-card-bg`, `--glass-card-border`, `--color-yes`, `--color-no`, `--color-success`, `--color-error`, and the utility classes `.editorial-page`, `.glass-page`, `.glass-card`, `.admin-page` SHALL be available
- **AND** the homepage SHALL be allowed to reuse the glass page utilities while keeping the existing editorial variables for compatibility and admin/spec history

### Requirement: Responsive Operational Layout

Each redesigned route SHALL remain legible at viewport widths down to 375px (mobile portrait) without horizontal scroll, but does not require a custom mobile UX. Glass cards may stack vertically; tables may collapse to card lists; the home hero font-size may scale.

#### Scenario: Mobile viewport

- **WHEN** any redesigned page is rendered at 375×667 viewport
- **THEN** the layout SHALL avoid horizontal scroll
- **AND** primary CTAs SHALL remain reachable above the fold

### Requirement: Autonomy Panel UI

The Autonomy Panel SHALL be moved out of the top public navigation and into `/agents` (as a sub-section of the agent drill-down) or `/admin/control-room` (for operator views). The panel SHALL NOT appear at any public top-level route.

#### Scenario: Autonomy panel access

- **WHEN** a public visitor opens `/`, `/arena`, `/agents` list, or `/my`
- **THEN** no Autonomy Panel UI SHALL be visible
- **WHEN** an authenticated admin opens `/admin/control-room`
- **THEN** the Autonomy Panel UI MAY appear as part of the operator readiness view

#### Scenario: Admin operator triggers showdown discovery

- **WHEN** an authenticated admin opens `/admin/control-room`
- **THEN** the page SHALL expose a `Discover Showdowns` operator action
- **AND** when the action succeeds, it SHALL display discovered/opened/skipped counts, skip reason summaries, and a link back to `/arena`
- **AND** when the action fails, it SHALL display the protected endpoint's safe reason code
- **AND** the copy SHALL describe the action as a manual diagnostic/override, not a requirement for visitors to see Showdowns

### Requirement: Agent Control Room / Arc Readiness Panel

The Agent Control Room and Arc Readiness Panel SHALL be relocated to `/admin/control-room` and SHALL not be exposed via any public-facing nav.

#### Scenario: Public visitor cannot reach control room

- **WHEN** a public visitor navigates the new IA (Home, Arena, Agents, My)
- **THEN** no link to the control room SHALL be present
- **AND** typing `/admin/control-room` directly SHALL redirect to `/admin/login`

### Requirement: Commit Queue UI

The legacy Commit Queue UI SHALL be re-integrated into the new Arena page as either pending-Showdown indicators or as a small section inside the rewritten dashboard. It SHALL NOT appear as a standalone top-level segment.

#### Scenario: Commit queue integrated

- **WHEN** new signal commits are pending
- **THEN** the dashboard SHALL surface them either through `ShowdownCard` pending states OR a compact pending-commits row, at the implementer's discretion

### Requirement: Hidden Admin Demo Resolution UI

The `Hidden Admin Demo Resolution UI` SHALL be moved from `/demo-resolution` to `/admin/resolution`. Access SHALL be governed by the same admin auth pattern as the rest of `/admin/*`.

#### Scenario: Demo resolution access path

- **WHEN** an unauthenticated request hits `/demo-resolution`
- **THEN** the route SHALL return 404
- **WHEN** an authenticated admin opens `/admin/resolution`
- **THEN** the ported Demo Resolution Console SHALL render inside the AdminShell sidebar

### Requirement: Autonomous Run Receipt UI

Autonomous Run Receipt UI SHALL be relocated to `/admin/receipts` and SHALL render the existing `buildAutonomousRunReceipt` read model.

#### Scenario: Authenticated admin opens receipts

- **WHEN** an authenticated admin opens `/admin/receipts`
- **THEN** the page SHALL render a list of recent autonomous run receipts produced by `buildAutonomousRunReceipt`
- **AND** no public surface SHALL link to `/admin/receipts`

### Requirement: Agent Reputation Profile UI

Agent Reputation Profile UI SHALL be relocated under `/agents/[agentId]` as a sub-route of the agent drill-down. The list at `/agents` SHALL show a summary card per known agent (Volatility, Momentum).

#### Scenario: Agents list and drill-down

- **WHEN** a visitor opens `/agents`
- **THEN** the page SHALL render one `AgentProfileCard` per known agent name with `generatedSignals`, `accuracyBps`, `totalBondedMicroUsdc`, and showdowns-won count
- **WHEN** the visitor clicks a card
- **THEN** the page SHALL navigate to `/agents/[agentId]` rendering the full reputation panel

### Requirement: Resolution Demo Script UI

Resolution Demo Script UI SHALL be relocated to `/admin/resolution` (as a sub-section or sibling of the Demo Resolution Console).

#### Scenario: Resolution demo script under admin

- **WHEN** an authenticated admin opens `/admin/resolution`
- **THEN** the existing Resolution Demo Script controls SHALL render alongside the Demo Resolution Console
- **AND** the legacy `/demo-resolution` route SHALL return 404

### Requirement: Judge Proof Pack UI

Judge Proof Pack UI SHALL be relocated to `/admin/proof`.

#### Scenario: Judge proof pack access

- **WHEN** an authenticated admin opens `/admin/proof`
- **THEN** the Judge Proof Pack UI SHALL render inside the AdminShell sidebar
- **AND** the legacy `/proof` route SHALL return 404

### Requirement: Operator Health UI

Operator Health UI SHALL be relocated to `/admin/health`.

#### Scenario: Operator health dashboard

- **WHEN** an authenticated admin opens `/admin/health`
- **THEN** the existing Operator Health read model SHALL render as a status grid

### Requirement: Proof Smoke Controls UI

Proof Smoke Controls UI SHALL be co-located with Judge Proof Pack at `/admin/proof`.

#### Scenario: Smoke controls reachable from proof page

- **WHEN** an authenticated admin opens `/admin/proof`
- **THEN** the Proof Smoke Controls SHALL appear within the same page as Judge Proof Pack
- **AND** no smoke-control buttons SHALL be visible on public routes

## REMOVED Requirements

### Requirement: Market Intelligence Workspace UI

**Reason**: Workspace UI removed from public navigation as part of IA collapse to 4 public segments. Backend `Market Intelligence Read Models` are preserved in the `predictarena` spec.
**Migration**: Operators may build a `/admin/intelligence` page in a future change if needed.

### Requirement: Signal Research UI

**Reason**: `/intelligence` route removed; no Signal Research workspace.
**Migration**: Signal Research Read Model in `predictarena` spec is preserved for future use.

### Requirement: Segmented Agent Comparison UI

**Reason**: Comparison UI absorbed (in simplified form) into `/agents`; the dedicated comparison surface is removed.
**Migration**: Segmented Agent Reputation read model is preserved.

### Requirement: Paper Follow UI

**Reason**: Paper-follow UI removed from public surfaces. Backend read models preserved.
**Migration**: Future admin work may surface these read models under `/admin`.

### Requirement: Saved Intelligence Controls UI

**Reason**: `/intelligence` removed; no surface to save controls from.
**Migration**: None required (backend dead code).

### Requirement: Watchlist UI

**Reason**: `/intelligence` removed.
**Migration**: None.

### Requirement: Intelligence Alert Center UI

**Reason**: `/intelligence` removed.
**Migration**: None.

### Requirement: Daily Research Queue UI

**Reason**: `/intelligence` removed.
**Migration**: None.
