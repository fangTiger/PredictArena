import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  buildMarketIntelligenceCatalog,
  type MarketCatalogFilters,
  type MarketIntelligenceItem
} from '@/lib/intelligence/readModels';
import type { ArenaState } from '@/lib/persistence/store';

export const SAVED_FILTER_LIMIT = 20;
export const WATCHLIST_LIMIT = 100;
export const ALERT_LIMIT = 200;
export const DAILY_QUEUE_PREVIEW_LIMIT = 10;

export const savedWorkspaceAssetValues = ['BTC', 'ETH', 'SOL', 'all'] as const;
export const savedWorkspaceConditionTypeValues = [
  'EXPIRY_ABOVE',
  'EXPIRY_BELOW',
  'TOUCH_ABOVE',
  'TOUCH_BELOW',
  'all'
] as const;
export const savedWorkspaceConfidenceValues = ['LOW', 'MEDIUM', 'HIGH', 'all'] as const;
export const savedWorkspaceSourceValues = ['live', 'demo_snapshot', 'all'] as const;
export const savedWorkspaceSortValues = [
  'opportunity_desc',
  'edge_desc',
  'expiry_asc',
  'liquidity_desc',
  'risk_asc',
  'data_health_desc'
] as const;
export const alertReasonCodeValues = [
  'new_high_priority_market',
  'edge_changed',
  'agent_disagreement_changed',
  'data_health_degraded',
  'near_expiry'
] as const;
export const alertSeverityValues = ['info', 'watch', 'urgent'] as const;
export const savedIntelligenceFreshnessValues = [
  'never_evaluated',
  'fresh',
  'stale',
  'failed'
] as const;

export type SavedIntelligenceFreshness = (typeof savedIntelligenceFreshnessValues)[number];
export type IntelligenceAlertReasonCode = (typeof alertReasonCodeValues)[number];
export type IntelligenceAlertSeverity = (typeof alertSeverityValues)[number];

const workspaceIdRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function trimmedOptionalString(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (value === null || value === undefined) {
        return null;
      }

      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    },
    z.string().max(maxLength).nullable()
  );
}

export const workspaceIdSchema = z
  .string()
  .min(1)
  .max(120)
  .regex(workspaceIdRegex, 'workspaceId must be a UUID');

export const savedFilterThresholdsSchema = z.object({
  minOpportunityScoreBps: z.number().int().min(0).max(10_000).default(0),
  minDataHealthScoreBps: z.number().int().min(0).max(10_000).default(0),
  edgeChangeThresholdBps: z.number().int().min(100).max(5_000).default(500),
  disagreementChangeThresholdBps: z.number().int().min(100).max(5_000).default(500),
  dataHealthDropThresholdBps: z.number().int().min(100).max(5_000).default(1_500),
  nearExpiryHours: z.number().int().min(1).max(168).default(24)
});

export type SavedFilterThresholds = z.infer<typeof savedFilterThresholdsSchema>;

export const defaultSavedFilterThresholds: SavedFilterThresholds =
  savedFilterThresholdsSchema.parse({});

export const savedFilterQuerySchema = z.object({
  asset: z.enum(savedWorkspaceAssetValues),
  conditionType: z.enum(savedWorkspaceConditionTypeValues),
  confidence: z.enum(savedWorkspaceConfidenceValues),
  source: z.enum(savedWorkspaceSourceValues),
  sort: z.enum(savedWorkspaceSortValues),
  minEdgeBps: z.number().int().min(0).max(5_000),
  maxExpiryDays: z.number().int().min(1).max(21),
  minLiquidity: z.number().min(0),
  minOpportunityScoreBps: z.number().int().min(0).max(10_000).default(0),
  minDataHealthScoreBps: z.number().int().min(0).max(10_000).default(0)
});

export type SavedFilterQuery = z.infer<typeof savedFilterQuerySchema>;

export interface SavedFilterEvaluationSnapshot {
  matchedCount: number;
  topMarketIds: string[];
  topOpportunityScoreBps: number;
  topEdgeBps: number;
  topDataHealthScoreBps: number;
  topProbabilityGapBps: number;
  evaluatedAt: string;
  freshness: SavedIntelligenceFreshness;
  failureReason: 'evaluation_failed' | null;
}

export interface SavedIntelligenceFilter {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  query: SavedFilterQuery;
  thresholds: SavedFilterThresholds;
  latestEvaluation: SavedFilterEvaluationSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchedMarketSnapshot {
  marketId: string;
  opportunityScoreBps: number;
  edgeBps: number;
  probabilityGapBps: number;
  dataHealthScoreBps: number;
  timeToExpiryHours: number;
  freshnessStatus: MarketIntelligenceItem['freshnessStatus'];
  evaluatedAt: string;
}

export interface WatchedMarketEntry {
  id: string;
  workspaceId: string;
  marketId: string;
  asset: 'BTC' | 'ETH' | 'SOL';
  question: string;
  conditionType: Exclude<(typeof savedWorkspaceConditionTypeValues)[number], 'all'>;
  source: Exclude<(typeof savedWorkspaceSourceValues)[number], 'all'>;
  marketUrl: string | null;
  expiresAt: string;
  label: string | null;
  note: string | null;
  supportStatus: 'supported' | 'degraded' | 'missing';
  degradedReason: 'market_missing' | 'data_degraded' | null;
  latestSnapshot: WatchedMarketSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

export interface AlertMetricSnapshot {
  marketId: string | null;
  opportunityScoreBps: number | null;
  edgeBps: number | null;
  probabilityGapBps: number | null;
  dataHealthScoreBps: number | null;
  timeToExpiryHours: number | null;
  freshnessStatus: MarketIntelligenceItem['freshnessStatus'] | null;
  evaluatedAt: string;
}

export interface IntelligenceAlert {
  id: string;
  workspaceId: string;
  sourceType: 'saved_filter' | 'watchlist';
  sourceId: string;
  sourceLabel: string | null;
  orphaned: boolean;
  marketId: string | null;
  signalIds: string[];
  reasonCode: IntelligenceAlertReasonCode;
  severity: IntelligenceAlertSeverity;
  summary: string;
  previousSnapshot: AlertMetricSnapshot | null;
  currentSnapshot: AlertMetricSnapshot | null;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  dismissedAt: string | null;
}

export interface DailyQueueItem {
  marketId: string;
  question: string;
  asset: 'BTC' | 'ETH' | 'SOL';
  conditionType: Exclude<(typeof savedWorkspaceConditionTypeValues)[number], 'all'>;
  expiresAt: string;
  marketUrl: string | null;
  sourceTypes: Array<'saved_filter' | 'watchlist'>;
  reasonCodes: IntelligenceAlertReasonCode[];
  severity: IntelligenceAlertSeverity;
  freshness: SavedIntelligenceFreshness;
  opportunityScoreBps: number | null;
  edgeBps: number | null;
  probabilityGapBps: number | null;
  dataHealthScoreBps: number | null;
  timeToExpiryHours: number | null;
  unreadAlertCount: number;
  alertIds: string[];
  summary: string;
}

export interface SavedIntelligenceWorkspaceState {
  savedFilters: SavedIntelligenceFilter[];
  watchlist: WatchedMarketEntry[];
  alerts: IntelligenceAlert[];
  freshness: SavedIntelligenceFreshness;
  lastEvaluatedAt: string | null;
  lastSuccessfulEvaluatedAt: string | null;
  failureReason: 'evaluation_failed' | null;
}

export type SavedIntelligenceWorkspaceMap = Record<string, SavedIntelligenceWorkspaceState>;

export interface SavedIntelligenceEvaluationResult {
  workspaceId: string;
  freshness: SavedIntelligenceFreshness;
  evaluatedAt: string;
  createdAlertCount: number;
  suppressedDuplicateCount: number;
  updatedSnapshotCount: number;
  failureReason: 'evaluation_failed' | null;
}

export const workspaceQuerySchema = z.object({
  workspaceId: workspaceIdSchema
});

export const workspaceMutationBodySchema = z.object({
  workspaceId: workspaceIdSchema
});

export const savedFilterCreateBodySchema = z.object({
  workspaceId: workspaceIdSchema,
  name: z.string().trim().min(1).max(80),
  query: z.object({
    asset: z.enum(savedWorkspaceAssetValues),
    conditionType: z.enum(savedWorkspaceConditionTypeValues),
    confidence: z.enum(savedWorkspaceConfidenceValues),
    source: z.enum(savedWorkspaceSourceValues),
    sort: z.enum(savedWorkspaceSortValues),
    minEdgeBps: z.coerce.number().int().min(0).max(5_000),
    maxExpiryDays: z.coerce.number().int().min(1).max(21),
    minLiquidity: z.coerce.number().min(0),
    minOpportunityScoreBps: z.coerce.number().int().min(0).max(10_000).default(0),
    minDataHealthScoreBps: z.coerce.number().int().min(0).max(10_000).default(0)
  }),
  thresholds: z
    .object({
      minOpportunityScoreBps: z.coerce.number().int().min(0).max(10_000).optional(),
      minDataHealthScoreBps: z.coerce.number().int().min(0).max(10_000).optional(),
      edgeChangeThresholdBps: z.coerce.number().int().min(100).max(5_000).optional(),
      disagreementChangeThresholdBps: z.coerce.number().int().min(100).max(5_000).optional(),
      dataHealthDropThresholdBps: z.coerce.number().int().min(100).max(5_000).optional(),
      nearExpiryHours: z.coerce.number().int().min(1).max(168).optional()
    })
    .optional(),
  enabled: z.boolean().optional()
});

export const savedFilterPatchBodySchema = z
  .object({
    workspaceId: workspaceIdSchema,
    name: z.string().trim().min(1).max(80).optional(),
    query: z
      .object({
        asset: z.enum(savedWorkspaceAssetValues).optional(),
        conditionType: z.enum(savedWorkspaceConditionTypeValues).optional(),
        confidence: z.enum(savedWorkspaceConfidenceValues).optional(),
        source: z.enum(savedWorkspaceSourceValues).optional(),
        sort: z.enum(savedWorkspaceSortValues).optional(),
        minEdgeBps: z.coerce.number().int().min(0).max(5_000).optional(),
        maxExpiryDays: z.coerce.number().int().min(1).max(21).optional(),
        minLiquidity: z.coerce.number().min(0).optional(),
        minOpportunityScoreBps: z.coerce.number().int().min(0).max(10_000).optional(),
        minDataHealthScoreBps: z.coerce.number().int().min(0).max(10_000).optional()
      })
      .optional(),
    thresholds: z
      .object({
        minOpportunityScoreBps: z.coerce.number().int().min(0).max(10_000).optional(),
        minDataHealthScoreBps: z.coerce.number().int().min(0).max(10_000).optional(),
        edgeChangeThresholdBps: z.coerce.number().int().min(100).max(5_000).optional(),
        disagreementChangeThresholdBps: z.coerce.number().int().min(100).max(5_000).optional(),
        dataHealthDropThresholdBps: z.coerce.number().int().min(100).max(5_000).optional(),
        nearExpiryHours: z.coerce.number().int().min(1).max(168).optional()
      })
      .optional(),
    enabled: z.boolean().optional()
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.query !== undefined ||
      value.thresholds !== undefined ||
      value.enabled !== undefined,
    {
      message: 'At least one mutable field is required',
      path: ['workspaceId']
    }
  );

export const watchlistCreateBodySchema = z.object({
  workspaceId: workspaceIdSchema,
  marketId: z.string().trim().min(1).max(160),
  label: trimmedOptionalString(160).optional(),
  note: trimmedOptionalString(160).optional()
});

export const alertsQuerySchema = z.object({
  workspaceId: workspaceIdSchema,
  unread: z.enum(['true', 'false']).optional(),
  reason: z.enum(alertReasonCodeValues).optional(),
  severity: z.enum(alertSeverityValues).optional()
});

export const alertPatchBodySchema = z.object({
  workspaceId: workspaceIdSchema,
  state: z.enum(['read', 'unread', 'dismissed'])
});

function cloneThresholds(input: SavedFilterThresholds | undefined): SavedFilterThresholds {
  return {
    minOpportunityScoreBps: input?.minOpportunityScoreBps ?? defaultSavedFilterThresholds.minOpportunityScoreBps,
    minDataHealthScoreBps: input?.minDataHealthScoreBps ?? defaultSavedFilterThresholds.minDataHealthScoreBps,
    edgeChangeThresholdBps: input?.edgeChangeThresholdBps ?? defaultSavedFilterThresholds.edgeChangeThresholdBps,
    disagreementChangeThresholdBps:
      input?.disagreementChangeThresholdBps ??
      defaultSavedFilterThresholds.disagreementChangeThresholdBps,
    dataHealthDropThresholdBps:
      input?.dataHealthDropThresholdBps ?? defaultSavedFilterThresholds.dataHealthDropThresholdBps,
    nearExpiryHours: input?.nearExpiryHours ?? defaultSavedFilterThresholds.nearExpiryHours
  };
}

function cloneQuery(input: SavedFilterQuery): SavedFilterQuery {
  return {
    asset: input.asset,
    conditionType: input.conditionType,
    confidence: input.confidence,
    source: input.source,
    sort: input.sort,
    minEdgeBps: input.minEdgeBps,
    maxExpiryDays: input.maxExpiryDays,
    minLiquidity: input.minLiquidity,
    minOpportunityScoreBps: input.minOpportunityScoreBps,
    minDataHealthScoreBps: input.minDataHealthScoreBps
  };
}

function normalizeFilter(filter: SavedIntelligenceFilter): SavedIntelligenceFilter {
  return {
    ...filter,
    query: cloneQuery(savedFilterQuerySchema.parse(filter.query)),
    thresholds: cloneThresholds(savedFilterThresholdsSchema.parse(filter.thresholds)),
    latestEvaluation: filter.latestEvaluation
      ? {
          ...filter.latestEvaluation,
          topMarketIds: [...filter.latestEvaluation.topMarketIds]
        }
      : null
  };
}

function normalizeWatch(entry: WatchedMarketEntry): WatchedMarketEntry {
  return {
    ...entry,
    label: entry.label ?? null,
    note: entry.note ?? null,
    degradedReason: entry.degradedReason ?? null,
    latestSnapshot: entry.latestSnapshot ? { ...entry.latestSnapshot } : null
  };
}

function normalizeAlert(alert: IntelligenceAlert): IntelligenceAlert {
  return {
    ...alert,
    signalIds: [...alert.signalIds],
    previousSnapshot: alert.previousSnapshot ? { ...alert.previousSnapshot } : null,
    currentSnapshot: alert.currentSnapshot ? { ...alert.currentSnapshot } : null,
    readAt: alert.readAt ?? null,
    dismissedAt: alert.dismissedAt ?? null,
    sourceLabel: alert.sourceLabel ?? null,
    orphaned: alert.orphaned ?? false
  };
}

export function createEmptySavedIntelligenceWorkspaceState(): SavedIntelligenceWorkspaceState {
  return {
    savedFilters: [],
    watchlist: [],
    alerts: [],
    freshness: 'never_evaluated',
    lastEvaluatedAt: null,
    lastSuccessfulEvaluatedAt: null,
    failureReason: null
  };
}

export function normalizeSavedIntelligenceWorkspaceState(
  _workspaceId: string,
  state: Partial<SavedIntelligenceWorkspaceState> | null | undefined
): SavedIntelligenceWorkspaceState {
  return {
    ...createEmptySavedIntelligenceWorkspaceState(),
    ...state,
    savedFilters: [...(state?.savedFilters ?? [])].map(normalizeFilter).slice(0, SAVED_FILTER_LIMIT),
    watchlist: [...(state?.watchlist ?? [])].map(normalizeWatch).slice(0, WATCHLIST_LIMIT),
    alerts: sortAlerts([...(state?.alerts ?? [])].map(normalizeAlert)).slice(0, ALERT_LIMIT),
    freshness: state?.freshness ?? 'never_evaluated',
    lastEvaluatedAt: state?.lastEvaluatedAt ?? null,
    lastSuccessfulEvaluatedAt: state?.lastSuccessfulEvaluatedAt ?? null,
    failureReason: state?.failureReason ?? null
  };
}

export function normalizeSavedIntelligenceStateMap(
  input: Record<string, SavedIntelligenceWorkspaceState> | null | undefined
): SavedIntelligenceWorkspaceMap {
  const normalized: SavedIntelligenceWorkspaceMap = {};

  for (const [workspaceId, state] of Object.entries(input ?? {})) {
    if (!workspaceIdSchema.safeParse(workspaceId).success) {
      continue;
    }

    normalized[workspaceId] = normalizeSavedIntelligenceWorkspaceState(workspaceId, state);
  }

  return normalized;
}

export function createSavedIntelligenceId(prefix: 'filter' | 'watch' | 'alert'): string {
  return `${prefix}_${randomUUID()}`;
}

function safeDateMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function diffHours(fromIso: string, toIso: string): number {
  const fromMs = safeDateMs(fromIso);
  const toMs = safeDateMs(toIso);
  if (fromMs === null || toMs === null) {
    return 0;
  }

  return (toMs - fromMs) / 3_600_000;
}

function buildBaseCatalog(state: ArenaState, now: string) {
  const filters: MarketCatalogFilters = {
    asset: 'all',
    conditionType: 'all',
    confidence: 'all',
    source: 'all',
    sort: 'opportunity_desc',
    minEdgeBps: 0,
    maxExpiryDays: 3650,
    minLiquidity: 0,
    limit: Math.max(state.markets.length, 200)
  };

  return buildMarketIntelligenceCatalog(state, filters, now);
}

function baseCatalogByMarketId(state: ArenaState, now: string): Map<string, MarketIntelligenceItem> {
  return new Map(buildBaseCatalog(state, now).items.map((item) => [item.marketId, item] as const));
}

export function findMarketIntelligenceItem(
  state: ArenaState,
  marketId: string,
  now: string
): MarketIntelligenceItem | null {
  return baseCatalogByMarketId(state, now).get(marketId) ?? null;
}

function absoluteEdgeBps(item: MarketIntelligenceItem | null): number {
  return item?.bestAgent ? Math.abs(item.bestAgent.edgeBps) : 0;
}

function probabilityGapBps(item: MarketIntelligenceItem | null): number {
  if (!item?.bestAgent) {
    return 0;
  }

  return Math.abs(item.bestAgent.agentProbabilityBps - item.impliedProbabilityBps);
}

function snapshotFreshnessFromItem(item: MarketIntelligenceItem | null): SavedIntelligenceFreshness {
  if (!item) {
    return 'fresh';
  }

  return item.freshnessStatus === 'fresh' ? 'fresh' : 'stale';
}

function alertSnapshotFromItem(
  item: MarketIntelligenceItem | null,
  evaluatedAt: string
): AlertMetricSnapshot | null {
  if (!item) {
    return null;
  }

  return {
    marketId: item.marketId,
    opportunityScoreBps: item.opportunityScoreBps,
    edgeBps: absoluteEdgeBps(item),
    probabilityGapBps: probabilityGapBps(item),
    dataHealthScoreBps: item.dataHealthScoreBps,
    timeToExpiryHours: item.timeToExpiryHours,
    freshnessStatus: item.freshnessStatus,
    evaluatedAt
  };
}

function alertSnapshotFromFilterEvaluation(
  evaluation: SavedFilterEvaluationSnapshot | null
): AlertMetricSnapshot | null {
  if (!evaluation || evaluation.topMarketIds.length === 0) {
    return null;
  }

  return {
    marketId: evaluation.topMarketIds[0] ?? null,
    opportunityScoreBps: evaluation.topOpportunityScoreBps,
    edgeBps: evaluation.topEdgeBps,
    probabilityGapBps: evaluation.topProbabilityGapBps,
    dataHealthScoreBps: evaluation.topDataHealthScoreBps,
    timeToExpiryHours: null,
    freshnessStatus: evaluation.freshness === 'fresh' ? 'fresh' : 'stale',
    evaluatedAt: evaluation.evaluatedAt
  };
}

function watchSnapshotFromItem(item: MarketIntelligenceItem, evaluatedAt: string): WatchedMarketSnapshot {
  return {
    marketId: item.marketId,
    opportunityScoreBps: item.opportunityScoreBps,
    edgeBps: absoluteEdgeBps(item),
    probabilityGapBps: probabilityGapBps(item),
    dataHealthScoreBps: item.dataHealthScoreBps,
    timeToExpiryHours: item.timeToExpiryHours,
    freshnessStatus: item.freshnessStatus,
    evaluatedAt
  };
}

export function buildWatchedMarketSnapshot(
  item: MarketIntelligenceItem,
  evaluatedAt: string
): WatchedMarketSnapshot {
  return watchSnapshotFromItem(item, evaluatedAt);
}

function severityRank(severity: IntelligenceAlertSeverity): number {
  switch (severity) {
    case 'urgent':
      return 3;
    case 'watch':
      return 2;
    default:
      return 1;
  }
}

function maxSeverity(
  current: IntelligenceAlertSeverity,
  next: IntelligenceAlertSeverity
): IntelligenceAlertSeverity {
  return severityRank(next) > severityRank(current) ? next : current;
}

function severityForAlert(
  reasonCode: IntelligenceAlertReasonCode,
  snapshot: AlertMetricSnapshot | null
): IntelligenceAlertSeverity {
  switch (reasonCode) {
    case 'near_expiry':
      return 'urgent';
    case 'new_high_priority_market':
      return (snapshot?.opportunityScoreBps ?? 0) >= 8_000 ? 'urgent' : 'watch';
    case 'data_health_degraded':
      return (snapshot?.dataHealthScoreBps ?? 10_000) <= 3_500 ? 'urgent' : 'watch';
    case 'edge_changed':
      return (snapshot?.edgeBps ?? 0) >= 2_000 ? 'urgent' : 'watch';
    case 'agent_disagreement_changed':
      return (snapshot?.probabilityGapBps ?? 0) >= 2_000 ? 'urgent' : 'watch';
    default:
      return 'info';
  }
}

function summarizeAlert(
  reasonCode: IntelligenceAlertReasonCode,
  sourceLabel: string,
  snapshot: AlertMetricSnapshot | null
): string {
  switch (reasonCode) {
    case 'new_high_priority_market':
      return `${sourceLabel} surfaced a new high-priority market for review.`;
    case 'edge_changed':
      return `${sourceLabel} edge changed to ${snapshot?.edgeBps ?? 0} bps.`;
    case 'agent_disagreement_changed':
      return `${sourceLabel} disagreement changed to ${snapshot?.probabilityGapBps ?? 0} bps.`;
    case 'data_health_degraded':
      return `${sourceLabel} data health degraded to ${snapshot?.dataHealthScoreBps ?? 0} bps.`;
    case 'near_expiry':
      return `${sourceLabel} is near expiry and should be reviewed soon.`;
  }
}

function alertSignature(alert: IntelligenceAlert): string {
  const snapshot = alert.currentSnapshot;
  return [
    alert.sourceType,
    alert.sourceId,
    alert.reasonCode,
    alert.marketId ?? '',
    snapshot?.opportunityScoreBps ?? '',
    snapshot?.edgeBps ?? '',
    snapshot?.probabilityGapBps ?? '',
    snapshot?.dataHealthScoreBps ?? '',
    snapshot?.timeToExpiryHours ?? '',
    snapshot?.freshnessStatus ?? ''
  ].join('|');
}

function sortAlerts(alerts: IntelligenceAlert[]): IntelligenceAlert[] {
  return [...alerts].sort((left, right) => {
    const severityDiff = severityRank(right.severity) - severityRank(left.severity);
    if (severityDiff !== 0) {
      return severityDiff;
    }

    const createdDiff = right.createdAt.localeCompare(left.createdAt);
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return left.id.localeCompare(right.id);
  });
}

function appendAlert(
  workspaceState: SavedIntelligenceWorkspaceState,
  candidate: IntelligenceAlert
): 'created' | 'duplicate' {
  const duplicate = workspaceState.alerts.find(
    (existing) => existing.dismissedAt === null && alertSignature(existing) === alertSignature(candidate)
  );
  if (duplicate) {
    return 'duplicate';
  }

  workspaceState.alerts = sortAlerts([candidate, ...workspaceState.alerts]).slice(0, ALERT_LIMIT);
  return 'created';
}

function marketSignalsFor(state: ArenaState, marketId: string): string[] {
  return state.signals
    .filter((signal) => signal.marketId === marketId)
    .map((signal) => signal.id)
    .sort((left, right) => left.localeCompare(right));
}

function createAlert(
  workspaceId: string,
  sourceType: 'saved_filter' | 'watchlist',
  sourceId: string,
  sourceLabel: string,
  reasonCode: IntelligenceAlertReasonCode,
  marketId: string | null,
  signalIds: string[],
  previousSnapshot: AlertMetricSnapshot | null,
  currentSnapshot: AlertMetricSnapshot | null,
  now: string
): IntelligenceAlert {
  return {
    id: createSavedIntelligenceId('alert'),
    workspaceId,
    sourceType,
    sourceId,
    sourceLabel,
    orphaned: false,
    marketId,
    signalIds,
    reasonCode,
    severity: severityForAlert(reasonCode, currentSnapshot),
    summary: summarizeAlert(reasonCode, sourceLabel, currentSnapshot),
    previousSnapshot,
    currentSnapshot,
    createdAt: now,
    updatedAt: now,
    readAt: null,
    dismissedAt: null
  };
}

function savedFilterCatalogFilters(query: SavedFilterQuery): MarketCatalogFilters {
  return {
    asset: query.asset,
    conditionType: query.conditionType,
    confidence: query.confidence,
    source: query.source,
    sort: query.sort,
    minEdgeBps: query.minEdgeBps,
    maxExpiryDays: query.maxExpiryDays,
    minLiquidity: query.minLiquidity,
    limit: 50
  };
}

function filterCatalogMatches(
  state: ArenaState,
  filter: SavedIntelligenceFilter,
  now: string
): MarketIntelligenceItem[] {
  const catalog = buildMarketIntelligenceCatalog(state, savedFilterCatalogFilters(filter.query), now);
  return catalog.items.filter(
    (item) =>
      item.opportunityScoreBps >= filter.query.minOpportunityScoreBps &&
      item.dataHealthScoreBps >= filter.query.minDataHealthScoreBps
  );
}

function buildFilterEvaluationSnapshot(
  filter: SavedIntelligenceFilter,
  matches: MarketIntelligenceItem[],
  now: string
): SavedFilterEvaluationSnapshot {
  const top = matches[0] ?? null;
  return {
    matchedCount: matches.length,
    topMarketIds: matches.slice(0, 5).map((item) => item.marketId),
    topOpportunityScoreBps: top?.opportunityScoreBps ?? 0,
    topEdgeBps: absoluteEdgeBps(top),
    topDataHealthScoreBps: top?.dataHealthScoreBps ?? 0,
    topProbabilityGapBps: probabilityGapBps(top),
    evaluatedAt: now,
    freshness: snapshotFreshnessFromItem(top),
    failureReason: null
  };
}

function evaluateSavedFilterAlerts(
  workspaceId: string,
  state: ArenaState,
  workspaceState: SavedIntelligenceWorkspaceState,
  filter: SavedIntelligenceFilter,
  previousEvaluation: SavedFilterEvaluationSnapshot | null,
  currentEvaluation: SavedFilterEvaluationSnapshot,
  currentTopItem: MarketIntelligenceItem | null,
  now: string
): { created: number; suppressed: number } {
  let created = 0;
  let suppressed = 0;

  const currentSnapshot = alertSnapshotFromItem(currentTopItem, now);
  const previousSnapshot = alertSnapshotFromFilterEvaluation(previousEvaluation);
  const signalIds = currentTopItem ? marketSignalsFor(state, currentTopItem.marketId) : [];

  const maybeCreate = (reasonCode: IntelligenceAlertReasonCode) => {
    const status = appendAlert(
      workspaceState,
      createAlert(
        workspaceId,
        'saved_filter',
        filter.id,
        filter.name,
        reasonCode,
        currentTopItem?.marketId ?? currentEvaluation.topMarketIds[0] ?? null,
        signalIds,
        previousSnapshot,
        currentSnapshot,
        now
      )
    );

    if (status === 'created') {
      created += 1;
    } else {
      suppressed += 1;
    }
  };

  if (
    currentTopItem &&
    currentEvaluation.topMarketIds[0] &&
    !previousEvaluation?.topMarketIds.includes(currentEvaluation.topMarketIds[0]) &&
    currentEvaluation.topOpportunityScoreBps >= filter.query.minOpportunityScoreBps &&
    currentEvaluation.topDataHealthScoreBps >= filter.query.minDataHealthScoreBps
  ) {
    maybeCreate('new_high_priority_market');
  }

  if (
    previousEvaluation &&
    currentTopItem &&
    Math.abs(currentEvaluation.topEdgeBps - previousEvaluation.topEdgeBps) >=
      filter.thresholds.edgeChangeThresholdBps
  ) {
    maybeCreate('edge_changed');
  }

  if (
    previousEvaluation &&
    currentTopItem &&
    Math.abs(currentEvaluation.topProbabilityGapBps - previousEvaluation.topProbabilityGapBps) >=
      filter.thresholds.disagreementChangeThresholdBps
  ) {
    maybeCreate('agent_disagreement_changed');
  }

  if (
    currentTopItem &&
    ((previousEvaluation &&
      previousEvaluation.topDataHealthScoreBps - currentEvaluation.topDataHealthScoreBps >=
        filter.thresholds.dataHealthDropThresholdBps) ||
      currentEvaluation.topDataHealthScoreBps < filter.query.minDataHealthScoreBps)
  ) {
    maybeCreate('data_health_degraded');
  }

  return { created, suppressed };
}

function watchSupportStatus(item: MarketIntelligenceItem | null): {
  supportStatus: WatchedMarketEntry['supportStatus'];
  degradedReason: WatchedMarketEntry['degradedReason'];
} {
  if (!item) {
    return {
      supportStatus: 'missing',
      degradedReason: 'market_missing'
    };
  }

  if (item.freshnessStatus !== 'fresh') {
    return {
      supportStatus: 'degraded',
      degradedReason: 'data_degraded'
    };
  }

  return {
    supportStatus: 'supported',
    degradedReason: null
  };
}

function evaluateWatchAlerts(
  workspaceId: string,
  state: ArenaState,
  workspaceState: SavedIntelligenceWorkspaceState,
  watch: WatchedMarketEntry,
  previousSnapshot: WatchedMarketSnapshot | null,
  currentItem: MarketIntelligenceItem | null,
  now: string
): { created: number; suppressed: number } {
  let created = 0;
  let suppressed = 0;

  if (!currentItem) {
    return { created, suppressed };
  }

  const currentSnapshot = alertSnapshotFromItem(currentItem, now);
  const previousAlertSnapshot = previousSnapshot
    ? {
        marketId: previousSnapshot.marketId,
        opportunityScoreBps: previousSnapshot.opportunityScoreBps,
        edgeBps: previousSnapshot.edgeBps,
        probabilityGapBps: previousSnapshot.probabilityGapBps,
        dataHealthScoreBps: previousSnapshot.dataHealthScoreBps,
        timeToExpiryHours: previousSnapshot.timeToExpiryHours,
        freshnessStatus: previousSnapshot.freshnessStatus,
        evaluatedAt: previousSnapshot.evaluatedAt
      }
    : null;
  const signalIds = marketSignalsFor(state, currentItem.marketId);

  const maybeCreate = (reasonCode: IntelligenceAlertReasonCode) => {
    const status = appendAlert(
      workspaceState,
      createAlert(
        workspaceId,
        'watchlist',
        watch.id,
        watch.label ?? watch.question,
        reasonCode,
        currentItem.marketId,
        signalIds,
        previousAlertSnapshot,
        currentSnapshot,
        now
      )
    );

    if (status === 'created') {
      created += 1;
    } else {
      suppressed += 1;
    }
  };

  if (
    previousSnapshot &&
    Math.abs(absoluteEdgeBps(currentItem) - previousSnapshot.edgeBps) >=
      defaultSavedFilterThresholds.edgeChangeThresholdBps
  ) {
    maybeCreate('edge_changed');
  }

  if (
    previousSnapshot &&
    Math.abs(probabilityGapBps(currentItem) - previousSnapshot.probabilityGapBps) >=
      defaultSavedFilterThresholds.disagreementChangeThresholdBps
  ) {
    maybeCreate('agent_disagreement_changed');
  }

  if (
    previousSnapshot &&
    previousSnapshot.dataHealthScoreBps - currentItem.dataHealthScoreBps >=
      defaultSavedFilterThresholds.dataHealthDropThresholdBps
  ) {
    maybeCreate('data_health_degraded');
  }

  if (currentItem.timeToExpiryHours <= defaultSavedFilterThresholds.nearExpiryHours) {
    maybeCreate('near_expiry');
  }

  return { created, suppressed };
}

function derivedWorkspaceFreshness(
  workspaceState: SavedIntelligenceWorkspaceState,
  now: string
): SavedIntelligenceFreshness {
  if (workspaceState.freshness === 'failed') {
    return 'failed';
  }

  if (!workspaceState.lastSuccessfulEvaluatedAt) {
    return 'never_evaluated';
  }

  if (diffHours(workspaceState.lastSuccessfulEvaluatedAt, now) > 24) {
    return 'stale';
  }

  const anyStaleSnapshot =
    workspaceState.savedFilters.some((filter) => filter.latestEvaluation?.freshness === 'stale') ||
    workspaceState.watchlist.some(
      (watch) =>
        watch.latestSnapshot?.freshnessStatus === 'stale' ||
        watch.latestSnapshot?.freshnessStatus === 'degraded'
    );

  return anyStaleSnapshot ? 'stale' : 'fresh';
}

export function markSavedIntelligenceEvaluationFailure(
  workspaceId: string,
  workspaceState: SavedIntelligenceWorkspaceState,
  evaluatedAt: string
): { workspaceState: SavedIntelligenceWorkspaceState; result: SavedIntelligenceEvaluationResult } {
  const nextWorkspace = normalizeSavedIntelligenceWorkspaceState(workspaceId, {
    ...workspaceState,
    freshness: 'failed',
    lastEvaluatedAt: evaluatedAt,
    failureReason: 'evaluation_failed'
  });

  return {
    workspaceState: nextWorkspace,
    result: {
      workspaceId,
      freshness: 'failed',
      evaluatedAt,
      createdAlertCount: 0,
      suppressedDuplicateCount: 0,
      updatedSnapshotCount: 0,
      failureReason: 'evaluation_failed'
    }
  };
}

export function evaluateSavedIntelligenceWorkspace(input: {
  workspaceId: string;
  arenaState: ArenaState;
  workspaceState: SavedIntelligenceWorkspaceState;
  now: string;
}): { workspaceState: SavedIntelligenceWorkspaceState; result: SavedIntelligenceEvaluationResult } {
  const workspaceState = normalizeSavedIntelligenceWorkspaceState(
    input.workspaceId,
    input.workspaceState
  );
  const marketById = baseCatalogByMarketId(input.arenaState, input.now);

  let createdAlertCount = 0;
  let suppressedDuplicateCount = 0;
  let updatedSnapshotCount = 0;

  workspaceState.savedFilters = workspaceState.savedFilters.map((filter) => {
    const matches = filter.enabled ? filterCatalogMatches(input.arenaState, filter, input.now) : [];
    const currentEvaluation = buildFilterEvaluationSnapshot(filter, matches, input.now);
    const previousEvaluation = filter.latestEvaluation;
    const currentTopItem = currentEvaluation.topMarketIds[0]
      ? marketById.get(currentEvaluation.topMarketIds[0]) ?? null
      : null;

    const alertCounts = evaluateSavedFilterAlerts(
      input.workspaceId,
      input.arenaState,
      workspaceState,
      filter,
      previousEvaluation,
      currentEvaluation,
      currentTopItem,
      input.now
    );

    createdAlertCount += alertCounts.created;
    suppressedDuplicateCount += alertCounts.suppressed;
    updatedSnapshotCount += 1;

    return {
      ...filter,
      latestEvaluation: currentEvaluation,
      updatedAt: input.now
    };
  });

  workspaceState.watchlist = workspaceState.watchlist.map((watch) => {
    const currentItem = marketById.get(watch.marketId) ?? null;
    const support = watchSupportStatus(currentItem);
    const currentSnapshot = currentItem ? watchSnapshotFromItem(currentItem, input.now) : null;
    const alertCounts = evaluateWatchAlerts(
      input.workspaceId,
      input.arenaState,
      workspaceState,
      watch,
      watch.latestSnapshot,
      currentItem,
      input.now
    );

    createdAlertCount += alertCounts.created;
    suppressedDuplicateCount += alertCounts.suppressed;
    updatedSnapshotCount += 1;

    return {
      ...watch,
      supportStatus: support.supportStatus,
      degradedReason: support.degradedReason,
      latestSnapshot: currentSnapshot,
      updatedAt: input.now
    };
  });

  workspaceState.lastEvaluatedAt = input.now;
  workspaceState.lastSuccessfulEvaluatedAt = input.now;
  workspaceState.failureReason = null;
  workspaceState.freshness = derivedWorkspaceFreshness(workspaceState, input.now);
  workspaceState.alerts = sortAlerts(workspaceState.alerts).slice(0, ALERT_LIMIT);

  return {
    workspaceState,
    result: {
      workspaceId: input.workspaceId,
      freshness: workspaceState.freshness,
      evaluatedAt: input.now,
      createdAlertCount,
      suppressedDuplicateCount,
      updatedSnapshotCount,
      failureReason: null
    }
  };
}

function queueSeverityFromAlerts(alerts: IntelligenceAlert[]): IntelligenceAlertSeverity {
  return alerts.reduce<IntelligenceAlertSeverity>(
    (max, alert) => maxSeverity(max, alert.severity),
    'info'
  );
}

export function buildDailyResearchQueue(input: {
  workspaceId: string;
  arenaState: ArenaState;
  workspaceState: SavedIntelligenceWorkspaceState;
  now: string;
}): DailyQueueItem[] {
  const workspaceState = normalizeSavedIntelligenceWorkspaceState(
    input.workspaceId,
    input.workspaceState
  );
  const marketById = baseCatalogByMarketId(input.arenaState, input.now);
  const queueByMarketId = new Map<string, DailyQueueItem>();
  const watchedByMarketId = new Map(
    workspaceState.watchlist.map((watch) => [watch.marketId, watch] as const)
  );
  const filterNamesByMarketId = new Map<string, string[]>();

  for (const filter of workspaceState.savedFilters) {
    for (const marketId of filter.latestEvaluation?.topMarketIds ?? []) {
      const names = filterNamesByMarketId.get(marketId) ?? [];
      names.push(filter.name);
      filterNamesByMarketId.set(marketId, names);
    }
  }

  const visibleAlerts = workspaceState.alerts.filter((alert) => alert.dismissedAt === null);

  const ensureItem = (marketId: string): DailyQueueItem | null => {
    const existing = queueByMarketId.get(marketId);
    if (existing) {
      return existing;
    }

    const market = marketById.get(marketId) ?? null;
    const watch = watchedByMarketId.get(marketId) ?? null;
    if (!market && !watch) {
      return null;
    }

    const question = market?.question ?? watch?.question;
    const asset = market?.asset ?? watch?.asset;
    const conditionType = market?.conditionType ?? watch?.conditionType;
    const expiresAt = market?.expiresAt ?? watch?.expiresAt;
    if (!question || !asset || !conditionType || !expiresAt) {
      return null;
    }

    const nextItem: DailyQueueItem = {
      marketId,
      question,
      asset,
      conditionType,
      expiresAt,
      marketUrl: market?.marketUrl ?? watch?.marketUrl ?? null,
      sourceTypes: [],
      reasonCodes: [],
      severity: 'info',
      freshness:
        market?.freshnessStatus === 'fresh'
          ? 'fresh'
          : workspaceState.lastSuccessfulEvaluatedAt
            ? 'stale'
            : 'never_evaluated',
      opportunityScoreBps: market?.opportunityScoreBps ?? watch?.latestSnapshot?.opportunityScoreBps ?? null,
      edgeBps: market ? absoluteEdgeBps(market) : watch?.latestSnapshot?.edgeBps ?? null,
      probabilityGapBps: market
        ? probabilityGapBps(market)
        : watch?.latestSnapshot?.probabilityGapBps ?? null,
      dataHealthScoreBps: market?.dataHealthScoreBps ?? watch?.latestSnapshot?.dataHealthScoreBps ?? null,
      timeToExpiryHours: market?.timeToExpiryHours ?? watch?.latestSnapshot?.timeToExpiryHours ?? null,
      unreadAlertCount: 0,
      alertIds: [],
      summary: watch?.label ?? question
    };

    queueByMarketId.set(marketId, nextItem);
    return nextItem;
  };

  for (const watch of workspaceState.watchlist) {
    const item = ensureItem(watch.marketId);
    if (!item) {
      continue;
    }

    if (!item.sourceTypes.includes('watchlist')) {
      item.sourceTypes.push('watchlist');
    }

    if (watch.latestSnapshot?.timeToExpiryHours !== undefined) {
      item.timeToExpiryHours = watch.latestSnapshot?.timeToExpiryHours ?? item.timeToExpiryHours;
    }
  }

  for (const [marketId] of filterNamesByMarketId) {
    const item = ensureItem(marketId);
    if (!item) {
      continue;
    }

    if (!item.sourceTypes.includes('saved_filter')) {
      item.sourceTypes.push('saved_filter');
    }
  }

  for (const alert of visibleAlerts) {
    if (!alert.marketId) {
      continue;
    }

    const item = ensureItem(alert.marketId);
    if (!item) {
      continue;
    }

    if (!item.sourceTypes.includes(alert.sourceType)) {
      item.sourceTypes.push(alert.sourceType);
    }
    if (!item.reasonCodes.includes(alert.reasonCode)) {
      item.reasonCodes.push(alert.reasonCode);
    }
    item.severity = maxSeverity(item.severity, alert.severity);
    item.alertIds.push(alert.id);
    if (!alert.readAt) {
      item.unreadAlertCount += 1;
    }
  }

  for (const item of queueByMarketId.values()) {
    const relatedAlerts = visibleAlerts.filter((alert) => alert.marketId === item.marketId);
    const filterNames = (filterNamesByMarketId.get(item.marketId) ?? []).sort((left, right) =>
      left.localeCompare(right)
    );
    if (relatedAlerts.length > 0) {
      item.severity = queueSeverityFromAlerts(relatedAlerts);
      item.summary = relatedAlerts[0]?.summary ?? item.summary;
    } else if (filterNames.length > 0) {
      item.summary = `${filterNames[0]} is ready for research review.`;
    }

    item.sourceTypes = [...item.sourceTypes].sort((left, right) => left.localeCompare(right));
    item.reasonCodes = [...item.reasonCodes].sort((left, right) => left.localeCompare(right));
    item.alertIds = [...item.alertIds].sort((left, right) => left.localeCompare(right));
  }

  return [...queueByMarketId.values()]
    .sort((left, right) => {
      const severityDiff = severityRank(right.severity) - severityRank(left.severity);
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const unreadDiff = right.unreadAlertCount - left.unreadAlertCount;
      if (unreadDiff !== 0) {
        return unreadDiff;
      }

      const leftNearExpiry = left.timeToExpiryHours !== null && left.timeToExpiryHours <= 24 ? 1 : 0;
      const rightNearExpiry =
        right.timeToExpiryHours !== null && right.timeToExpiryHours <= 24 ? 1 : 0;
      if (rightNearExpiry !== leftNearExpiry) {
        return rightNearExpiry - leftNearExpiry;
      }

      const opportunityDiff = (right.opportunityScoreBps ?? 0) - (left.opportunityScoreBps ?? 0);
      if (opportunityDiff !== 0) {
        return opportunityDiff;
      }

      const disagreementDiff = (right.probabilityGapBps ?? 0) - (left.probabilityGapBps ?? 0);
      if (disagreementDiff !== 0) {
        return disagreementDiff;
      }

      const dataHealthDiff = (left.dataHealthScoreBps ?? 10_000) - (right.dataHealthScoreBps ?? 10_000);
      if (dataHealthDiff !== 0) {
        return dataHealthDiff;
      }

      return left.marketId.localeCompare(right.marketId);
    })
    .slice(0, ALERT_LIMIT);
}
