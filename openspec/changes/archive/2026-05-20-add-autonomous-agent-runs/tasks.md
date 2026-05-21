## 1. Specification and Governance

- [x] 1.1 Create OpenSpec proposal, design, task list, and spec deltas.
- [x] 1.2 Validate `add-autonomous-agent-runs` with strict OpenSpec validation.
- [x] 1.3 Record dirty baseline, Graphify degradation, executor split, and validation plan.

## 2. Autonomy Policy and Cron Runner

- [x] 2.1 Add `AgentPolicy` and autonomy mode models with finite safe defaults and env parsing.
- [x] 2.2 Add budget evaluation for `maxDailyBondUsdc6`, `maxSignalsPerDay`, `maxStakePerSignalUsdc6`, `maxOpenSignals`, and `minEdgeBps`.
- [x] 2.3 Add autonomous runner that fetches markets, runs agents, applies Risk Agent output, evaluates budgets, persists run history, and commits only eligible medium/high confidence signals in `LIVE`.
- [x] 2.4 Add `POST /api/cron/run-autonomous-agents` plus Vercel-compatible `GET` wrapper with `CRON_SECRET` authorization.
- [x] 2.5 Add tests for auth failures, `OFF`, `DRY_RUN`, `LIVE` budget blocks, dry-run persistence, and no unlimited autonomous spend.

## 3. Persistence, Arc Readiness, and Chain Sync

- [x] 3.1 Extend persistence store with autonomous run history and dry-run queue outcomes.
- [x] 3.2 Add Agent Control Room public readiness service for contract address, Arc chain, agent wallet addresses, USDC balances, allowances, latest tx, and commit availability.
- [x] 3.3 Add chain-sync helper/API to reconcile `SignalBondArena` committed/resolved/refunded/slashed state into local leaderboard where configuration permits.
- [x] 3.4 Keep all secret values server-only and expose only public addresses/statuses.

## 4. UI and Decision Trace

- [x] 4.1 Add Autonomy Panel to `/arena` showing policy mode, budgets, run history, dry-run/live status, and commit queue outcomes.
- [x] 4.2 Add Agent Control Room / Arc Readiness panel showing chain, contract, wallets, balance, allowance, latest tx, and commit availability.
- [x] 4.3 Upgrade `/signals/[id]` to Decision Trace with Market Scout score, volatility summary, Monte Carlo probability, momentum drift, Risk Agent timeline, deterministic payload, and CLOB spread/liquidity diagnostics.
- [x] 4.4 Add batch commit queue status with per-signal approve/commit state, failure reason, and tx hash.
- [x] 4.5 Add hidden/admin demo resolution entry that clearly labels demo/admin settlement.

## 5. Documentation and Verification

- [x] 5.1 Update `.env.example` and README with `CRON_SECRET`, policy envs, Vercel Cron GET note, and local cron POST examples.
- [x] 5.2 Run targeted RED/GREEN tests during implementation.
- [x] 5.3 Run `npm test`, `npm run lint`, `npm run build`, and E2E/browser checks as feasible.
- [x] 5.4 Request independent Review Codex gate before final VERIFY.
