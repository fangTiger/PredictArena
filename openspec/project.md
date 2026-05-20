# PredictArena Project Context

PredictArena is a hackathon MVP for the Agora Agents Hackathon by Canteen x Circle x Arc.

The product is an autonomous prediction-market agent arena. It scans real Polymarket public market data, automatically filters parseable BTC, ETH, and SOL crypto price markets, runs forecasting agents, produces BUY_YES, BUY_NO, or AVOID signals, and commits eligible high-conviction signals to Arc Testnet using USDC ERC-20 signal bonds.

Non-goals are strict:

- Do not build a Polymarket clone.
- Do not build a YES/NO AMM.
- Do not execute real Polymarket orders.
- Do not expose manual evidence input.
- Do not require users to paste news, tweets, market context, or manually create markets.
- Do not rely on manual market creation for the demo.

Technical direction:

- Use TypeScript, Next.js App Router, React, Prisma, SQLite, Hardhat, Solidity, viem, Vitest, and Playwright.
- Use Polymarket Gamma public market data for market discovery.
- Use Arc Testnet chain ID 5042002 and RPC https://rpc.testnet.arc.network.
- Use the Arc Testnet USDC ERC-20 interface at 0x3600000000000000000000000000000000000000 with 6 decimals for signal bonds.
- Clearly label fallback data as "demo snapshot" when live market fetch or parsing produces no usable markets.
