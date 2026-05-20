import { probabilityToBps, bpsToProbability, clampBps } from '@/lib/math/bps';
import { computeKellyBps } from '@/lib/math/kelly';
import { stableHash } from '@/lib/utils/stableHash';
import type {
  AgentSignal,
  ConfidenceLabel,
  ParsedCryptoMarket,
  SignalSide,
  SupportedAsset
} from '@/lib/polymarket/types';
import type { PriceSnapshot } from '@/lib/prices/types';
import { evaluateRisk } from '@/lib/agents/riskAgent';
import { runMomentumAgent } from '@/lib/agents/momentumAgent';
import { runVolatilityAgent } from '@/lib/agents/volatilityAgent';

interface RunAgentsOptions {
  now?: string;
  simulateProbability?: (input: {
    market: ParsedCryptoMarket;
    snapshot: PriceSnapshot;
    agentName: 'volatility' | 'momentum';
  }) => number;
}

function determineSide(yesPriceBps: number, pYesBps: number): SignalSide {
  if (pYesBps - yesPriceBps >= 700) {
    return 'YES';
  }

  if (yesPriceBps - pYesBps >= 700) {
    return 'NO';
  }

  return 'AVOID';
}

function determineConfidence(edgeBps: number, selectedProbabilityBps: number): ConfidenceLabel {
  if (edgeBps >= 1_200 && selectedProbabilityBps >= 7_000) {
    return 'HIGH';
  }

  if (edgeBps >= 700 && selectedProbabilityBps >= 5_800) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function stakeForEdge(edgeBps: number): number {
  if (edgeBps >= 2_000) {
    return 50_000;
  }

  if (edgeBps >= 1_200) {
    return 30_000;
  }

  if (edgeBps >= 700) {
    return 10_000;
  }

  return 0;
}

function buildSignal(
  market: ParsedCryptoMarket,
  snapshot: PriceSnapshot | undefined,
  agentName: 'volatility' | 'momentum',
  probability: number,
  now: string
): AgentSignal {
  const pYesBps = probabilityToBps(probability);
  const pNoBps = 10_000 - pYesBps;
  const side = determineSide(market.yesPriceBps, pYesBps);
  const marketPriceBps = side === 'NO' ? market.noPriceBps : market.yesPriceBps;
  const agentProbabilityBps = side === 'NO' ? pNoBps : pYesBps;
  const edgeBps =
    side === 'YES'
      ? pYesBps - market.yesPriceBps
      : side === 'NO'
        ? pNoBps - market.noPriceBps
        : Math.max(pYesBps - market.yesPriceBps, pNoBps - market.noPriceBps);
  const risk = evaluateRisk(market, snapshot, edgeBps, now);
  const confidence = determineConfidence(edgeBps, agentProbabilityBps);
  const finalSide = side === 'AVOID' || risk.forceAvoid ? 'AVOID' : side;
  const stakeMicroUsdc = finalSide === 'AVOID' ? 0 : stakeForEdge(edgeBps);
  const selectedProbability = bpsToProbability(agentProbabilityBps);
  const selectedMarketPrice = bpsToProbability(marketPriceBps);
  const kellyBps =
    finalSide === 'AVOID' ? 0 : computeKellyBps(selectedProbability, selectedMarketPrice);

  const modelVersion = agentName === 'volatility' ? 'volatility-gbm-v1' : 'momentum-gbm-v1';
  const modelParams = {
    sigma: snapshot?.sigma ?? 0,
    sigma7: snapshot?.sigma7 ?? 0,
    sigma30: snapshot?.sigma30 ?? 0,
    recentReturn7d: snapshot?.recentReturn7d ?? 0,
    thresholdUsd: market.thresholdUsd
  };

  return {
    id: `${market.id}:${agentName}`,
    runId: `run:${market.id}:${now}`,
    marketId: market.id,
    marketQuestion: market.question,
    marketUrl: market.url,
    asset: market.asset,
    conditionType: market.conditionType,
    thresholdUsd: market.thresholdUsd,
    expiresAt: market.expiresAt,
    agentName,
    modelVersion,
    modelParams,
    modelHash: stableHash({
      agentName,
      modelVersion,
      modelParams,
      conditionType: market.conditionType
    }),
    dataHash: stableHash({
      marketId: market.id,
      yesPriceBps: market.yesPriceBps,
      currentPrice: snapshot?.currentPrice ?? null,
      source: market.source,
      asOf: snapshot?.asOf ?? now
    }),
    side: finalSide,
    status: 'generated',
    confidence,
    confidenceBps: clampBps(agentProbabilityBps),
    marketPriceBps,
    agentProbabilityBps,
    yesPriceBps: market.yesPriceBps,
    pYesBps,
    edgeBps: Math.max(0, edgeBps),
    kellyBps,
    stakeMicroUsdc,
    riskFlags: risk.flags,
    arcTxHash: null,
    createdAt: now,
    updatedAt: now,
    source: market.source,
    resolution: null
  };
}

export function runAgents(
  markets: ParsedCryptoMarket[],
  priceByAsset: Map<SupportedAsset, PriceSnapshot>,
  options: RunAgentsOptions = {}
): AgentSignal[] {
  const now = options.now ?? new Date().toISOString();
  const signals: AgentSignal[] = [];

  for (const market of markets) {
    const snapshot = priceByAsset.get(market.asset);
    const volatilityProbability = snapshot
      ? options.simulateProbability?.({
          market,
          snapshot,
          agentName: 'volatility'
        }) ?? runVolatilityAgent({ market, snapshot })
      : 0.5;
    const momentumProbability = snapshot
      ? options.simulateProbability?.({
          market,
          snapshot,
          agentName: 'momentum'
        }) ?? runMomentumAgent({ market, snapshot })
      : 0.5;

    signals.push(buildSignal(market, snapshot, 'volatility', volatilityProbability, now));
    signals.push(buildSignal(market, snapshot, 'momentum', momentumProbability, now));
  }

  return signals;
}
