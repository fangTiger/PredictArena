## 1. Specification and Boundaries

- [x] 1.1 Create OpenSpec proposal, design, task list, and spec delta.
- [x] 1.2 Validate `add-resolution-engine` with strict OpenSpec validation.
- [x] 1.3 Record dirty baseline and Graphify degradation.

## 2. Core Resolution and Scoring

- [x] 2.1 Add `lib/resolution/resolveCryptoMarket.ts` for expiry/touch settlement from candles.
- [x] 2.2 Add `lib/resolution/scoring.ts` for correctness, Brier, accuracy, paper ROI, and bond accounting helpers.
- [x] 2.3 Add unit tests for all four condition types and scoring outcomes.

## 3. Persistence and API

- [x] 3.1 Extend signal resolution state with YES outcome and optional onchain resolution hash.
- [x] 3.2 Add store methods for listing resolvable signals and marking resolution results.
- [x] 3.3 Add `POST /api/resolve-signals` for automatic committed-signal resolution.
- [x] 3.4 Add `POST /api/admin/resolve-demo` for token-protected demo forced resolution.

## 4. Arc Contract and Client

- [x] 4.1 Add `resolveSignalsBulk(uint256[] signalIds, bool[] correct)` to `SignalBondArena.sol`.
- [x] 4.2 Add Hardhat tests for bulk resolve, correct refund, incorrect slash, and only-owner gating.
- [x] 4.3 Extend Arc ABI/client service for owner-signed bulk resolution when configured.

## 5. Leaderboard and UI

- [x] 5.1 Update leaderboard data model and table columns for resolved count, accuracy, Brier, refunded, slashed, and paper ROI.
- [x] 5.2 Surface resolution status in signal detail without manual evidence inputs.
- [x] 5.3 Keep UI aligned with existing light-first PredictArena visual system.

## 6. Verification

- [x] 6.1 Run targeted RED/GREEN tests during implementation.
- [x] 6.2 Run `npm test`, contract tests, lint, build, and e2e as applicable.
- [x] 6.3 Request Review Codex gate before final verify.
