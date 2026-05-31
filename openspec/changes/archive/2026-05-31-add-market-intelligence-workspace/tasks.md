## 1. Proposal, Review, and Contract Freezing

- [x] 1.1 [Architecture Codex] Validate the OpenSpec proposal, design, tasks, and spec deltas with `openspec validate add-market-intelligence-workspace --strict --no-interactive`.
- [x] 1.2 [Architecture Codex] Run two independent review agents: product/usefulness reviewer and engineering/security reviewer.
- [x] 1.3 [Architecture Codex] Reconcile reviewer feedback and record the consensus decision before implementation.
- [x] 1.4 [Architecture Codex] Freeze public read model contracts, API route contracts, file allowlists, validation commands, and stop conditions.
- [x] 1.5 [Architecture Codex] Reconcile the existing public commit spec conflict so unauthenticated `/api/commit-signal` is explicitly disabled and authorized server-wallet commits remain limited to autonomy/proof paths.

## 2. Read Model Contracts and Tests

- [x] 2.1 [Implementation Codex] Add TypeScript types for `MarketIntelligenceItem`, `SignalResearchView`, `SegmentedAgentReputation`, and `PaperFollowResult`.
- [x] 2.2 [Implementation Codex] Write failing tests for opportunity/risk/data-health scoring formulas, stale/degraded-source thresholds, deterministic explanation fields, reputation segmentation buckets, paper-follow assumptions, source mix, and insufficient-data states.
- [x] 2.3 [Implementation Codex] Implement read model builders using existing market, price, signal, run, and resolution data.
- [x] 2.4 [Implementation Codex] Verify read models are public-response allowlisted and never expose `rawPayload`, secrets, raw provider diagnostics, lock owners, idempotency keys, ops internals, server config, or private runtime state.

## 3. Public Intelligence APIs

- [x] 3.1 [Implementation Codex] Add `GET /api/intelligence/markets` with filter/sort query validation.
- [x] 3.2 [Implementation Codex] Add `GET /api/intelligence/research` for `signalId` or `marketId` research views.
- [x] 3.3 [Implementation Codex] Add `GET /api/intelligence/agents` for segmented reputation rows.
- [x] 3.4 [Implementation Codex] Add `GET /api/intelligence/paper-follow` for read-only paper-follow/backtest results.
- [x] 3.5 [Implementation Codex] Add API tests for query enums/defaults, invalid_request, not_found, deterministic output, empty/insufficient data states, source mix, response allowlists, and secret/internal-field non-exposure.

## 4. Intelligence Workspace UI

- [x] 4.1 [Implementation Codex] Add `/intelligence` workspace route with dense research-terminal layout and make it discoverable from the default entry, global navigation, and README route table.
- [x] 4.2 [Implementation Codex] Add market radar filters, sorting, opportunity/risk/data-health indicators, and selected-market summary.
- [x] 4.3 [Implementation Codex] Add signal research panel/page with implied-vs-agent probability, drivers, risk flags, comparable outcomes, and accountability status.
- [x] 4.4 [Implementation Codex] Add segmented agent comparison and paper-follow panels.
- [x] 4.5 [Implementation Codex] Add responsive E2E coverage for the daily research path: open `/intelligence`, filter/sort markets, select research, compare agent segment, adjust paper-follow assumptions, and verify no horizontal overflow, no manual evidence input, no market creation, no trading controls, and no transaction controls.

## 5. Documentation and Positioning

- [x] 5.1 [Implementation Codex] Update README product positioning from demo-first to intelligence-workspace-first while preserving Arc accountability boundaries.
- [x] 5.2 [Implementation Codex] Document that paper-follow and scores are research tools, not financial advice or transaction recommendations.
- [x] 5.3 [Implementation Codex] Document API surfaces, filters, scoring assumptions, data limitations, and local fallback behavior.

## Editable and Forbidden Scope

- Editable files: `openspec/changes/add-market-intelligence-workspace/**`, `app/intelligence/**`, `app/api/intelligence/**`, `components/**` for intelligence UI components, `lib/intelligence/**`, existing safe read-model helpers under `lib/insights/**` or `lib/resolution/**` when needed, `test/intelligence-*.test.ts`, `test/e2e/**`, `README.md`, and route/navigation files needed to expose `/intelligence`.
- Forbidden without explicit Architecture Codex approval: `lib/arc/commitSignal.ts`, `lib/proof/service.ts` transaction execution paths, `app/api/proof/**` mutation behavior, `app/api/cron/**` mutation behavior, `app/api/admin/resolve-demo/**`, `app/api/resolve-demo/**`, `contracts/**`, private key/env secret handling outside read-only validation, and any Polymarket trading or order execution path.

## 6. Review and Verification

- [x] 6.1 [Implementation Codex] Run focused RED/GREEN evidence for read model and API tests.
- [x] 6.2 [Implementation Codex] Run `npm run lint`, `npm test`, `npm run build`, and targeted e2e.
- [x] 6.3 [Review Codex] Review scope alignment, API contracts, no-financial-advice copy, security sanitization, and verification evidence.
- [x] 6.4 [Architecture Codex] Run final fresh verification and decide whether to archive into `openspec/specs/`.

## Stop Conditions

- Stop if implementation adds Polymarket trading, AMM, copy-trading, brokerage, or real-money production spend behavior.
- Stop if public read APIs expose private keys, service-role keys, cron/proof/admin secrets, raw RPC/provider diagnostics, lock owners, idempotency keys, or stack-like internals.
- Stop if the workspace requires manual market creation, manual evidence input, pasted-news workflows, or manual parser correction.
- Stop if the first version expands beyond supported BTC/ETH/SOL public crypto market intelligence without explicit approval.
- Stop if paper-follow sends transactions, mutates signal state, claims financial advice, or presents performance as guaranteed.
- Stop if Supabase becomes mandatory for local development or demo usage.
- Stop if implementation begins before the public commit spec conflict is reconciled or before API/read-model contracts are frozen.

## Validation Commands

- `openspec validate add-market-intelligence-workspace --strict --no-interactive`
- `npm test -- test/intelligence-read-models.test.ts test/intelligence-api.test.ts`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`
