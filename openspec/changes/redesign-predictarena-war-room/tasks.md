## 1. Spec and Asset Preparation

- [x] 1.1 Create OpenSpec proposal, design, tasks, and `predictarena-ui` spec delta.
- [x] 1.2 Create and save a GPT Image 2 prompt for the PredictArena war-room hero.
- [x] 1.3 Generate or otherwise provide `public/predictarena-war-room.png`; if generation is blocked, keep a documented fallback path and implement the UI so it still demos.
- Note: GPT Image 2 Garden generation was attempted but blocked by billing hard limit; local fallback bitmap was generated.

## 2. Frontend Redesign

- [x] 2.1 Rework `components/arena-dashboard.tsx` into the Arc Trading War Room layout while preserving existing API behavior.
- [x] 2.2 Rebuild `app/globals.css` with the confirmed palette, dense dashboard layout, responsive rules, and subtle motion.
- [x] 2.3 Keep user-facing flow free of manual market/question/evidence inputs and any Polymarket-clone trading controls.
- [x] 2.4 Adjust Playwright locators only if markup changes require it; keep the same behavioral assertions.

## 3. Review and Verification

- [x] 3.1 Run relevant unit, lint, build, OpenSpec, and E2E checks.
- [x] 3.2 Perform browser smoke verification for desktop and mobile layout.
- [x] 3.3 Submit implementation evidence to Review Codex and address any `FIX_REQUIRED` findings.
