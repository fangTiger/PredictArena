# Change: Redesign PredictArena War Room

## Why

The current PredictArena MVP proves the autonomous scan -> agents -> Arc signal-bond flow, but the UI still reads as a basic operational dashboard. For the hackathon demo it needs stronger prediction-market atmosphere and a more memorable first screen while preserving the non-negotiable product boundaries.

## What Changes

- Redesign the first screen into an "Arc Trading War Room" dashboard with a dark market-terminal mood, arena-style signal board, and visible USDC/Arc commitment lane.
- Add a generated bitmap hero asset that reinforces autonomous agents, BTC/ETH/SOL market signals, and Arc USDC signal bonds.
- Reorganize existing dashboard data into a denser three-zone layout: market scan/control rail, central signal board, and leaderboard/Arc commit rail.
- Improve responsive behavior so the same autonomous flow remains clear on desktop and mobile.
- Keep the user-facing flow free of manual market creation, manual prediction-question entry, and manual evidence input.

## Non-Goals

- No backend prediction logic changes.
- No Polymarket order execution, AMM, order book, or trading clone UI.
- No manual evidence textarea or pasted-news workflow.
- No new external frontend dependencies.
- No contract, Prisma schema, or Arc commit service changes.

## Impact

- Affected specs: `predictarena-ui`
- Affected code: `components/arena-dashboard.tsx`, `app/globals.css`, optional E2E locator adjustments, and a generated bitmap asset under `public/`.
- External integrations: none. The generated visual asset uses the local GPT Image 2 skill workflow, but runtime app behavior remains local/static for that asset.

## OpenSpec Notes

Graphify: unavailable. The repository has no `graphify-out/` directory, so impact analysis uses existing source, tests, and file-level review instead.
