# Design: Run receipts, reputation profiles, and demo script

## Product Shape

The change adds three linked surfaces:

1. `Autonomous Run Receipt`: an audit-first page for a single autonomous run, reachable from the Arena Autonomy Panel. It shows source, market count, generated signals, mode by agent, queue outcomes, budget snapshots, deterministic model/data hashes, signal links, and tx hashes where present.
2. `Agent Reputation Profile`: a profile page for each agent, reachable from the leaderboard. It expands aggregate reputation into open/resolved exposure, bonded/refunded/slashed USDC, Brier score, confidence mix, recent signal trail, and best/worst resolved outcomes.
3. `Resolution Demo Script`: a guided operator page for demos. It does not bypass server authorization; it provides a token input, eligible unresolved signal selection, correct/incorrect controls, submit state, and post-resolution leaderboard/sync prompts.

## Data and API

Prefer derived read models over duplicating state. The local and Supabase stores already persist `signals`, `autonomyRuns`, commit data, and demo resolution data. New service helpers should compute:

- `AutonomousRunReceiptView` from `ArenaState.autonomyRuns`, queue entries, matching signals, markets, and metrics.
- `AgentReputationProfile` from stored signals and leaderboard scoring helpers.
- `ResolutionDemoScriptView` from committed unresolved signals, recent resolved signals, leaderboard entries, and Arc readiness/sync state where available.

APIs should remain public-read unless they perform mutation. Mutations continue through existing admin-token-protected resolve routes. New public APIs must not return secrets.

## UI Design Decisions

- Color palette: reuse existing PredictArena tokens (`--arc-blue`, `--signal-mint`, `--risk`, `--caution`, neutral surfaces) with no new dominant hue family.
- Typography: retain current Space Grotesk / IBM Plex Mono stack and compact dashboard hierarchy.
- Spacing: use existing 8/10/12/16px operational rhythm and dense panels.
- Border radius: keep cards/panels at 8px or less; status chips may remain pill-shaped.
- Motion: use existing short hover/focus transitions only; no ornamental animation.
- Layout: full-width operational sections, compact tables/timelines, no nested cards inside cards.

## Safety

The demo script must clearly label settlement as `Demo/Admin Only` and `not an oracle`. It may accept an admin token from the operator but must never render configured secrets. Reputation and receipt APIs must sanitize responses and should only expose public hashes, ids, statuses, addresses, and transaction hashes.

## Testing

Add unit/API tests for receipt and reputation builders, secret non-exposure, admin demo read model, and demo resolution flow compatibility. Update E2E to assert the receipt link/page, agent profile page, and demo script page load at desktop/mobile sizes without manual market input.
