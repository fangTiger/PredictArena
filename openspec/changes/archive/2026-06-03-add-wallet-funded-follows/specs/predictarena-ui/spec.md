## ADDED Requirements

### Requirement: Minimal Browser Wallet Follow UI
PredictArena UI MUST provide a minimal browser wallet flow for self-funded signal follows without turning the product into a trading interface or account dashboard.

#### Scenario: Home opens the wallet-first arena
- **WHEN** the user opens `/`
- **THEN** the app redirects to `/arena`
- **AND** `/arena` is the default place to connect a wallet, run agents, inspect generated signals, and self-fund a follow

#### Scenario: Wallet status is shown compactly
- **WHEN** the user opens `/arena`
- **THEN** the UI shows a compact wallet control for connect, connected address, Arc Testnet state, balance/allowance readiness, and latest wallet follow status
- **AND** the control follows the existing PredictArena war-room visual language
- **AND** the funding panel labels the displayed balance and allowance as the current connected wallet state

#### Scenario: Wallet entry is global and visually separate
- **WHEN** the user opens the home destination or any PageShell-backed PredictArena page
- **THEN** the top navigation keeps a browser wallet control at the far right
- **AND** the wallet control uses a visually distinct treatment from product navigation buttons
- **AND** the top navigation keeps only the core flow entry, display toggles, and wallet control
- **AND** a connected wallet can be disconnected from the PredictArena app session without using a paid transaction

#### Scenario: Display controls are globally available
- **WHEN** the user opens `/arena`, `/intelligence`, `/signals/[id]`, `/leaderboard`, `/proof`, or related detail pages
- **THEN** the top navigation provides light/dark and English/Chinese display controls
- **AND** toggling the display controls does not trigger wallet connection, approval, or a chain transaction

#### Scenario: User follows from a signal card
- **WHEN** a generated signal is eligible for wallet-funded follow and has not been followed by the connected wallet
- **THEN** the signal card shows one primary `Follow with Wallet` action
- **AND** the UI guides only the required steps: connect, switch chain, approve if needed, submit, confirm

#### Scenario: User runs agents and funds the selected signal
- **WHEN** the user clicks `Run Agents` from `/arena`
- **THEN** the UI opens the browser wallet connection path when no PredictArena wallet session exists
- **AND** the generated signal list is refreshed
- **AND** one eligible not-yet-followed signal is sent through the wallet-funded follow path
- **AND** the visible balance and allowance remain scoped to the connected user wallet

#### Scenario: Non-core manual controls stay out of the main wallet flow
- **WHEN** the user reviews `/arena` or `/signals/[id]`
- **THEN** the UI does not show server-wallet batch commit controls, admin/demo settlement forms, or manual token-entry flows as part of the core user journey
- **AND** `/arena` does not show agent/operator wallet balances as the basis for user funding decisions

#### Scenario: Wallet follow history stays lightweight
- **WHEN** wallet-funded follows exist for a signal
- **THEN** `/arena` and `/signals/[id]` show lightweight follow count, recent wallet address, and transaction link
- **AND** the UI does not introduce a user leaderboard, portfolio page, copy-trading controls, Polymarket order entry, or manual market/evidence inputs
