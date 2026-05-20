# Design: Resolution Engine

## Overview

Resolution closes the PredictArena loop after a signal has been committed. The resolver evaluates the stored `AgentSignal` against public crypto candles, determines whether the market's YES outcome occurred, then marks the agent signal correct or incorrect according to its selected side. Scoring is deterministic and stored in the same persistence state used by the leaderboard.

## Resolution Rules

- `EXPIRY_ABOVE`: YES if the latest settlement candle close at or before expiry is greater than the threshold.
- `EXPIRY_BELOW`: YES if the latest settlement candle close at or before expiry is less than the threshold.
- `TOUCH_ABOVE`: YES if any candle high from signal creation through expiry is greater than or equal to the threshold.
- `TOUCH_BELOW`: YES if any candle low from signal creation through expiry is less than or equal to the threshold.

The engine only resolves committed, unresolved, non-AVOID signals. If there is insufficient candle coverage, the signal remains unresolved with a skipped reason in the API response.

## API Flow

`POST /api/resolve-signals` loads committed unresolved signals, resolves eligible ones using `resolveCryptoMarket`, computes correctness for each signal side, optionally calls Arc bulk resolution when onchain configuration and admin key are present, then persists the resolution. `POST /api/admin/resolve-demo` requires `ADMIN_RESOLVE_TOKEN` and writes demo/admin resolution state only.

## Contract Flow

`SignalBondArena.resolveSignalsBulk` validates matching array lengths and calls the same internal owner-only resolution path used by `resolveSignal`. Correct signals transfer stake to the agent. Incorrect signals transfer stake to treasury.

## Scoring

Brier score is computed against the YES outcome using the stored `pYesBps`. Accuracy counts resolved non-AVOID signals where the chosen side matched the outcome. Paper ROI uses selected-side market price: correct returns `10000 - marketPriceBps`; incorrect returns `-marketPriceBps`.

## UI

Leaderboard extends existing light-first table styling. No new manual evidence UI is introduced.
