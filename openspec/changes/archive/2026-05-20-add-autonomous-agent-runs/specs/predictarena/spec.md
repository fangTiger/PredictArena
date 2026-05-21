## ADDED Requirements

### Requirement: Autonomous Agent Policy

PredictArena MUST define an `AgentPolicy` model for every autonomous agent and MUST NOT allow unlimited autonomous spend.

#### Scenario: Policy has finite budget limits

- **WHEN** an autonomous run evaluates a signal for an agent
- **THEN** that agent has a policy with mode `OFF`, `DRY_RUN`, or `LIVE`
- **AND** the policy includes finite `maxDailyBondUsdc6`, `maxSignalsPerDay`, `maxStakePerSignalUsdc6`, `maxOpenSignals`, and `minEdgeBps`

#### Scenario: Missing or unsafe LIVE budgets are rejected

- **WHEN** a policy is configured for `LIVE`
- **THEN** missing, negative, non-finite, or unlimited spend limits are rejected before any chain transaction

### Requirement: Autonomous Cron Runner

PredictArena MUST expose a secured cron runner that can run agents without user interaction.

#### Scenario: Cron endpoint rejects unauthorized requests

- **WHEN** `/api/cron/run-autonomous-agents` is called without `Authorization: Bearer <CRON_SECRET>` or with the wrong secret
- **THEN** the request is rejected
- **AND** no market scan, agent run, dry-run signal, or chain transaction is executed

#### Scenario: Dry-run mode persists signals without chain transactions

- **WHEN** the cron runner executes for an agent with mode `DRY_RUN`
- **THEN** it fetches markets, runs agents, applies Risk Agent output, checks budgets, and persists dry-run queue outcomes
- **AND** it does not call Arc approval or commit functions

#### Scenario: Live mode commits only eligible signals

- **WHEN** the cron runner executes for an agent with mode `LIVE`
- **THEN** it commits only medium/high confidence non-AVOID signals that satisfy Risk Agent and all per-agent policy budgets
- **AND** it records skipped reasons for low confidence, low edge, excessive stake, max daily spend, max daily signals, max open signals, mode off, and commit failures

### Requirement: Autonomous Run History

PredictArena MUST persist autonomous run history for UI and audit review.

#### Scenario: Run history is available

- **WHEN** an autonomous run completes
- **THEN** the store persists run id, mode summary, generated signal count, dry-run count, committed count, skipped count, commit queue rows, budget snapshots, started time, completed time, and source
- **AND** `/arena` can render recent autonomous runs without requiring a new run

### Requirement: Arc Readiness and Chain Sync

PredictArena MUST expose public Arc readiness and optional onchain synchronization without leaking secrets.

#### Scenario: Control room shows public readiness

- **WHEN** Arc config and agent keys are present
- **THEN** the server exposes contract address, Arc chain id, agent wallet public addresses, USDC balances, allowances, latest known tx, and commit availability
- **AND** private keys and `CRON_SECRET` are never returned

#### Scenario: Onchain leaderboard sync degrades safely

- **WHEN** onchain event/getter sync cannot run because RPC or contract config is missing
- **THEN** the API returns a degraded sync status
- **AND** the local leaderboard remains available from persisted state

### Requirement: Demo Resolution Command

PredictArena MUST provide a demo/admin resolution command path that closes the prediction -> bond -> settlement -> reputation loop without claiming decentralized oracle behavior.

#### Scenario: Admin demo resolution updates reputation

- **WHEN** an authorized admin marks a signal correct or incorrect
- **THEN** the selected signal resolution state is persisted
- **AND** leaderboard refunded/slashed/Brier score state updates
- **AND** the UI labels this as demo/admin settlement

### Requirement: CLOB Spread Risk Signal

PredictArena MUST inspect public orderbook spread when a market has CLOB token ids and expose the result as a risk diagnostic.

#### Scenario: Spread is available

- **WHEN** a parsed market has CLOB token ids and public orderbook data is reachable
- **THEN** the system computes spread, midpoint, and liquidity risk metadata
- **AND** Decision Trace and Risk Agent diagnostics can show that metadata

#### Scenario: Spread is unavailable

- **WHEN** public orderbook data is missing or unreachable
- **THEN** autonomous runs continue
- **AND** the signal records a degraded spread diagnostic rather than failing the run
