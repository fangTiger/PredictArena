## ADDED Requirements

### Requirement: Wallet-Funded Signal Follows
PredictArena MUST allow a connected browser-extension wallet to self-fund following an eligible generated signal on Arc Testnet without using server-side private keys.

#### Scenario: Connected wallet follows an eligible signal
- **WHEN** a connected wallet on Arc Testnet follows a non-AVOID signal with sufficient edge, confidence, USDC balance, and allowance
- **THEN** the client sends the USDC approval if required
- **AND** the client submits `SignalBondArena.commitSignal` with the stored signal fields
- **AND** the system records a wallet-funded follow receipt after chain confirmation

#### Scenario: Run Agents triggers the user-wallet follow path
- **WHEN** the user clicks `Run Agents` from `/arena`
- **THEN** the client requires a browser-extension wallet connection before treating the run as fundable
- **AND** generated eligible signals are evaluated for the currently connected wallet
- **AND** the client selects the first eligible signal not already followed by that wallet
- **AND** the selected signal uses the same connect, switch-chain, approve-if-needed, submit, and receipt-confirmation path as `Follow with Wallet`
- **AND** no server-side private key, agent wallet, or public server commit path is used

#### Scenario: Wallet follow does not alter agent commitment metrics
- **WHEN** a wallet-funded follow is recorded for a signal
- **THEN** the signal's agent commit state and `arcTxHash` remain unchanged
- **AND** agent leaderboard, bonded totals, autonomy budgets, and proof budgets do not count the wallet-funded follow

#### Scenario: Server verifies wallet follow receipts read-only
- **WHEN** the wallet follow confirmation API receives a signal id, wallet address, and transaction hash
- **THEN** the server reads the Arc transaction receipt
- **AND** verifies the `SignalCommitted` event matches the stored signal fields and follower wallet address
- **AND** rejects mismatched, missing, ineligible, duplicate, or malformed receipts with machine-readable reasons
- **AND** does not send transactions, select private keys, or expose server-only secrets

### Requirement: Public Server Wallet Commit Remains Disabled
PredictArena MUST keep public unauthenticated server-wallet signal commits disabled while supporting wallet-funded follows through browser wallet transactions.

#### Scenario: Public commit endpoint stays guarded
- **WHEN** a caller invokes `POST /api/commit-signal`
- **THEN** eligible public requests still return `public_commit_disabled`
- **AND** no server-side Arc approval, commit, private key selection, agent signal mutation, or wallet-funded follow mutation occurs
