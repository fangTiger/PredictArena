## 1. Specification and Governance

- [x] 1.1 Create OpenSpec proposal, design, task list, and spec deltas.
- [x] 1.2 Validate `add-run-receipts-reputation-demo-script` with strict OpenSpec validation.
- [x] 1.3 Record dirty baseline, Graphify degradation, executor split, validation plan, and explicit cron-lock exclusion.

## 2. Receipt and Reputation Read Models

- [x] 2.1 Add receipt/reputation/demo read-model types and service helpers derived from persisted state.
- [x] 2.2 Add public receipt API for a single autonomous run without exposing secrets.
- [x] 2.3 Add public agent reputation API for volatility/momentum profiles without exposing secrets.
- [x] 2.4 Add public demo script read API for unresolved/resolved demo candidates and sync hints.
- [x] 2.5 Add unit/API tests for missing data, resolved scoring, tx/hash display fields, and secret non-exposure.

## 3. UI Surfaces

- [x] 3.1 Link recent autonomous runs in the Arena Autonomy Panel to receipt pages.
- [x] 3.2 Add autonomous run receipt page with input summary, signal outcomes, policy decisions, budget snapshots, hashes, and tx references.
- [x] 3.3 Link leaderboard agent rows to agent reputation pages.
- [x] 3.4 Add agent reputation profile pages with exposure, score trend, confidence buckets, best/worst resolved signals, and recent trail.
- [x] 3.5 Add resolution demo script page with guided steps, admin-token input, correct/incorrect settlement, and leaderboard/sync follow-up states.

## 4. Documentation and Verification

- [x] 4.1 Update README with receipt, reputation, and demo script usage.
- [x] 4.2 Run targeted RED/GREEN tests during implementation.
- [x] 4.3 Run `npm test`, `npm run lint`, `npm run build`, E2E/browser checks, and OpenSpec validation as feasible.
- [x] 4.4 Request independent Review Codex gate before final VERIFY.
