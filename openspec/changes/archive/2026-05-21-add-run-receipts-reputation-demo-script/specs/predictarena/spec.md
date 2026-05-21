## ADDED Requirements

### Requirement: Autonomous Run Receipt Read Model

PredictArena MUST expose an auditable receipt for each persisted autonomous run without requiring user interaction or exposing server secrets.

#### Scenario: Autonomous run receipt is retrieved

- **WHEN** a client requests the receipt for a persisted autonomous run
- **THEN** the response includes run id, source, timing, market count, generated signal count, mode by agent, queue outcomes, budget snapshots, related signal ids, confidence, edge, stake, model hash, data hash, policy decision, failure reason, and tx hash when present
- **AND** the response does not expose `CRON_SECRET`, Supabase service role keys, agent private keys, or admin private keys

#### Scenario: Unknown run receipt is requested

- **WHEN** a client requests a receipt for an unknown autonomous run id
- **THEN** the API returns a controlled not-found response without creating state or running agents

### Requirement: Agent Reputation Profile Read Model

PredictArena MUST expose per-agent reputation profiles derived from persisted generated, committed, and resolved signals.

#### Scenario: Agent reputation is retrieved

- **WHEN** a client requests the reputation profile for Volatility Agent or Momentum Agent
- **THEN** the response includes generated, committed, open, resolved, accuracy, average edge, bonded/refunded/slashed USDC, paper ROI, Brier score, confidence distribution, recent signals, and best/worst resolved signals when available

#### Scenario: Unsupported agent profile is requested

- **WHEN** a client requests a profile for an unsupported agent name
- **THEN** the API returns a controlled validation error

### Requirement: Resolution Demo Script Read Model

PredictArena MUST provide a guided demo script read model for settlement demonstrations while preserving admin-token authorization for mutations.

#### Scenario: Demo script data is retrieved

- **WHEN** a client opens the demo script surface
- **THEN** the system returns eligible committed unresolved signals, recent resolved signals, leaderboard summary, and settlement guidance
- **AND** the response labels settlement as demo/admin flow rather than an oracle

#### Scenario: Demo settlement mutation remains protected

- **WHEN** a demo script user attempts to mark a signal correct or incorrect
- **THEN** the existing server-side admin token authorization is required before resolution state changes
