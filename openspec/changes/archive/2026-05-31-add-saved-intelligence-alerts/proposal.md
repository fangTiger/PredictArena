# Change: Add Saved Intelligence Alerts

## Why

PredictArena now has a useful market intelligence workspace, but a daily-use product needs memory. Users should not rebuild the same BTC/ETH/SOL research setup every visit; they should be able to save the markets and filters they care about, return to a prioritized daily queue, and see why something changed.

This change turns `/intelligence` from a read-only research terminal into a recurring workflow while preserving the product's non-trading, no-financial-advice boundary.

## What Changes

- Add saved intelligence filters so a user can name and persist safe `/api/intelligence/markets` query presets.
- Add a market watchlist so a user can pin supported public markets for repeat inspection.
- Add an in-app alert center with deterministic reason codes such as `new_high_priority_market`, `edge_changed`, `agent_disagreement_changed`, `data_health_degraded`, and `near_expiry`.
- Add a daily research queue that merges saved filters, watched markets, current market intelligence scores, unread alerts, expiry urgency, and data-health warnings into one prioritized read model.
- Add explicit refresh and freshness state so users can distinguish "no changes" from "not evaluated yet", stale evaluation, or evaluation failure.
- Add lightweight local workspace identity that does not require login: the client generates a non-secret workspace id and the server stores only bounded research preferences and alert state for that workspace.
- Preserve local JSON fallback and optional Supabase persistence; Supabase must not become mandatory.
- Update `/intelligence` UI to expose saved filters, watched markets, alerts, and daily queue without adding trading controls, transaction controls, manual market creation, manual evidence, or investment advice.

## Non-Goals

- No Polymarket order execution, AMM, brokerage, copy-trading, or transaction recommendation.
- No external notification channels in this version: no email, SMS, Telegram, Discord, push notification, webhook, or cron-delivered personal notification.
- No full account system, password login, wallet login, billing, teams, sharing, or cross-device identity guarantee.
- No expansion beyond supported public-data BTC, ETH, and SOL markets.
- No LLM-generated news summaries, pasted-news workflows, manual evidence entry, or manual parser correction.
- No Arc commit, proof transaction, demo resolution, autonomous run, or any spend/mutation side effect from alert evaluation.

## Impact

- Affected specs: `predictarena`, `predictarena-ui`
- Affected code: new saved-intelligence read/write models under `lib/`, bounded preference persistence under the existing store layer, API routes under `app/api/intelligence/`, `/intelligence` UI components, tests, and README/product docs.
- External data: existing public market intelligence APIs, persisted signals/runs/resolutions, client-generated workspace id, and saved user research preferences.
- Security boundaries: public APIs must validate workspace ids, cap stored items, sanitize responses, avoid secrets and raw provider diagnostics, and clearly label local workspace identity as convenience state rather than authentication.
- OpenSpec is required because this adds new public API/UI contracts, bounded user preference mutation, persistence behavior, and product workflow semantics.

## Graphify

Graphify: unavailable. The repository has no `graphify-out/` directory in this environment. Proposal context and impact analysis use project instructions, current OpenSpec specs, README, source inspection, and tests.
