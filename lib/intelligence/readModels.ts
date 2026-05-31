import type { ArenaState } from '@/lib/persistence/store';
import type {
  AgentSignal,
  ConfidenceLabel,
  MarketConditionType,
  MarketSource,
  ParsedCryptoMarket,
  SupportedAsset
} from '@/lib/polymarket/types';
import { computeBrierScoreBps, computePaperRoiBps } from '@/lib/resolution/scoring';

export type MarketIntelligenceSort =
  | 'opportunity_desc'
  | 'edge_desc'
  | 'expiry_asc'
  | 'liquidity_desc'
  | 'risk_asc'
  | 'data_health_desc';

export interface MarketCatalogFilters {
  asset: SupportedAsset | 'all';
  conditionType: MarketConditionType | 'all';
  confidence: ConfidenceLabel | 'all';
  source: MarketSource | 'all';
  sort: MarketIntelligenceSort;
  minEdgeBps: number;
  maxExpiryDays: number;
  minLiquidity: number;
  limit: number;
}

export interface MarketAgentView {
  signalId: string;
  agentName: AgentSignal['agentName'];
  side: AgentSignal['side'];
  confidence: AgentSignal['confidence'];
  confidenceBps: number;
  marketPriceBps: number;
  agentProbabilityBps: number;
  edgeBps: number;
  createdAt: string;
  modelHash: AgentSignal['modelHash'];
  dataHash: AgentSignal['dataHash'];
  riskFlags: string[];
  source: AgentSignal['source'];
  status: AgentSignal['status'];
  txHash: AgentSignal['arcTxHash'];
}

export interface MarketIntelligenceItem {
  marketId: string;
  question: string;
  asset: SupportedAsset;
  conditionType: MarketConditionType;
  thresholdUsd: number;
  expiresAt: string;
  source: MarketSource;
  marketUrl: string | null;
  yesPriceBps: number;
  noPriceBps: number;
  impliedProbabilityBps: number;
  liquidity: number;
  volume: number;
  freshnessStatus: 'fresh' | 'degraded' | 'stale';
  timeToExpiryHours: number;
  bestAgent: MarketAgentView | null;
  agentViews: MarketAgentView[];
  dataHealthScoreBps: number;
  opportunityScoreBps: number;
  riskScoreBps: number;
  riskFlags: string[];
  spreadDiagnostics: {
    status: 'available' | 'degraded' | 'missing';
    bestBidBps: number | null;
    bestAskBps: number | null;
    midpointBps: number | null;
    spreadBps: number | null;
    liquidityUsd: number | null;
    reason: SpreadDiagnosticsReasonCode;
  };
  accountabilityStatus: 'untracked' | 'generated' | 'committed' | 'resolved';
  summary: string;
}

export interface MarketIntelligenceCatalog {
  filters: MarketCatalogFilters;
  freshness: {
    latestScanAt: string | null;
    marketCount: number;
  };
  items: MarketIntelligenceItem[];
}

export type AgentReputationGroupBy =
  | 'agent'
  | 'asset'
  | 'conditionType'
  | 'expiryBucket'
  | 'confidenceBucket'
  | 'edgeBucket';

export interface AgentReputationFilters {
  groupBy: AgentReputationGroupBy;
  asset: SupportedAsset | 'all';
  conditionType: MarketConditionType | 'all';
  confidence: ConfidenceLabel | 'all';
  minResolved: number;
}

export interface SegmentedAgentReputationRow {
  agentName: AgentSignal['agentName'];
  groupBy: AgentReputationGroupBy;
  groupValue: string;
  generatedCount: number;
  committedCount: number;
  resolvedCount: number;
  accuracyBps: number;
  brierScoreBps: number | null;
  averageEdgeBps: number;
  paperRoiBps: number;
  bondedMicroUsdc: number;
  refundedMicroUsdc: number;
  slashedMicroUsdc: number;
  insufficientData: boolean;
}

export type PaperFollowStakeModel = 'signal_stake' | 'flat_1_usdc' | 'confidence_weighted';

export interface PaperFollowFilters {
  agentName: AgentSignal['agentName'] | 'all';
  minEdgeBps: number;
  confidence: ConfidenceLabel | 'all';
  asset: SupportedAsset | 'all';
  conditionType: MarketConditionType | 'all';
  from: string | null;
  to: string | null;
  stakeModel: PaperFollowStakeModel;
}

export interface PaperFollowCurvePoint {
  signalId: string;
  resolvedAt: string;
  cumulativeRoiBps: number;
}

export interface PaperFollowBreakdownRow {
  key: string;
  includedCount: number;
  resolvedCount: number;
  paperRoiBps: number;
}

export interface PaperFollowResult {
  assumptions: PaperFollowFilters;
  includedCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  skippedCount: number;
  wins: number;
  losses: number;
  averageEdgeBps: number;
  hitRateBps: number;
  paperRoiBps: number;
  brierScoreBps: number | null;
  maxDrawdownBps: number;
  insufficientData: boolean;
  sourceMix: {
    automatic: number;
    demo_admin: number;
    unresolved: number;
    unknown: number;
  };
  skippedReasonCounts: Record<string, number>;
  curve: PaperFollowCurvePoint[];
  breakdownByAsset: PaperFollowBreakdownRow[];
  breakdownByConditionType: PaperFollowBreakdownRow[];
}

export interface SignalResearchView {
  target: {
    signalId: string | null;
    marketId: string;
  };
  market: {
    marketId: string;
    question: string;
    asset: SupportedAsset;
    conditionType: MarketConditionType;
    thresholdUsd: number;
    expiresAt: string;
    impliedProbabilityBps: number;
    liquidity: number;
    volume: number;
    source: MarketSource;
    scoutScoreBps: number;
    parseConfidence: number;
  };
  agentViews: MarketAgentView[];
  spreadDiagnostics: MarketIntelligenceItem['spreadDiagnostics'];
  drivers: {
    primary: string;
    marketRiskFlags: string[];
    volatilityRiskFlags: string[];
    momentumRiskFlags: string[];
  };
  accountability: {
    status: 'untracked' | 'generated' | 'committed' | 'resolved';
    dryRunCount: number;
    dryRunPresent: boolean;
    resolvedCount: number;
    committedCount: number;
    txHashes: Array<`0x${string}`>;
    resolutionSourceMix: PaperFollowResult['sourceMix'];
    proofStatus: 'observed' | 'not_observed';
  };
  comparableOutcomes: {
    resolvedCount: number;
    accuracyBps: number;
    averageEdgeBps: number;
  };
  summary: string;
}

export type SpreadDiagnosticsReasonCode =
  | 'missing'
  | 'provider_degraded'
  | 'spread_unavailable'
  | null;

interface SpreadDiagnosticsView {
  status: 'available' | 'degraded' | 'missing';
  bestBidBps: number | null;
  bestAskBps: number | null;
  midpointBps: number | null;
  spreadBps: number | null;
  liquidityUsd: number | null;
  reason: SpreadDiagnosticsReasonCode;
}

interface RelatedSignalContext {
  relatedSignals: AgentSignal[];
  latestSignal: AgentSignal | null;
  bestSignal: AgentSignal | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function safeDateMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function diffHours(start: string, end: string): number {
  const startMs = safeDateMs(start);
  const endMs = safeDateMs(end);
  if (startMs === null || endMs === null) {
    return 0;
  }

  return (endMs - startMs) / 3_600_000;
}

function diffDays(start: string, end: string): number {
  return diffHours(start, end) / 24;
}

function sortSignalsByCreatedDesc(signals: AgentSignal[]): AgentSignal[] {
  return [...signals].sort((left, right) => {
    const createdDiff = right.createdAt.localeCompare(left.createdAt);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return right.edgeBps - left.edgeBps;
  });
}

function toAgentView(signal: AgentSignal): MarketAgentView {
  return {
    signalId: signal.id,
    agentName: signal.agentName,
    side: signal.side,
    confidence: signal.confidence,
    confidenceBps: signal.confidenceBps,
    marketPriceBps: signal.marketPriceBps,
    agentProbabilityBps: signal.agentProbabilityBps,
    edgeBps: signal.edgeBps,
    createdAt: signal.createdAt,
    modelHash: signal.modelHash,
    dataHash: signal.dataHash,
    riskFlags: [...signal.riskFlags],
    source: signal.source,
    status: signal.status,
    txHash: signal.arcTxHash
  };
}

function signalContextForMarket(state: ArenaState, marketId: string): RelatedSignalContext {
  const relatedSignals = sortSignalsByCreatedDesc(
    state.signals.filter((signal) => signal.marketId === marketId)
  );
  const bestSignal = [...relatedSignals].sort((left, right) => {
    const edgeDiff = Math.abs(right.edgeBps) - Math.abs(left.edgeBps);
    if (edgeDiff !== 0) {
      return edgeDiff;
    }

    return right.createdAt.localeCompare(left.createdAt);
  })[0] ?? null;

  return {
    relatedSignals,
    latestSignal: relatedSignals[0] ?? null,
    bestSignal
  };
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values));
}

function sanitizeSpreadDiagnosticsReason(
  rawReason: unknown,
  status: SpreadDiagnosticsView['status']
): SpreadDiagnosticsReasonCode {
  if (status === 'available') {
    return null;
  }

  if (status === 'missing') {
    return 'missing';
  }

  if (typeof rawReason !== 'string' || rawReason.trim() === '') {
    return 'provider_degraded';
  }

  const normalized = rawReason.trim().toLowerCase();
  if (normalized === 'missing') {
    return 'missing';
  }
  if (normalized === 'provider_degraded') {
    return 'provider_degraded';
  }
  if (normalized === 'spread_unavailable') {
    return 'spread_unavailable';
  }
  if (
    normalized.includes('spread') ||
    normalized.includes('orderbook') ||
    normalized.includes('order book') ||
    normalized.includes('book unavailable')
  ) {
    return 'spread_unavailable';
  }

  return 'provider_degraded';
}

function extractSpreadDiagnostics(market: ParsedCryptoMarket): SpreadDiagnosticsView {
  const raw = market.rawPayload?.clobSpreadDiagnostic;
  if (!raw || typeof raw !== 'object') {
    return {
      status: 'missing',
      bestBidBps: null,
      bestAskBps: null,
      midpointBps: null,
      spreadBps: null,
      liquidityUsd: null,
      reason: 'missing'
    };
  }

  const maybe = raw as Record<string, unknown>;
  const status =
    maybe.status === 'available'
      ? 'available'
      : maybe.status === 'missing'
        ? 'missing'
        : 'degraded';

  return {
    status,
    bestBidBps: typeof maybe.bestBidBps === 'number' ? maybe.bestBidBps : null,
    bestAskBps: typeof maybe.bestAskBps === 'number' ? maybe.bestAskBps : null,
    midpointBps: typeof maybe.midpointBps === 'number' ? maybe.midpointBps : null,
    spreadBps: typeof maybe.spreadBps === 'number' ? maybe.spreadBps : null,
    liquidityUsd: typeof maybe.liquidityUsd === 'number' ? maybe.liquidityUsd : null,
    reason: sanitizeSpreadDiagnosticsReason(maybe.reason, status)
  };
}

function normalizeDriverLabel(flag: string | null): string {
  if (!flag) {
    return 'balanced_signal_mix';
  }

  if (flag === 'volatility_regime_high') {
    return 'high_volatility';
  }

  if (flag === 'momentum_upside') {
    return 'momentum_upside';
  }

  return flag;
}

function accountabilityStatus(signals: AgentSignal[]): MarketIntelligenceItem['accountabilityStatus'] {
  if (signals.some((signal) => signal.resolution)) {
    return 'resolved';
  }

  if (signals.some((signal) => Boolean(signal.arcTxHash))) {
    return 'committed';
  }

  if (signals.length > 0) {
    return 'generated';
  }

  return 'untracked';
}

function latestSignalTimestamp(latestSignal: AgentSignal | null, latestScanAt: string | null): string | null {
  return latestSignal?.updatedAt ?? latestSignal?.createdAt ?? latestScanAt;
}

function buildDataHealthScore(
  market: ParsedCryptoMarket,
  state: ArenaState,
  latestSignal: AgentSignal | null,
  spreadDiagnostics: SpreadDiagnosticsView,
  nowIso: string
): { score: number; flags: string[] } {
  const flags: string[] = [];
  let score = 10_000;
  const nowMs = safeDateMs(nowIso) ?? Date.now();

  const scanMs = safeDateMs(state.latestScan?.scannedAt);
  if (scanMs === null || nowMs - scanMs > 30 * 60 * 1000) {
    score -= 1_500;
    flags.push('market_scan_stale');
  }

  const priceMs = safeDateMs(latestSignalTimestamp(latestSignal, state.latestScan?.scannedAt ?? null));
  if (priceMs === null || nowMs - priceMs > 60 * 60 * 1000) {
    score -= 2_000;
    flags.push('price_snapshot_stale');
  }

  const signalMs = safeDateMs(latestSignal?.createdAt);
  if (signalMs === null || nowMs - signalMs > 24 * 60 * 60 * 1000) {
    score -= 1_500;
    flags.push('signal_stale');
  }

  if (spreadDiagnostics.status !== 'available') {
    score -= 500;
    flags.push('spread_diagnostics_missing');
  }

  if (market.source === 'demo_snapshot') {
    score -= 500;
    flags.push('demo_snapshot_source');
  }

  return {
    score: clamp(score, 0, 10_000),
    flags
  };
}

function computeRiskScore(
  market: ParsedCryptoMarket,
  bestSignal: AgentSignal | null,
  dataHealthScoreBps: number,
  spreadDiagnostics: SpreadDiagnosticsView
): number {
  const liquidityRisk = clamp(10_000 - Math.round((market.liquidity / 500_000) * 10_000), 0, 10_000);
  const spreadRisk =
    spreadDiagnostics.spreadBps === null
      ? 2_500
      : clamp(spreadDiagnostics.spreadBps * 20, 0, 10_000);
  const staleRisk = clamp(10_000 - dataHealthScoreBps, 0, 10_000);
  const volatilityRisk = bestSignal?.riskFlags.includes('volatility_regime_high')
    ? 2_600
    : bestSignal?.riskFlags.length
      ? 1_800
      : 1_000;
  const sourceRisk = market.source === 'demo_snapshot' ? 5_000 : 0;

  return clamp(
    Math.round(
      0.3 * liquidityRisk +
        0.25 * spreadRisk +
        0.2 * staleRisk +
        0.15 * volatilityRisk +
        0.1 * sourceRisk
    ),
    0,
    10_000
  );
}

function computeTimeToExpiryScore(nowIso: string, expiresAt: string): number {
  const daysRemaining = diffDays(nowIso, expiresAt);
  if (daysRemaining <= 3) {
    return 10_000;
  }
  if (daysRemaining >= 21) {
    return 0;
  }

  return clamp(Math.round(((21 - daysRemaining) / 18) * 10_000), 0, 10_000);
}

function computeOpportunityScore(
  market: ParsedCryptoMarket,
  bestSignal: AgentSignal | null,
  dataHealthScoreBps: number,
  nowIso: string
): number {
  const bestEdgeBps = Math.abs(bestSignal?.edgeBps ?? 0);
  const edgeScore = clamp(Math.round((Math.min(bestEdgeBps, 2_500) / 2_500) * 10_000), 0, 10_000);
  const uncertaintyScore = clamp(10_000 - Math.abs(market.yesPriceBps - 5_000) * 2, 0, 10_000);
  const liquidityScore = clamp(Math.round((market.liquidity / 500_000) * 10_000), 0, 10_000);
  const timeToExpiryScore = computeTimeToExpiryScore(nowIso, market.expiresAt);

  return clamp(
    Math.round(
      0.35 * edgeScore +
        0.2 * uncertaintyScore +
        0.15 * liquidityScore +
        0.15 * timeToExpiryScore +
        0.15 * dataHealthScoreBps
    ),
    0,
    10_000
  );
}

function buildMarketSummary(
  market: ParsedCryptoMarket,
  bestSignal: AgentSignal | null,
  opportunityScoreBps: number,
  dataHealthScoreBps: number,
  riskFlags: string[],
  accountability: MarketIntelligenceItem['accountabilityStatus']
): string {
  const bestProbability = bestSignal?.agentProbabilityBps ?? market.yesPriceBps;
  const bestEdge = bestSignal?.edgeBps ?? 0;
  const driver = normalizeDriverLabel(bestSignal?.riskFlags[0] ?? null);
  const topRisk = riskFlags[0] ?? 'balanced_data';

  return `${market.asset} ${market.conditionType} implied ${market.yesPriceBps} bps vs ${
    bestSignal?.agentName ?? 'market'
  } ${bestProbability} bps, edge ${bestEdge} bps, research priority ${opportunityScoreBps}, driver ${driver}, top risk ${topRisk}, data health ${dataHealthScoreBps}, accountability ${accountability}.`;
}

function buildMarketItem(
  state: ArenaState,
  market: ParsedCryptoMarket,
  nowIso: string
): MarketIntelligenceItem {
  const signalContext = signalContextForMarket(state, market.id);
  const agentViews = signalContext.relatedSignals.map(toAgentView);
  const spreadDiagnostics = extractSpreadDiagnostics(market);
  const health = buildDataHealthScore(
    market,
    state,
    signalContext.latestSignal,
    spreadDiagnostics,
    nowIso
  );
  const combinedRiskFlags = Array.from(
    new Set([
      ...health.flags,
      ...signalContext.bestSignal?.riskFlags ?? []
    ])
  );
  const accountability = accountabilityStatus(signalContext.relatedSignals);
  const opportunityScoreBps = computeOpportunityScore(
    market,
    signalContext.bestSignal,
    health.score,
    nowIso
  );
  const riskScoreBps = computeRiskScore(
    market,
    signalContext.bestSignal,
    health.score,
    spreadDiagnostics
  );
  const timeToExpiryHours = Math.max(0, Math.round(diffHours(nowIso, market.expiresAt)));
  const freshnessStatus = health.flags.some((flag) =>
    flag === 'market_scan_stale' || flag === 'price_snapshot_stale' || flag === 'signal_stale'
  )
    ? 'stale'
    : health.flags.length > 0
      ? 'degraded'
      : 'fresh';

  return {
    marketId: market.id,
    question: market.question,
    asset: market.asset,
    conditionType: market.conditionType,
    thresholdUsd: market.thresholdUsd,
    expiresAt: market.expiresAt,
    source: market.source,
    marketUrl: market.url,
    yesPriceBps: market.yesPriceBps,
    noPriceBps: market.noPriceBps,
    impliedProbabilityBps: market.yesPriceBps,
    liquidity: market.liquidity,
    volume: market.volume,
    freshnessStatus,
    timeToExpiryHours,
    bestAgent: signalContext.bestSignal ? toAgentView(signalContext.bestSignal) : null,
    agentViews,
    dataHealthScoreBps: health.score,
    opportunityScoreBps,
    riskScoreBps,
    riskFlags: combinedRiskFlags,
    spreadDiagnostics,
    accountabilityStatus: accountability,
    summary: buildMarketSummary(
      market,
      signalContext.bestSignal,
      opportunityScoreBps,
      health.score,
      combinedRiskFlags,
      accountability
    )
  };
}

function marketMatchesFilters(item: MarketIntelligenceItem, filters: MarketCatalogFilters): boolean {
  const expiresInDays = item.timeToExpiryHours / 24;
  const confidence = item.bestAgent?.confidence ?? null;
  const edgeBps = Math.abs(item.bestAgent?.edgeBps ?? 0);

  return (
    (filters.asset === 'all' || item.asset === filters.asset) &&
    (filters.conditionType === 'all' || item.conditionType === filters.conditionType) &&
    (filters.confidence === 'all' || confidence === filters.confidence) &&
    (filters.source === 'all' || item.source === filters.source) &&
    edgeBps >= filters.minEdgeBps &&
    expiresInDays <= filters.maxExpiryDays &&
    item.liquidity >= filters.minLiquidity
  );
}

function sortCatalogItems(items: MarketIntelligenceItem[], sort: MarketIntelligenceSort): MarketIntelligenceItem[] {
  return [...items].sort((left, right) => {
    switch (sort) {
      case 'edge_desc':
        return Math.abs(right.bestAgent?.edgeBps ?? 0) - Math.abs(left.bestAgent?.edgeBps ?? 0);
      case 'expiry_asc':
        return left.expiresAt.localeCompare(right.expiresAt);
      case 'liquidity_desc':
        return right.liquidity - left.liquidity;
      case 'risk_asc':
        return left.riskScoreBps - right.riskScoreBps;
      case 'data_health_desc':
        return right.dataHealthScoreBps - left.dataHealthScoreBps;
      case 'opportunity_desc':
      default:
        return right.opportunityScoreBps - left.opportunityScoreBps;
    }
  });
}

function signalMatchesCommonFilters(
  signal: AgentSignal,
  filters: Pick<AgentReputationFilters, 'asset' | 'conditionType' | 'confidence'>
): boolean {
  return (
    (filters.asset === 'all' || signal.asset === filters.asset) &&
    (filters.conditionType === 'all' || signal.conditionType === filters.conditionType) &&
    (filters.confidence === 'all' || signal.confidence === filters.confidence)
  );
}

function expiryBucketForSignal(signal: AgentSignal): string {
  const hours = diffHours(signal.createdAt, signal.expiresAt);
  if (hours <= 24) {
    return 'intraday';
  }
  if (hours <= 72) {
    return '1_3d';
  }
  if (hours <= 168) {
    return '4_7d';
  }

  return '8_21d';
}

function edgeBucketForSignal(signal: AgentSignal): string {
  if (signal.edgeBps < 700) {
    return 'avoid_or_subthreshold';
  }
  if (signal.edgeBps < 1_000) {
    return '700_999';
  }
  if (signal.edgeBps < 2_000) {
    return '1000_1999';
  }

  return '2000_plus';
}

function groupValueForSignal(signal: AgentSignal, groupBy: AgentReputationGroupBy): string {
  switch (groupBy) {
    case 'agent':
      return signal.agentName;
    case 'asset':
      return signal.asset;
    case 'conditionType':
      return signal.conditionType;
    case 'expiryBucket':
      return expiryBucketForSignal(signal);
    case 'confidenceBucket':
      return signal.confidence;
    case 'edgeBucket':
      return edgeBucketForSignal(signal);
    default:
      return signal.agentName;
  }
}

function resolvedSignals(signals: AgentSignal[]): AgentSignal[] {
  return signals.filter((signal) => signal.resolution !== null);
}

function txHashesForSignals(signals: AgentSignal[]): Array<`0x${string}`> {
  return Array.from(
    new Set(
      signals
        .map((signal) => signal.arcTxHash)
        .filter((value): value is `0x${string}` => Boolean(value))
    )
  );
}

function sourceMixForSignals(signals: AgentSignal[]): PaperFollowResult['sourceMix'] {
  const sourceMix: PaperFollowResult['sourceMix'] = {
    automatic: 0,
    demo_admin: 0,
    unresolved: 0,
    unknown: 0
  };

  for (const signal of signals) {
    sourceMix[sourceMixKey(signal)] += 1;
  }

  return sourceMix;
}

function researchDrivers(
  item: MarketIntelligenceItem,
  relatedSignals: AgentSignal[]
): SignalResearchView['drivers'] {
  return {
    primary: normalizeDriverLabel(item.bestAgent?.riskFlags[0] ?? null),
    marketRiskFlags: [...item.riskFlags],
    volatilityRiskFlags: unique(
      relatedSignals
        .filter((signal) => signal.agentName === 'volatility')
        .flatMap((signal) => signal.riskFlags)
    ),
    momentumRiskFlags: unique(
      relatedSignals
        .filter((signal) => signal.agentName === 'momentum')
        .flatMap((signal) => signal.riskFlags)
    )
  };
}

function dryRunCountForSignals(state: ArenaState, relatedSignals: AgentSignal[]): number {
  const signalIds = new Set(relatedSignals.map((signal) => signal.id));

  return state.autonomyRuns.reduce((count, run) => {
    return (
      count +
      run.queue.filter(
        (entry) =>
          signalIds.has(entry.signalId) && entry.status === 'dry_run_eligible'
      ).length
    );
  }, 0);
}

function proofStatusForSignals(
  state: ArenaState,
  relatedSignals: AgentSignal[]
): SignalResearchView['accountability']['proofStatus'] {
  const signalIds = new Set(relatedSignals.map((signal) => signal.id));
  if (
    state.ops?.proof.lock?.signalId &&
    signalIds.has(state.ops.proof.lock.signalId)
  ) {
    return 'observed';
  }

  if ((state.ops?.proof.claims ?? []).some((claim) => signalIds.has(claim.signalId))) {
    return 'observed';
  }

  return 'not_observed';
}

function weightedRoiBps(
  signals: AgentSignal[],
  stakeModel: PaperFollowStakeModel
): { roiBps: number; curve: PaperFollowCurvePoint[]; maxDrawdownBps: number } {
  const orderedSignals = [...signals].sort((left, right) => {
    const leftKey = left.resolution?.resolvedAt ?? left.createdAt;
    const rightKey = right.resolution?.resolvedAt ?? right.createdAt;
    return leftKey.localeCompare(rightKey);
  });

  let cumulativeWeight = 0;
  let cumulativeRoi = 0;
  let runningPeak = Number.NEGATIVE_INFINITY;
  let maxDrawdownBps = 0;

  const curve = orderedSignals.map((signal) => {
    const weight = stakeWeightForSignal(signal, stakeModel);
    cumulativeWeight += weight;
    cumulativeRoi += computePaperRoiBps(signal, Boolean(signal.resolution?.outcomeCorrect)) * weight;
    const cumulativeRoiBps =
      cumulativeWeight === 0 ? 0 : Math.round(cumulativeRoi / cumulativeWeight);
    runningPeak = Math.max(runningPeak, cumulativeRoiBps);
    maxDrawdownBps = Math.max(maxDrawdownBps, runningPeak - cumulativeRoiBps);

    return {
      signalId: signal.id,
      resolvedAt: signal.resolution?.resolvedAt ?? signal.createdAt,
      cumulativeRoiBps
    };
  });

  return {
    roiBps: curve.length === 0 ? 0 : curve[curve.length - 1].cumulativeRoiBps,
    curve,
    maxDrawdownBps
  };
}

function confidenceWeight(confidence: ConfidenceLabel): number {
  switch (confidence) {
    case 'LOW':
      return 1;
    case 'MEDIUM':
      return 3;
    case 'HIGH':
      return 5;
    default:
      return 1;
  }
}

function stakeWeightForSignal(signal: AgentSignal, stakeModel: PaperFollowStakeModel): number {
  switch (stakeModel) {
    case 'flat_1_usdc':
      return 1;
    case 'confidence_weighted':
      return confidenceWeight(signal.confidence);
    case 'signal_stake':
    default:
      return Math.max(signal.stakeMicroUsdc, 1);
  }
}

function sourceMixKey(signal: AgentSignal): keyof PaperFollowResult['sourceMix'] {
  if (!signal.resolution) {
    return 'unresolved';
  }
  if (signal.resolution.source === 'automatic') {
    return 'automatic';
  }
  if (signal.resolution.source === 'demo_admin') {
    return 'demo_admin';
  }

  return 'unknown';
}

function pushCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

function breakdownRows(
  signals: AgentSignal[],
  stakeModel: PaperFollowStakeModel,
  keySelector: (signal: AgentSignal) => string
): PaperFollowBreakdownRow[] {
  const groups = new Map<string, AgentSignal[]>();
  for (const signal of signals) {
    const key = keySelector(signal);
    const existing = groups.get(key) ?? [];
    existing.push(signal);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .map(([key, groupSignals]) => {
      const resolvedGroupSignals = resolvedSignals(groupSignals);
      return {
        key,
        includedCount: groupSignals.length,
        resolvedCount: resolvedGroupSignals.length,
        paperRoiBps: weightedRoiBps(resolvedGroupSignals, stakeModel).roiBps
      };
    })
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function buildMarketIntelligenceCatalog(
  state: ArenaState,
  filters: MarketCatalogFilters,
  nowIso: string
): MarketIntelligenceCatalog {
  const items = state.markets
    .map((market) => buildMarketItem(state, market, nowIso))
    .filter((item) => marketMatchesFilters(item, filters));

  return {
    filters,
    freshness: {
      latestScanAt: state.latestScan?.scannedAt ?? null,
      marketCount: state.latestScan?.marketCount ?? state.markets.length
    },
    items: sortCatalogItems(items, filters.sort).slice(0, filters.limit)
  };
}

export function buildSignalResearchView(
  state: ArenaState,
  target: { marketId?: string | null; signalId?: string | null },
  nowIso: string
): SignalResearchView | null {
  const targetSignal = target.signalId
    ? state.signals.find((signal) => signal.id === target.signalId) ?? null
    : null;
  const marketId = targetSignal?.marketId ?? target.marketId ?? null;
  if (!marketId) {
    return null;
  }

  const market = state.markets.find((entry) => entry.id === marketId) ?? null;
  if (!market) {
    return null;
  }

  const item = buildMarketItem(state, market, nowIso);
  const relatedSignals = signalContextForMarket(state, market.id).relatedSignals;
  const resolvedRelatedSignals = resolvedSignals(relatedSignals);
  const correctCount = resolvedRelatedSignals.filter(
    (signal) => signal.resolution?.outcomeCorrect
  ).length;
  const dryRunCount = dryRunCountForSignals(state, relatedSignals);

  return {
    target: {
      signalId: targetSignal?.id ?? null,
      marketId: market.id
    },
    market: {
      marketId: market.id,
      question: market.question,
      asset: market.asset,
      conditionType: market.conditionType,
      thresholdUsd: market.thresholdUsd,
      expiresAt: market.expiresAt,
      impliedProbabilityBps: market.yesPriceBps,
      liquidity: market.liquidity,
      volume: market.volume,
      source: market.source,
      scoutScoreBps: market.scoutScoreBps,
      parseConfidence: market.parseConfidence
    },
    agentViews: item.agentViews,
    spreadDiagnostics: item.spreadDiagnostics,
    drivers: researchDrivers(item, relatedSignals),
    accountability: {
      status: item.accountabilityStatus,
      dryRunCount,
      dryRunPresent: dryRunCount > 0,
      resolvedCount: resolvedRelatedSignals.length,
      committedCount: relatedSignals.filter((signal) => Boolean(signal.arcTxHash)).length,
      txHashes: txHashesForSignals(relatedSignals),
      resolutionSourceMix: sourceMixForSignals(relatedSignals),
      proofStatus: proofStatusForSignals(state, relatedSignals)
    },
    comparableOutcomes: {
      resolvedCount: resolvedRelatedSignals.length,
      accuracyBps:
        resolvedRelatedSignals.length === 0
          ? 0
          : Math.round((correctCount / resolvedRelatedSignals.length) * 10_000),
      averageEdgeBps: average(relatedSignals.map((signal) => signal.edgeBps))
    },
    summary: `${item.summary} Comparable resolved count ${resolvedRelatedSignals.length}.`
  };
}

export function buildSegmentedAgentReputation(
  state: ArenaState,
  filters: AgentReputationFilters
): SegmentedAgentReputationRow[] {
  const filteredSignals = state.signals.filter((signal) => signalMatchesCommonFilters(signal, filters));
  const groups = new Map<string, AgentSignal[]>();

  for (const signal of filteredSignals) {
    const groupValue = groupValueForSignal(signal, filters.groupBy);
    const key = `${signal.agentName}:${groupValue}`;
    const existing = groups.get(key) ?? [];
    existing.push(signal);
    groups.set(key, existing);
  }

  return [...groups.entries()]
    .map(([key, signals]) => {
      const [agentName, groupValue] = key.split(':');
      const resolvedGroupSignals = resolvedSignals(signals);
      const correctSignals = resolvedGroupSignals.filter((signal) => signal.resolution?.outcomeCorrect);
      const brierValues = resolvedGroupSignals
        .map((signal) => signal.resolution?.yesOutcome)
        .map((yesOutcome, index) =>
          yesOutcome === undefined ? null : computeBrierScoreBps(resolvedGroupSignals[index], yesOutcome)
        )
        .filter((value): value is number => value !== null);

      return {
        agentName: agentName as AgentSignal['agentName'],
        groupBy: filters.groupBy,
        groupValue,
        generatedCount: signals.length,
        committedCount: signals.filter((signal) => Boolean(signal.arcTxHash)).length,
        resolvedCount: resolvedGroupSignals.length,
        accuracyBps:
          resolvedGroupSignals.length === 0
            ? 0
            : Math.round((correctSignals.length / resolvedGroupSignals.length) * 10_000),
        brierScoreBps: brierValues.length === 0 ? null : average(brierValues),
        averageEdgeBps: average(signals.map((signal) => signal.edgeBps)),
        paperRoiBps: average(
          resolvedGroupSignals.map((signal) =>
            computePaperRoiBps(signal, Boolean(signal.resolution?.outcomeCorrect))
          )
        ),
        bondedMicroUsdc: signals
          .filter((signal) => Boolean(signal.arcTxHash))
          .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0),
        refundedMicroUsdc: correctSignals.reduce(
          (sum, signal) => sum + signal.stakeMicroUsdc,
          0
        ),
        slashedMicroUsdc: resolvedGroupSignals
          .filter((signal) => !signal.resolution?.outcomeCorrect)
          .reduce((sum, signal) => sum + signal.stakeMicroUsdc, 0),
        insufficientData: resolvedGroupSignals.length < filters.minResolved
      };
    })
    .sort((left, right) => {
      const agentDiff = left.agentName.localeCompare(right.agentName);
      if (agentDiff !== 0) {
        return agentDiff;
      }

      return left.groupValue.localeCompare(right.groupValue);
    });
}

export function buildPaperFollowResult(
  state: ArenaState,
  filters: PaperFollowFilters,
  _nowIso: string
): PaperFollowResult {
  const includedSignals: AgentSignal[] = [];
  const skippedReasonCounts: Record<string, number> = {};

  const fromMs = safeDateMs(filters.from);
  const toMs = safeDateMs(filters.to);

  for (const signal of [...state.signals].sort((left, right) => left.createdAt.localeCompare(right.createdAt))) {
    if (filters.agentName !== 'all' && signal.agentName !== filters.agentName) {
      pushCount(skippedReasonCounts, 'agent_filtered');
      continue;
    }
    if (signal.side === 'AVOID') {
      pushCount(skippedReasonCounts, 'avoid_signal');
      continue;
    }
    if (signal.edgeBps < filters.minEdgeBps) {
      pushCount(skippedReasonCounts, 'below_min_edge');
      continue;
    }
    if (filters.confidence !== 'all' && signal.confidence !== filters.confidence) {
      pushCount(skippedReasonCounts, 'confidence_filtered');
      continue;
    }
    if (filters.asset !== 'all' && signal.asset !== filters.asset) {
      pushCount(skippedReasonCounts, 'asset_filtered');
      continue;
    }
    if (filters.conditionType !== 'all' && signal.conditionType !== filters.conditionType) {
      pushCount(skippedReasonCounts, 'condition_type_filtered');
      continue;
    }

    const createdMs = safeDateMs(signal.createdAt);
    if (fromMs !== null && createdMs !== null && createdMs < fromMs) {
      pushCount(skippedReasonCounts, 'before_from');
      continue;
    }
    if (toMs !== null && createdMs !== null && createdMs > toMs) {
      pushCount(skippedReasonCounts, 'after_to');
      continue;
    }

    includedSignals.push(signal);
  }

  const resolvedIncludedSignals = resolvedSignals(includedSignals);
  const unresolvedCount = includedSignals.length - resolvedIncludedSignals.length;
  const brierValues = resolvedIncludedSignals
    .map((signal) => signal.resolution?.yesOutcome)
    .map((yesOutcome, index) =>
      yesOutcome === undefined ? null : computeBrierScoreBps(resolvedIncludedSignals[index], yesOutcome)
    )
    .filter((value): value is number => value !== null);
  const roi = weightedRoiBps(resolvedIncludedSignals, filters.stakeModel);

  const sourceMix: PaperFollowResult['sourceMix'] = {
    automatic: 0,
    demo_admin: 0,
    unresolved: 0,
    unknown: 0
  };
  for (const signal of includedSignals) {
    sourceMix[sourceMixKey(signal)] += 1;
  }

  return {
    assumptions: filters,
    includedCount: includedSignals.length,
    resolvedCount: resolvedIncludedSignals.length,
    unresolvedCount,
    skippedCount: Object.values(skippedReasonCounts).reduce((sum, value) => sum + value, 0),
    wins: resolvedIncludedSignals.filter((signal) => signal.resolution?.outcomeCorrect).length,
    losses: resolvedIncludedSignals.filter((signal) => !signal.resolution?.outcomeCorrect).length,
    averageEdgeBps: average(includedSignals.map((signal) => signal.edgeBps)),
    hitRateBps:
      resolvedIncludedSignals.length === 0
        ? 0
        : Math.round(
            (resolvedIncludedSignals.filter((signal) => signal.resolution?.outcomeCorrect).length /
              resolvedIncludedSignals.length) *
              10_000
          ),
    paperRoiBps: roi.roiBps,
    brierScoreBps: brierValues.length === 0 ? null : average(brierValues),
    maxDrawdownBps: roi.maxDrawdownBps,
    insufficientData: resolvedIncludedSignals.length < 3,
    sourceMix,
    skippedReasonCounts,
    curve: roi.curve,
    breakdownByAsset: breakdownRows(includedSignals, filters.stakeModel, (signal) => signal.asset),
    breakdownByConditionType: breakdownRows(
      includedSignals,
      filters.stakeModel,
      (signal) => signal.conditionType
    )
  };
}
