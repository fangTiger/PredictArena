## ADDED Requirements

### Requirement: Autonomous Market Discovery

The application MUST fetch active Polymarket public market data automatically when the user opens the app or triggers a scan, without requiring manual market creation or manual prediction-question entry.

#### Scenario: Live scan uses public Polymarket data

- **WHEN** the scan route runs and Polymarket public data is reachable
- **THEN** the application fetches active public markets from Polymarket
- **AND** records total markets scanned, parsed markets, skipped markets, and scan source as live

#### Scenario: No manual question entry is present

- **WHEN** the user views the application
- **THEN** there is no user-facing control for creating a prediction question or manually adding a market

### Requirement: Crypto Price Market Filtering

The application MUST support only confidently parseable BTC, ETH, and SOL crypto price markets for the MVP and MUST skip unsupported or ambiguous markets automatically.

#### Scenario: Supported crypto price market is parsed

- **WHEN** a market question identifies exactly one of BTC, ETH, or SOL and a price threshold
- **THEN** the parser stores the asset, threshold, deadline, Polymarket identifiers, YES/NO prices, and parse confidence

#### Scenario: Ambiguous market is skipped

- **WHEN** a market question cannot be parsed confidently as a BTC, ETH, or SOL price market
- **THEN** the application skips it automatically
- **AND** records a skip reason instead of asking the user for clarification

### Requirement: Demo Snapshot Fallback

The application MUST still demo if live Polymarket fetching or parsing yields no usable markets by falling back to a preloaded dataset clearly labeled "demo snapshot".

#### Scenario: Live data yields no parseable markets

- **WHEN** live scanning completes with zero confidently parseable markets
- **THEN** the application loads the preloaded snapshot dataset
- **AND** labels the scan source and UI as "demo snapshot"

#### Scenario: Polymarket fetch fails

- **WHEN** the Polymarket fetch adapter returns an error
- **THEN** the application loads the preloaded snapshot dataset
- **AND** records the fallback reason for display

### Requirement: Forecasting Agent Arena

The application MUST run Volatility Agent, Momentum Agent, and Risk Agent to generate BUY_YES, BUY_NO, or AVOID signals from parsed market and price data.

#### Scenario: User runs agents

- **WHEN** the user clicks "Run Agents"
- **THEN** Volatility Agent and Momentum Agent produce probabilities and reasons
- **AND** Risk Agent produces the final BUY_YES, BUY_NO, or AVOID decision
- **AND** the application stores agent forecasts and generated signals

#### Scenario: Weak signal is avoided

- **WHEN** forecast confidence, liquidity, expiry, or edge is below MVP thresholds
- **THEN** Risk Agent outputs AVOID
- **AND** the signal is not eligible for Arc commitment

### Requirement: Arc USDC Signal Bonds

The application MUST support committing eligible high-conviction signals to Arc Testnet using the Arc USDC ERC-20 interface as a signal bond.

#### Scenario: Eligible signal is committed

- **WHEN** a signal is eligible and Arc commit configuration is available
- **THEN** the server approves USDC if needed, calls the signal-bond vault, stores the Arc transaction hash, and displays the hash with signal details

#### Scenario: Ineligible signal is not committed

- **WHEN** a signal decision is AVOID or below commitment thresholds
- **THEN** the application prevents commitment
- **AND** displays the reason the signal is not eligible

### Requirement: Non-Polymarket-Clone User Flow

The application MUST present an autonomous agent arena dashboard rather than a Polymarket clone, AMM, or trading interface.

#### Scenario: Dashboard metrics are shown

- **WHEN** the user opens the app after a scan or agent run
- **THEN** the dashboard shows total markets scanned, signals generated, signals committed, USDC bonded, and agent scores

#### Scenario: Manual evidence input is absent

- **WHEN** the user views the application
- **THEN** there is no manual evidence textarea and no requirement to paste news, tweets, or market context
