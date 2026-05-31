## 1. Proposal, Review, and Contract Freezing

- [x] 1.1 [Architecture Codex] Validate proposal, design, tasks, and spec deltas with `openspec validate add-saved-intelligence-alerts --strict --no-interactive`.
- [x] 1.2 [Architecture Codex] Run two independent Review Codex agents: product/usefulness reviewer and engineering/security reviewer.
- [x] 1.3 [Architecture Codex] Reconcile reviewer feedback until both reviewers agree on `PASS` or an equivalent consensus to proceed.
- [x] 1.4 [Architecture Codex] Freeze API contracts, workspace identity rules, persistence bounds, editable files, validation commands, and stop conditions before implementation.
- [x] 1.5 [Architecture Codex] Prepare the Handoff Task Package and update `.codex/session-state.md` before delegating implementation.

## 2. Contracts, Persistence, and Tests

- [x] 2.1 [Implementation Codex] Add TypeScript types and zod schemas for workspace id, saved filters, watchlist entries, alerts, alert thresholds, freshness state, alert evaluation snapshots, and daily queue items.
- [x] 2.2 [Implementation Codex] Write failing tests for workspace id validation, workspace ownership mismatch, filter query validation, bounded item limits, duplicate watch handling, duplicate alert suppression, freshness state, sanitized responses, and no transaction/agent-run side effects.
- [x] 2.3 [Implementation Codex] Implement saved-intelligence persistence in an independent `savedIntelligence` namespace or equivalent isolated subdocument using the existing store boundary with local JSON fallback and optional Supabase compatibility when available; preserve existing arena/autonomy/proof/signal fields exactly.
- [x] 2.4 [Implementation Codex] Implement deterministic alert evaluation from existing intelligence read models without calling market mutation, agent run, proof, Arc, resolution, or trading paths.

## 3. Public Saved-Intelligence APIs

- [x] 3.1 [Implementation Codex] Add `GET /api/intelligence/workspace`.
- [x] 3.2 [Implementation Codex] Add saved-filter list/create/update/delete routes.
- [x] 3.3 [Implementation Codex] Add watchlist list/create/delete routes.
- [x] 3.4 [Implementation Codex] Add alert list/evaluate/update routes.
- [x] 3.5 [Implementation Codex] Add `GET /api/intelligence/daily-queue`.
- [x] 3.6 [Implementation Codex] Add API tests for invalid_request, not_found, saved_intelligence_limit_reached, duplicate watch returning HTTP 200 with the existing item and `duplicate: true`, saved_intelligence_unavailable where feasible, workspace ownership mismatch, deterministic alert reasons, read/dismiss state, freshness snapshots, queue ranking, response allowlists, and mutation isolation.

## 4. Intelligence Workspace UI

- [x] 4.1 [Implementation Codex] Add client-side workspace id generation and local storage handling for `/intelligence`.
- [x] 4.2 [Implementation Codex] Add save-current-filter, saved-filter selection, and delete/disable controls.
- [x] 4.3 [Implementation Codex] Add watch/unwatch controls for market rows and selected research.
- [x] 4.4 [Implementation Codex] Add alert center with unread counts, reason codes, severity, read/dismiss controls, refresh saved intelligence control, last evaluated/stale/failed state, and links back into research.
- [x] 4.5 [Implementation Codex] Add daily research queue panel that preserves the existing market radar, research, agent comparison, and paper-follow path.
- [x] 4.6 [Implementation Codex] Add in-product local workspace disclosure such as "Saved on this device" / "Local workspace" and explain that clearing local storage can remove saved preferences.
- [x] 4.7 [Implementation Codex] Add responsive e2e coverage for saving a filter, seeing local workspace disclosure, watching a market, refreshing/evaluating alerts, seeing last evaluated or stale state, reading/dismissing alerts, opening a queue item, and verifying no horizontal overflow, no trading controls, no transaction controls, no manual market creation, and no manual evidence input.

## 5. Documentation and Positioning

- [x] 5.1 [Implementation Codex] Update README route/API surfaces and product positioning for saved intelligence.
- [x] 5.2 [Implementation Codex] Document local workspace identity as convenience state, not authentication, and note that clearing browser local storage may remove access to saved preferences.
- [x] 5.3 [Implementation Codex] Document that alerts and daily queue are research prompts, not financial advice, trade recommendations, or performance guarantees.

## Editable and Forbidden Scope

- Editable files: `openspec/changes/add-saved-intelligence-alerts/**`, `app/intelligence/**`, `app/api/intelligence/**`, `components/**` for intelligence UI components, `lib/intelligence/**`, new saved-intelligence domain files under `lib/intelligence/**`, `lib/persistence/store.ts`, `lib/persistence/localStore.ts`, and `lib/persistence/supabaseStore.ts` only for adding isolated saved-intelligence store methods and preserving existing state fields, `test/intelligence-*.test.ts`, `test/e2e/**`, `README.md`, and route/navigation files needed for saved-intelligence UI.
- Forbidden without explicit Architecture Codex approval: `lib/arc/**`, `lib/proof/**` transaction execution paths, `lib/autonomy/runAutonomousAgents.ts`, `app/api/proof/**` mutation behavior, `app/api/cron/**` mutation behavior, `app/api/admin/resolve-demo/**`, `app/api/resolve-demo/**`, `app/api/run-agents/**`, `app/api/commit-signal/**`, `contracts/**`, private key/env secret handling, and any Polymarket trading or order execution path.

## 6. Review and Verification

- [x] 6.1 [Implementation Codex] Run focused RED/GREEN evidence for saved-intelligence domain and API tests.
- [x] 6.2 [Implementation Codex] Run `npm run lint`, `npm test`, `npm run build`, and targeted e2e.
- [x] 6.3 [Review Codex] Review scope alignment, API contracts, workspace identity risk, item caps, no-financial-advice copy, mutation isolation, response sanitization, and verification evidence.
- [x] 6.4 [Architecture Codex] Run final fresh verification and decide whether to archive into `openspec/specs/`.

## Stop Conditions

- Stop if implementation adds Polymarket trading, AMM, copy-trading, brokerage, order-entry, or transaction recommendations.
- Stop if alert evaluation calls agent-run, market mutation, Arc commit, proof transaction, demo/admin resolution, cron/autonomy, or any spend path.
- Stop if public APIs expose private keys, service-role keys, cron/proof/admin secrets, raw RPC/provider diagnostics, lock owners, idempotency keys, stack-like internals, internal URLs, request headers, server config, or raw market payloads.
- Stop if workspace id is described as authentication or used to protect sensitive data.
- Stop if update/delete/read-state mutation can affect resources from another workspace, or if ownership mismatch reveals cross-workspace resource existence.
- Stop if saved-intelligence persistence overwrites, drops, or changes existing arena, signal, autonomy, proof, ops, resolution, claim, lock, or leaderboard state.
- Stop if the first version adds email, SMS, Telegram, Discord, push, webhook, wallet login, password login, billing, teams, or sharing without a separate proposal.
- Stop if saved filters or alerts imply buy/sell/follow/trade recommendations or guaranteed performance.
- Stop if Supabase becomes mandatory for local development or demo usage.
- Stop if implementation begins before both proposal reviewers reach consensus.

## Validation Commands

- `openspec validate add-saved-intelligence-alerts --strict --no-interactive`
- `rg -n "refresh|freshness|last evaluated|stale|failed|saved on this device|local workspace|clear local storage|workspace ownership|saved_intelligence_limit_reached|duplicate: true|saved_intelligence_unavailable" openspec/changes/add-saved-intelligence-alerts`
- `npm test -- test/intelligence-saved-state.test.ts test/intelligence-saved-api.test.ts`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e -- test/e2e/intelligence.spec.ts`
