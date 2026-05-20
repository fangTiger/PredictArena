# PredictArena War Room Redesign

## Design Direction

Use the confirmed "Arc Trading War Room" direction:

- Dark financial terminal with arena lighting and chain-settlement atmosphere.
- First viewport is the product dashboard, not a landing page.
- Brand/product name remains immediately visible.
- Hero visual shows a prediction-market arena with BTC/ETH/SOL market tiles, probability trails, autonomous agent silhouettes, and an Arc/USDC bond vault energy column.
- Palette: near-black, graphite, market green, risk red, USDC blue, warm amber, restrained off-white text.
- Radius: panels 8px or less where practical; cards remain compact and operational rather than plush.
- Motion: subtle scan/pulse feedback only, respecting reduced-motion preferences.

## UI Architecture

The existing `ArenaDashboard` remains the client component and keeps all current API calls:

1. Initial server state still comes from `app/page.tsx`.
2. `GET /api/markets/scan` remains the scan action.
3. `POST /api/agents/run` remains the forecasting action.
4. `POST /api/signals/[id]/commit` remains the Arc commit action.

The component should reorganize existing dashboard fields into:

- Header / command deck: brand, scan source, Arc status, fallback notice, and top-line metrics.
- Market scan rail: controls, parsed market cards, and skip diagnostics.
- Signal arena: prominent BUY_YES / BUY_NO / AVOID board with confidence, edge, reasons, and commitment action.
- Arc / leaderboard rail: latest transaction state, USDC bonded, committed count, and agent leaderboard.

## Asset Plan

Generate one static bitmap asset with the GPT Image 2 workflow and store it under `public/`. The app references the asset with a local path and must still render if the asset cannot load by using CSS backgrounds and structured UI content.

Target asset:

- Path: `public/predictarena-war-room.png`
- Aspect: wide hero image, suitable for a desktop first viewport and cropped background use.
- No logos that imply official endorsement; use abstract "Arc" and "USDC" text only if legible.

## Accessibility and Responsiveness

- Preserve semantic buttons for `Re-Scan Markets`, `Run Agents`, and `Commit to Arc`.
- Keep headings visible for E2E and screen-reader navigation: `PredictArena`, `Signal Board`.
- Avoid text overlap at desktop and mobile widths.
- Ensure mobile stacks into a single-column operations view with controls before tables.

## Test Strategy

Keep existing E2E intent:

- Opening the app shows PredictArena branding.
- No question input, textarea, or Create Market control exists.
- Source is labeled `demo snapshot` or `live`.
- Clicking `Run Agents` produces visible BUY_YES / BUY_NO / AVOID decisions.

Visual verification should include a browser smoke check after implementation to catch blank assets, text overlap, and broken controls.
