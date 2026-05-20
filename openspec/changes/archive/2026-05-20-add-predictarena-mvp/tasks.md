## 1. Proposal and Project Foundation

- [x] 1.1 Create OpenSpec proposal, design, tasks, and predictarena spec delta.
- [x] 1.2 Scaffold Next.js/TypeScript/Prisma/Hardhat project files and remove the placeholder `main.py`.
- [x] 1.3 Add environment template and constants for Polymarket, Arc Testnet, and Arc USDC ERC-20.

## 2. Data Model and Market Discovery

- [x] 2.1 Add Prisma schema for scans, markets, forecasts, signals, commitments, and agent scores.
- [x] 2.2 Add demo snapshot dataset clearly labeled as snapshot data.
- [x] 2.3 Implement Polymarket Gamma fetch adapter with pagination and timeout/error handling.
- [x] 2.4 Implement conservative BTC/ETH/SOL market parser with skip reasons.
- [x] 2.5 Implement `GET /api/markets/scan` with live fetch and snapshot fallback.

## 3. Agent Arena

- [x] 3.1 Implement crypto price feature adapter with deterministic fallback fixtures for tests.
- [x] 3.2 Implement Volatility Agent probability calculation.
- [x] 3.3 Implement Momentum Agent probability calculation.
- [x] 3.4 Implement Risk Agent gating and BUY_YES/BUY_NO/AVOID decisioning.
- [x] 3.5 Implement `POST /api/agents/run`, signal persistence, stats, and leaderboard updates.

## 4. Arc Signal Bonds

- [x] 4.1 Implement `SignalBondVault.sol` with USDC `transferFrom` signal bonds and events.
- [x] 4.2 Add Hardhat tests for successful commit, invalid inputs, and refund behavior.
- [x] 4.3 Add Arc Testnet deploy script and contract address configuration.
- [x] 4.4 Implement server-side Arc commit service with allowance/approve/commit flow.
- [x] 4.5 Implement `POST /api/signals/[id]/commit`.

## 5. Frontend MVP

- [x] 5.1 Build first-screen arena dashboard with scan metrics, source labeling, and Run Agents flow.
- [x] 5.2 Build signal table with BUY_YES, BUY_NO, and AVOID states and agent reasons.
- [x] 5.3 Build commit UI showing eligibility, Arc transaction hash, and disabled reasons.
- [x] 5.4 Build leaderboard and aggregate metrics for scanned markets, generated signals, committed signals, USDC bonded, and agent scores.
- [x] 5.5 Verify UI has no manual evidence textarea, no manual question input, and no market creation flow.

## 6. Verification and Handoff

- [x] 6.1 Add Vitest unit tests for parser, agent calculations, risk gating, and API fallback behavior.
- [x] 6.2 Add Playwright smoke test for open app -> scan -> Run Agents -> view signals.
- [x] 6.3 Run formatting, lint, unit, contract, and E2E verification as available.
- [x] 6.4 Update OpenSpec tasks and provide Implementation Evidence for Review Codex.

Verification note:
- Fresh in MVP-POLISH-AND-TASK-SYNC: `npm run build` passed.
- Fresh in MVP-POLISH-AND-TASK-SYNC: `POSTHOG_DISABLED=1 openspec validate add-predictarena-mvp --strict --no-interactive` passed, with telemetry-only PostHog flush errors after validation.
- Previously verified by Architecture Codex: `npm test` passed.
- Previously verified by Architecture Codex: `npm run test:contracts` passed, with Hardhat Node 25 unsupported warning.
- Previously verified by Architecture Codex: `npm run lint` passed, with ESLintRC deprecation warning.
- Fresh in Architecture Codex final check: `npm run test:e2e` passed outside sandbox after confirming sandbox webServer bind fails with `listen EPERM 127.0.0.1:3000`.
