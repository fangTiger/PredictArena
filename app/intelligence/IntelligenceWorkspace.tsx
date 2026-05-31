'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type {
  AgentReputationFilters,
  AgentReputationGroupBy,
  MarketCatalogFilters,
  MarketIntelligenceCatalog,
  MarketIntelligenceItem,
  MarketIntelligenceSort,
  PaperFollowFilters,
  PaperFollowResult,
  PaperFollowStakeModel,
  SegmentedAgentReputationRow,
  SignalResearchView
} from '@/lib/intelligence/readModels';
import type {
  AgentSignal,
  ConfidenceLabel,
  MarketConditionType,
  MarketSource,
  SupportedAsset
} from '@/lib/polymarket/types';

interface IntelligenceWorkspaceProps {
  initialAgentFilters: AgentReputationFilters;
  initialAgentRows: SegmentedAgentReputationRow[];
  initialMarketCatalog: MarketIntelligenceCatalog;
  initialMarketFilters: MarketCatalogFilters;
  initialPaperFilters: PaperFollowFilters;
  initialPaperResult: PaperFollowResult;
  initialResearch: SignalResearchView | null;
}

interface AgentRowsResponse {
  filters: AgentReputationFilters;
  rows: SegmentedAgentReputationRow[];
}

interface PaperFollowResponse {
  result: PaperFollowResult;
}

interface ResearchResponse {
  research: SignalResearchView;
}

interface SavedFilterView {
  id: string;
  workspaceId: string;
  name: string;
  enabled: boolean;
  query: MarketCatalogFilters & {
    minOpportunityScoreBps?: number;
    minDataHealthScoreBps?: number;
  };
  latestEvaluation: {
    freshness: SavedWorkspaceFreshness;
    evaluatedAt: string;
  } | null;
}

interface WatchView {
  id: string;
  marketId: string;
  asset: SupportedAsset;
  question: string;
  label: string | null;
}

type SavedWorkspaceFreshness = 'never_evaluated' | 'fresh' | 'stale' | 'failed';

interface SavedAlertView {
  id: string;
  sourceType: 'saved_filter' | 'watchlist';
  sourceLabel: string | null;
  orphaned: boolean;
  reasonCode: string;
  severity: string;
  summary: string;
  currentSnapshot: {
    marketId: string | null;
    opportunityScoreBps: number | null;
    edgeBps: number | null;
    probabilityGapBps: number | null;
    dataHealthScoreBps: number | null;
    timeToExpiryHours: number | null;
    freshnessStatus: string | null;
    evaluatedAt: string;
  } | null;
  readAt: string | null;
  dismissedAt: string | null;
  marketId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DailyQueueView {
  marketId: string;
  asset: SupportedAsset;
  question: string;
  conditionType: MarketConditionType;
  expiresAt: string;
  marketUrl: string | null;
  sourceTypes: Array<'saved_filter' | 'watchlist'>;
  severity: string;
  summary: string;
  reasonCodes: string[];
  freshness: SavedWorkspaceFreshness;
  opportunityScoreBps: number | null;
  edgeBps: number | null;
  probabilityGapBps: number | null;
  dataHealthScoreBps: number | null;
  timeToExpiryHours: number | null;
  unreadAlertCount: number;
  alertIds: string[];
}

interface SavedWorkspaceResponse {
  workspaceId: string;
  freshness: SavedWorkspaceFreshness;
  lastEvaluatedAt: string | null;
  lastSuccessfulEvaluatedAt: string | null;
  failureReason: string | null;
  unreadAlertCount: number;
  savedFilters: SavedFilterView[];
  watchlist: WatchView[];
  dailyQueuePreview: DailyQueueView[];
}

interface SavedFilterResponse {
  savedFilter: SavedFilterView;
}

interface WatchResponse {
  duplicate?: boolean;
  watch: WatchView;
}

interface AlertsResponse {
  alerts: SavedAlertView[];
}

interface AlertPatchResponse {
  alert: SavedAlertView;
}

interface QueueResponse {
  items: DailyQueueView[];
}

interface EvaluationResponse {
  freshness: SavedWorkspaceFreshness;
  evaluatedAt: string;
  createdAlertCount: number;
  suppressedDuplicateCount: number;
  updatedSnapshotCount: number;
  failureReason: string | null;
}

const WORKSPACE_STORAGE_KEY = 'predictarena:intelligence-workspace-id';

const assetOptions: Array<SupportedAsset | 'all'> = ['all', 'BTC', 'ETH', 'SOL'];
const conditionOptions: Array<MarketConditionType | 'all'> = [
  'all',
  'EXPIRY_ABOVE',
  'EXPIRY_BELOW',
  'TOUCH_ABOVE',
  'TOUCH_BELOW'
];
const confidenceOptions: Array<ConfidenceLabel | 'all'> = ['all', 'LOW', 'MEDIUM', 'HIGH'];
const sourceOptions: Array<MarketSource | 'all'> = ['all', 'live', 'demo_snapshot'];
const sortOptions: MarketIntelligenceSort[] = [
  'opportunity_desc',
  'edge_desc',
  'expiry_asc',
  'liquidity_desc',
  'risk_asc',
  'data_health_desc'
];
const groupByOptions: AgentReputationGroupBy[] = [
  'agent',
  'asset',
  'conditionType',
  'expiryBucket',
  'confidenceBucket',
  'edgeBucket'
];
const paperAgentOptions: Array<AgentSignal['agentName'] | 'all'> = [
  'all',
  'volatility',
  'momentum'
];
const stakeModelOptions: PaperFollowStakeModel[] = [
  'signal_stake',
  'flat_1_usdc',
  'confidence_weighted'
];

function formatPercent(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

function formatSignedBps(bps: number): string {
  const sign = bps > 0 ? '+' : '';
  return `${sign}${bps.toLocaleString()} bps`;
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat('en', {
    maximumFractionDigits: 0,
    notation: value >= 100_000 ? 'compact' : 'standard'
  }).format(value);
}

function formatMicroUsdc(value: number): string {
  return `$${(value / 1_000_000).toFixed(2)}`;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function labelize(value: string): string {
  return value.replaceAll('_', ' ');
}

function formatOptionalPercent(value: number | null): string {
  return value === null ? 'n/a' : formatPercent(value);
}

function formatOptionalSignedBps(value: number | null): string {
  return value === null ? 'n/a' : formatSignedBps(value);
}

function formatTimeToExpiry(value: number | null): string {
  if (value === null) {
    return 'n/a';
  }

  if (value < 24) {
    return `${value}h`;
  }

  const days = value / 24;
  return days >= 10 ? `${Math.round(days)}d` : `${days.toFixed(1)}d`;
}

function shortHash(value: `0x${string}`): string {
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function toDatetimeLocal(value: string | null): string {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function scoreStyle(score: number) {
  return { '--score': `${Math.max(0, Math.min(100, score / 100))}%` } as CSSProperties;
}

function appendCommonFilters(params: URLSearchParams, filters: MarketCatalogFilters) {
  params.set('asset', filters.asset);
  params.set('conditionType', filters.conditionType);
  params.set('confidence', filters.confidence);
}

function marketQuery(filters: MarketCatalogFilters): string {
  const params = new URLSearchParams();
  appendCommonFilters(params, filters);
  params.set('source', filters.source);
  params.set('sort', filters.sort);
  params.set('minEdgeBps', String(filters.minEdgeBps));
  params.set('maxExpiryDays', String(filters.maxExpiryDays));
  params.set('minLiquidity', String(filters.minLiquidity));
  params.set('limit', String(filters.limit));
  return params.toString();
}

function agentQuery(filters: AgentReputationFilters): string {
  const params = new URLSearchParams();
  params.set('groupBy', filters.groupBy);
  params.set('asset', filters.asset);
  params.set('conditionType', filters.conditionType);
  params.set('confidence', filters.confidence);
  params.set('minResolved', String(filters.minResolved));
  return params.toString();
}

function paperQuery(filters: PaperFollowFilters): string {
  const params = new URLSearchParams();
  params.set('agentName', filters.agentName);
  params.set('minEdgeBps', String(filters.minEdgeBps));
  params.set('confidence', filters.confidence);
  params.set('asset', filters.asset);
  params.set('conditionType', filters.conditionType);
  params.set('stakeModel', filters.stakeModel);
  if (filters.from) {
    params.set('from', filters.from);
  }
  if (filters.to) {
    params.set('to', filters.to);
  }
  return params.toString();
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`request_failed:${response.status}`);
  }
  return response.json() as Promise<T>;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers
    }
  });
  if (!response.ok) {
    throw new Error(`request_failed:${response.status}`);
  }
  return response.json() as Promise<T>;
}

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function createWorkspaceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const random = Math.floor(Math.random() * 16);
    const value = token === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function normalizeReason(value: string): string {
  return value.replaceAll('_', ' ');
}

function summarizeReasonCodes(reasonCodes: string[]): string {
  return reasonCodes.length > 0
    ? reasonCodes.map((reasonCode) => normalizeReason(reasonCode)).join(', ')
    : 'monitoring';
}

function alertFallbacksFromQueue(
  items: DailyQueueView[],
  existingAlerts: SavedAlertView[]
): SavedAlertView[] {
  const existingById = new Map(existingAlerts.map((alert) => [alert.id, alert]));

  return items.flatMap((item) =>
    item.alertIds.map((alertId, index) => {
      const existing = existingById.get(alertId);
      if (existing) {
        return existing;
      }

      return {
        id: alertId,
        sourceType: item.sourceTypes[index] ?? item.sourceTypes[0] ?? 'watchlist',
        sourceLabel: item.summary,
        orphaned: false,
        reasonCode: item.reasonCodes[index] ?? item.reasonCodes[0] ?? 'new_high_priority_market',
        severity: item.severity,
        summary: item.summary,
        currentSnapshot: {
          marketId: item.marketId,
          opportunityScoreBps: item.opportunityScoreBps,
          edgeBps: item.edgeBps,
          probabilityGapBps: item.probabilityGapBps,
          dataHealthScoreBps: item.dataHealthScoreBps,
          timeToExpiryHours: item.timeToExpiryHours,
          freshnessStatus: item.freshness,
          evaluatedAt: ''
        },
        readAt: item.unreadAlertCount > 0 ? null : 'read',
        dismissedAt: null,
        marketId: item.marketId,
        createdAt: '',
        updatedAt: ''
      };
    })
  );
}

function SavedDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="intelligence-saved-detail">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = 'neutral'
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'mint' | 'amber' | 'risk';
}) {
  return (
    <div className={`intelligence-metric intelligence-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="intelligence-score-row">
      <span>{label}</span>
      <div className="intelligence-score-track" aria-hidden="true">
        <span style={scoreStyle(score)} />
      </div>
      <strong>{formatPercent(score)}</strong>
    </div>
  );
}

function MarketRow({
  item,
  selected,
  onSelect
}: {
  item: MarketIntelligenceItem;
  selected: boolean;
  onSelect: (marketId: string) => void;
}) {
  const edge = item.bestAgent?.edgeBps ?? 0;

  return (
    <button
      type="button"
      className={`intelligence-market-row${selected ? ' intelligence-market-row-selected' : ''}`}
      onClick={() => onSelect(item.marketId)}
      aria-pressed={selected}
      aria-label={`Research ${item.asset} ${item.question}`}
    >
      <span className="intelligence-market-main">
        <strong>{item.asset}</strong>
        <span>{item.question}</span>
      </span>
      <span>{formatPercent(item.impliedProbabilityBps)}</span>
      <span>{formatSignedBps(edge)}</span>
      <span>{formatPercent(item.opportunityScoreBps)}</span>
      <span>{formatPercent(item.dataHealthScoreBps)}</span>
      <span>{formatPercent(item.riskScoreBps)}</span>
      <span>{item.accountabilityStatus}</span>
    </button>
  );
}

function bestResearchAgent(research: SignalResearchView): SignalResearchView['agentViews'][number] | null {
  return [...research.agentViews].sort(
    (left, right) => Math.abs(right.edgeBps) - Math.abs(left.edgeBps)
  )[0] ?? null;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <p className="intelligence-empty">{children}</p>;
}

export function IntelligenceWorkspace({
  initialAgentFilters,
  initialAgentRows,
  initialMarketCatalog,
  initialMarketFilters,
  initialPaperFilters,
  initialPaperResult,
  initialResearch
}: IntelligenceWorkspaceProps) {
  const [marketFilters, setMarketFilters] = useState(initialMarketFilters);
  const [marketCatalog, setMarketCatalog] = useState(initialMarketCatalog);
  const [selectedMarketId, setSelectedMarketId] = useState(
    initialMarketCatalog.items[0]?.marketId ?? null
  );
  const [research, setResearch] = useState(initialResearch);
  const [agentFilters, setAgentFilters] = useState(initialAgentFilters);
  const [agentRows, setAgentRows] = useState(initialAgentRows);
  const [paperFilters, setPaperFilters] = useState(initialPaperFilters);
  const [paperResult, setPaperResult] = useState(initialPaperResult);
  const [status, setStatus] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [savedFilters, setSavedFilters] = useState<SavedFilterView[]>([]);
  const [watchlist, setWatchlist] = useState<WatchView[]>([]);
  const [alerts, setAlerts] = useState<SavedAlertView[]>([]);
  const [dailyQueue, setDailyQueue] = useState<DailyQueueView[]>([]);
  const [savedFilterName, setSavedFilterName] = useState('');
  const [workspaceFreshness, setWorkspaceFreshness] =
    useState<SavedWorkspaceFreshness>('never_evaluated');
  const [lastEvaluatedAt, setLastEvaluatedAt] = useState<string | null>(null);
  const [workspaceFailureReason, setWorkspaceFailureReason] = useState<string | null>(null);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const marketRequestSeq = useRef(0);
  const researchRequestSeq = useRef(0);
  const agentRequestSeq = useRef(0);
  const paperRequestSeq = useRef(0);
  const savedWorkspaceRequestSeq = useRef(0);
  const savedAlertsRequestSeq = useRef(0);

  const selectedMarket = useMemo(
    () =>
      marketCatalog.items.find((item) => item.marketId === selectedMarketId) ??
      marketCatalog.items[0] ??
      null,
    [marketCatalog.items, selectedMarketId]
  );
  const researchBestAgent = useMemo(
    () => (research ? bestResearchAgent(research) : null),
    [research]
  );
  const probabilityGapBps =
    research && researchBestAgent
      ? researchBestAgent.agentProbabilityBps - research.market.impliedProbabilityBps
      : 0;
  const selectedWatch = useMemo(
    () => watchlist.find((watch) => watch.marketId === selectedMarket?.marketId) ?? null,
    [selectedMarket?.marketId, watchlist]
  );
  const savedMarketContextById = useMemo(() => {
    const next = new Map<
      string,
      {
        asset: SupportedAsset;
        question: string;
        marketUrl: string | null;
      }
    >();

    for (const item of marketCatalog.items) {
      next.set(item.marketId, {
        asset: item.asset,
        question: item.question,
        marketUrl: item.marketUrl
      });
    }

    for (const item of dailyQueue) {
      if (!next.has(item.marketId)) {
        next.set(item.marketId, {
          asset: item.asset,
          question: item.question,
          marketUrl: item.marketUrl
        });
      }
    }

    for (const watch of watchlist) {
      if (!next.has(watch.marketId)) {
        next.set(watch.marketId, {
          asset: watch.asset,
          question: watch.question,
          marketUrl: null
        });
      }
    }

    return next;
  }, [dailyQueue, marketCatalog.items, watchlist]);
  const visibleAlerts = useMemo(() => {
    const currentAlerts = alerts.filter((alert) => alert.dismissedAt === null);
    if (currentAlerts.length > 0) {
      return currentAlerts;
    }

    return alertFallbacksFromQueue(dailyQueue, alerts).filter(
      (alert) => alert.dismissedAt === null
    );
  }, [alerts, dailyQueue]);
  const radarMarkets = useMemo(() => {
    const preferredAssets: SupportedAsset[] = ['BTC', 'ETH', 'SOL'];
    const preferred = preferredAssets
      .map((asset) => marketCatalog.items.find((item) => item.asset === asset))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const fallback = marketCatalog.items.filter(
      (item) => !preferred.some((preferredItem) => preferredItem.marketId === item.marketId)
    );

    return [...preferred, ...fallback].slice(0, 3);
  }, [marketCatalog.items]);

  function applyWorkspacePayload(payload: SavedWorkspaceResponse) {
    setWorkspaceFreshness(payload.freshness);
    setLastEvaluatedAt(payload.lastEvaluatedAt);
    setWorkspaceFailureReason(payload.failureReason);
    setUnreadAlertCount(payload.unreadAlertCount);
    setSavedFilters(payload.savedFilters);
    setWatchlist(payload.watchlist);
    setDailyQueue(payload.dailyQueuePreview);
  }

  async function refreshSavedWorkspace(nextWorkspaceId = workspaceId) {
    if (!nextWorkspaceId) {
      return;
    }

    const requestId = ++savedWorkspaceRequestSeq.current;
    const payload = await fetchJson<SavedWorkspaceResponse>(
      `/api/intelligence/workspace?workspaceId=${encodeURIComponent(nextWorkspaceId)}`
    );
    if (requestId !== savedWorkspaceRequestSeq.current) {
      return;
    }
    applyWorkspacePayload(payload);
  }

  async function refreshAlertsAndQueue(nextWorkspaceId = workspaceId) {
    if (!nextWorkspaceId) {
      return;
    }

    const workspaceRequestId = ++savedWorkspaceRequestSeq.current;
    const alertRequestId = ++savedAlertsRequestSeq.current;
    const workspacePayload = await fetchJson<SavedWorkspaceResponse>(
      `/api/intelligence/workspace?workspaceId=${encodeURIComponent(nextWorkspaceId)}`
    );
    const [initialAlertsPayload, queuePayload] = await Promise.all([
      fetchJson<AlertsResponse>(
        `/api/intelligence/alerts?workspaceId=${encodeURIComponent(nextWorkspaceId)}`
      ),
      fetchJson<QueueResponse>(
        `/api/intelligence/daily-queue?workspaceId=${encodeURIComponent(nextWorkspaceId)}`
      )
    ]);
    const alertsPayload =
      initialAlertsPayload.alerts.length === 0 && workspacePayload.unreadAlertCount > 0
        ? await pause(100).then(() =>
            fetchJson<AlertsResponse>(
              `/api/intelligence/alerts?workspaceId=${encodeURIComponent(nextWorkspaceId)}`
            )
          )
        : initialAlertsPayload;
    if (
      workspaceRequestId !== savedWorkspaceRequestSeq.current ||
      alertRequestId !== savedAlertsRequestSeq.current
    ) {
      return;
    }
    setAlerts((currentAlerts) =>
      alertsPayload.alerts.length > 0
        ? alertsPayload.alerts
        : alertFallbacksFromQueue(queuePayload.items, currentAlerts)
    );
    setDailyQueue(queuePayload.items);
    applyWorkspacePayload(workspacePayload);
  }

  useEffect(() => {
    const existing = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    const nextWorkspaceId = existing ?? createWorkspaceId();
    if (!existing) {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, nextWorkspaceId);
    }
    setWorkspaceId(nextWorkspaceId);
    void refreshAlertsAndQueue(nextWorkspaceId).catch(() => {
      setWorkspaceFreshness('failed');
      setWorkspaceFailureReason('saved_intelligence_unavailable');
    });
    // This bootstraps one browser-local workspace id on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshResearch(marketId: string) {
    const requestId = ++researchRequestSeq.current;
    const payload = await fetchJson<ResearchResponse>(
      `/api/intelligence/research?marketId=${encodeURIComponent(marketId)}`
    );
    if (requestId !== researchRequestSeq.current) {
      return;
    }
    setResearch(payload.research);
  }

  async function refreshMarkets(nextFilters: MarketCatalogFilters) {
    const requestId = ++marketRequestSeq.current;
    setStatus('Refreshing market radar');
    try {
      const nextCatalog = await fetchJson<MarketIntelligenceCatalog>(
        `/api/intelligence/markets?${marketQuery(nextFilters)}`
      );
      if (requestId !== marketRequestSeq.current) {
        return;
      }
      setMarketCatalog(nextCatalog);
      const nextSelected =
        nextCatalog.items.find((item) => item.marketId === selectedMarketId)?.marketId ??
        nextCatalog.items[0]?.marketId ??
        null;
      setSelectedMarketId(nextSelected);
      if (nextSelected) {
        await refreshResearch(nextSelected);
      } else {
        setResearch(null);
      }
      setStatus(null);
    } catch {
      if (requestId === marketRequestSeq.current) {
        setStatus('Market radar is temporarily degraded');
      }
    }
  }

  async function updateMarketFilter<K extends keyof MarketCatalogFilters>(
    key: K,
    value: MarketCatalogFilters[K]
  ) {
    const nextFilters = { ...marketFilters, [key]: value };
    setMarketFilters(nextFilters);
    await refreshMarkets(nextFilters);
  }

  async function selectMarket(marketId: string) {
    setSelectedMarketId(marketId);
    setStatus('Loading signal research');
    try {
      await refreshResearch(marketId);
      setStatus(null);
    } catch {
      setStatus('Research view is temporarily degraded');
    }
  }

  async function updateAgentFilter<K extends keyof AgentReputationFilters>(
    key: K,
    value: AgentReputationFilters[K]
  ) {
    const nextFilters = { ...agentFilters, [key]: value };
    const requestId = ++agentRequestSeq.current;
    setAgentFilters(nextFilters);
    setStatus('Refreshing agent segments');
    try {
      const payload = await fetchJson<AgentRowsResponse>(
        `/api/intelligence/agents?${agentQuery(nextFilters)}`
      );
      if (requestId !== agentRequestSeq.current) {
        return;
      }
      setAgentRows(payload.rows);
      setStatus(null);
    } catch {
      if (requestId === agentRequestSeq.current) {
        setStatus('Agent segments are temporarily degraded');
      }
    }
  }

  async function updatePaperFilter<K extends keyof PaperFollowFilters>(
    key: K,
    value: PaperFollowFilters[K]
  ) {
    const nextFilters = { ...paperFilters, [key]: value };
    const requestId = ++paperRequestSeq.current;
    setPaperFilters(nextFilters);
    setStatus('Refreshing paper-follow');
    try {
      const payload = await fetchJson<PaperFollowResponse>(
        `/api/intelligence/paper-follow?${paperQuery(nextFilters)}`
      );
      if (requestId !== paperRequestSeq.current) {
        return;
      }
      setPaperResult(payload.result);
      setStatus(null);
    } catch {
      if (requestId === paperRequestSeq.current) {
        setStatus('Paper-follow is temporarily degraded');
      }
    }
  }

  async function saveCurrentFilter() {
    if (!workspaceId) {
      return;
    }

    const name =
      savedFilterName.trim() ||
      `${marketFilters.asset === 'all' ? 'All assets' : marketFilters.asset} Focus`;
    setStatus('Saving research filter');
    try {
      await requestJson<SavedFilterResponse>('/api/intelligence/saved-filters', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          name,
          query: marketFilters
        })
      });
      await refreshSavedWorkspace(workspaceId);
      setSavedFilterName('');
      setStatus(null);
    } catch {
      setStatus('Saved filter could not be stored');
    }
  }

  async function applySavedFilter(savedFilter: SavedFilterView) {
    const nextFilters: MarketCatalogFilters = {
      asset: savedFilter.query.asset,
      conditionType: savedFilter.query.conditionType,
      confidence: savedFilter.query.confidence,
      source: savedFilter.query.source,
      sort: savedFilter.query.sort,
      minEdgeBps: savedFilter.query.minEdgeBps,
      maxExpiryDays: savedFilter.query.maxExpiryDays,
      minLiquidity: savedFilter.query.minLiquidity,
      limit: marketFilters.limit
    };
    setMarketFilters(nextFilters);
    await refreshMarkets(nextFilters);
  }

  async function toggleSavedFilter(savedFilter: SavedFilterView) {
    if (!workspaceId) {
      return;
    }

    setStatus(`${savedFilter.enabled ? 'Disabling' : 'Enabling'} saved filter`);
    try {
      await requestJson<SavedFilterResponse>(
        `/api/intelligence/saved-filters/${encodeURIComponent(savedFilter.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            workspaceId,
            enabled: !savedFilter.enabled
          })
        }
      );
      await refreshSavedWorkspace(workspaceId);
      setStatus(null);
    } catch {
      setStatus('Saved filter update failed');
    }
  }

  async function deleteSavedFilter(savedFilter: SavedFilterView) {
    if (!workspaceId) {
      return;
    }

    setStatus('Deleting saved filter');
    try {
      await requestJson<{ deleted: boolean }>(
        `/api/intelligence/saved-filters/${encodeURIComponent(savedFilter.id)}`,
        {
          method: 'DELETE',
          body: JSON.stringify({ workspaceId })
        }
      );
      await refreshSavedWorkspace(workspaceId);
      setStatus(null);
    } catch {
      setStatus('Saved filter delete failed');
    }
  }

  async function watchSelectedMarket() {
    if (!workspaceId || !selectedMarket) {
      return;
    }

    setStatus('Watching market');
    try {
      const payload = await requestJson<WatchResponse>('/api/intelligence/watchlist', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          marketId: selectedMarket.marketId,
          label: `${selectedMarket.asset} research watch`
        })
      });
      await refreshSavedWorkspace(workspaceId);
      setStatus(payload.duplicate ? 'Market already watched' : null);
    } catch {
      setStatus('Watchlist update failed');
    }
  }

  async function unwatchSelectedMarket() {
    if (!workspaceId || !selectedWatch) {
      return;
    }

    setStatus('Removing watched market');
    try {
      await requestJson<{ deleted: boolean }>(
        `/api/intelligence/watchlist/${encodeURIComponent(selectedWatch.id)}`,
        {
          method: 'DELETE',
          body: JSON.stringify({ workspaceId })
        }
      );
      await refreshSavedWorkspace(workspaceId);
      setStatus(null);
    } catch {
      setStatus('Watchlist remove failed');
    }
  }

  async function refreshSavedIntelligence() {
    if (!workspaceId) {
      return;
    }

    setStatus('Refreshing saved intelligence');
    try {
      const evaluation = await requestJson<EvaluationResponse>(
        '/api/intelligence/alerts/evaluate',
        {
          method: 'POST',
          body: JSON.stringify({ workspaceId })
        }
      );
      setWorkspaceFreshness(evaluation.freshness);
      setLastEvaluatedAt(evaluation.evaluatedAt);
      setWorkspaceFailureReason(evaluation.failureReason);
      await refreshAlertsAndQueue(workspaceId);
      setStatus(null);
    } catch {
      setWorkspaceFreshness('failed');
      setWorkspaceFailureReason('saved_intelligence_unavailable');
      setStatus('Saved intelligence refresh failed');
    }
  }

  async function markAlert(alert: SavedAlertView, state: 'read' | 'unread' | 'dismissed') {
    if (!workspaceId) {
      return;
    }

    try {
      const payload = await requestJson<AlertPatchResponse>(
        `/api/intelligence/alerts/${encodeURIComponent(alert.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            workspaceId,
            state
          })
        }
      );
      setAlerts((current) =>
        current.map((item) => (item.id === payload.alert.id ? payload.alert : item))
      );
      await refreshAlertsAndQueue(workspaceId);
    } catch {
      setStatus('Alert state update failed');
    }
  }

  async function openQueueItem(item: DailyQueueView) {
    await selectMarket(item.marketId);
  }

  return (
    <div className="intelligence-workspace">
      <header className="intelligence-command">
        <div className="intelligence-command-copy">
          <p className="deck-kicker">Market Intelligence Workspace</p>
          <h1>PredictArena Intelligence</h1>
          <p>
            Rank public crypto prediction markets, inspect agent disagreement, and evaluate
            paper-follow assumptions before any accountability workflow.
          </p>
          <div className="deck-status-row intelligence-command-boundaries">
            <span className="status-chip status-live">Research-only</span>
            <span className="status-chip status-amber">No financial advice</span>
            <span className="status-chip status-ready">No transaction sent</span>
            <span className="status-chip">{status ?? 'Read models online'}</span>
          </div>
        </div>
        <div className="deck-visual intelligence-command-visual" role="img" aria-label="PredictArena intelligence radar">
          <div className="forecast-panel intelligence-forecast-panel">
            <div className="forecast-radar">
              <span className="radar-ring ring-one" />
              <span className="radar-ring ring-two" />
              <span className="radar-ring ring-three" />
              <span className="radar-sweep" />
              <span className="radar-core">AI</span>
              <span className="radar-node node-btc">BTC</span>
              <span className="radar-node node-eth">ETH</span>
              <span className="radar-node node-sol">SOL</span>
            </div>
            <div className="probability-console">
              {radarMarkets.map((item) => (
                <div key={item.marketId} className="probability-row">
                  <span>{item.asset}</span>
                  <strong>{formatPercent(item.impliedProbabilityBps)}</strong>
                  <div className="probability-track">
                    <span style={{ width: `${item.impliedProbabilityBps / 100}%` }} />
                  </div>
                </div>
              ))}
              {radarMarkets.length === 0 ? (
                <div className="probability-row">
                  <span>SCAN</span>
                  <strong>--</strong>
                  <div className="probability-track">
                    <span style={{ width: '0%' }} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <section className="intelligence-overview" aria-label="Intelligence summary">
        <Metric
          label="Markets"
          value={String(marketCatalog.freshness.marketCount)}
          tone="neutral"
        />
        <Metric
          label="Visible"
          value={String(marketCatalog.items.length)}
          tone="mint"
        />
        <Metric
          label="Latest scan"
          value={
            marketCatalog.freshness.latestScanAt
              ? formatDate(marketCatalog.freshness.latestScanAt)
              : 'No scan'
          }
          tone="amber"
        />
        <Metric
          label="Paper sample"
          value={`${paperResult.resolvedCount}/${paperResult.includedCount}`}
          tone={paperResult.insufficientData ? 'amber' : 'mint'}
        />
      </section>

      <section className="panel intelligence-saved-panel" aria-labelledby="saved-intelligence-title">
        <div className="panel-header">
          <div>
            <p className="panel-kicker">Device saved state</p>
            <h2 id="saved-intelligence-title">Saved Intelligence</h2>
          </div>
          <span className="status-chip">
            Local workspace {unreadAlertCount} unread
          </span>
        </div>
        <p className="intelligence-summary">
          Saved on this device. Preferences are not an account; clearing local storage can remove
          saved filters, watchlist entries, and alert state.
        </p>
        <div className="intelligence-loop-strip" aria-label="Saved intelligence loop summary">
          <div>
            <span>Saved filters</span>
            <strong>{savedFilters.length}</strong>
            <small>Reusable market setups</small>
          </div>
          <div>
            <span>Watchlist</span>
            <strong>{watchlist.length}</strong>
            <small>Markets kept in view</small>
          </div>
          <div>
            <span>Alerts</span>
            <strong>{visibleAlerts.length}</strong>
            <small>{unreadAlertCount} unread signals</small>
          </div>
          <div>
            <span>Research queue</span>
            <strong>{dailyQueue.length}</strong>
            <small>Prioritized review items</small>
          </div>
        </div>
        <div className="intelligence-saved-status" aria-label="Saved intelligence freshness">
          <span className="status-chip">{workspaceFreshness}</span>
          <span>
            {lastEvaluatedAt ? `Last evaluated ${formatDate(lastEvaluatedAt)}` : 'Never evaluated'}
          </span>
          {workspaceFailureReason ? <span>{workspaceFailureReason}</span> : null}
          <button type="button" onClick={() => void refreshSavedIntelligence()}>
            Refresh saved intelligence
          </button>
        </div>

        <div className="intelligence-cockpit">
          <div className="intelligence-workspace-console">
            <div className="intelligence-console-header">
              <div>
                <p className="panel-kicker">Workspace Console</p>
                <h3>Saved setup</h3>
              </div>
              <span className="status-chip">{workspaceId ? 'local device' : 'initializing'}</span>
            </div>

            <div className="intelligence-filter-composer">
              <label>
                Saved filter name
                <input
                  aria-label="Saved filter name"
                  value={savedFilterName}
                  onChange={(event) => setSavedFilterName(event.target.value)}
                  placeholder="ETH Focus"
                />
              </label>
              <button type="button" onClick={() => void saveCurrentFilter()}>
                Save current filter
              </button>
            </div>

            <div className="intelligence-console-lanes">
              <section className="intelligence-console-lane" aria-label="Saved filters">
                <div className="intelligence-lane-title">
                  <h3>Saved filters</h3>
                  <span>{savedFilters.length}</span>
                </div>
                <div className="intelligence-saved-list intelligence-compact-list">
                  {savedFilters.map((savedFilter) => (
                    <div key={savedFilter.id}>
                      <strong>{savedFilter.name}</strong>
                      <span>{savedFilter.enabled ? 'enabled' : 'disabled'}</span>
                      <button
                        type="button"
                        onClick={() => void applySavedFilter(savedFilter)}
                        aria-label={`Apply saved filter ${savedFilter.name}`}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleSavedFilter(savedFilter)}
                        aria-label={`${savedFilter.enabled ? 'Disable' : 'Enable'} saved filter ${
                          savedFilter.name
                        }`}
                      >
                        {savedFilter.enabled ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteSavedFilter(savedFilter)}
                        aria-label={`Delete saved filter ${savedFilter.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {savedFilters.length === 0 ? (
                    <p>Save a filter to make this research setup easy to review again.</p>
                  ) : null}
                </div>
              </section>

              <section className="intelligence-console-lane" aria-label="Watched markets">
                <div className="intelligence-lane-title">
                  <h3>Watched markets</h3>
                  <span>{watchlist.length}</span>
                </div>
                <div className="intelligence-watch-actions">
                  <button
                    type="button"
                    onClick={() => void watchSelectedMarket()}
                    aria-label={`Watch market ${selectedMarket?.asset ?? 'selected'}`}
                    disabled={!selectedMarket || Boolean(selectedWatch)}
                  >
                    Watch market {selectedMarket?.asset ?? ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => void unwatchSelectedMarket()}
                    aria-label="Unwatch selected market"
                    disabled={!selectedWatch}
                  >
                    Unwatch selected market
                  </button>
                </div>
                <div className="intelligence-saved-list intelligence-compact-list">
                  {watchlist.map((watch) => (
                    <button
                      key={watch.id}
                      type="button"
                      onClick={() => void selectMarket(watch.marketId)}
                      aria-label={`Open watched market ${watch.asset}`}
                    >
                      <strong>{watch.label ?? watch.asset}</strong>
                      <span>{watch.question}</span>
                    </button>
                  ))}
                  {watchlist.length === 0 ? <p>Watch a market to keep it in the daily queue.</p> : null}
                </div>
              </section>
            </div>

            <div className="intelligence-focus-card">
              <h3>Current focus</h3>
              {selectedMarket ? (
                <>
                  <strong>{selectedMarket.asset} research watch</strong>
                  <span>{selectedMarket.question}</span>
                  <div className="intelligence-focus-bars">
                    <ScoreBar label="Opportunity" score={selectedMarket.opportunityScoreBps} />
                    <ScoreBar label="Data health" score={selectedMarket.dataHealthScoreBps} />
                    <ScoreBar label="Risk" score={selectedMarket.riskScoreBps} />
                  </div>
                  <div className="intelligence-saved-detail-grid">
                    <SavedDetail label="Implied" value={formatPercent(selectedMarket.impliedProbabilityBps)} />
                    <SavedDetail
                      label="Best edge"
                      value={formatOptionalSignedBps(selectedMarket.bestAgent?.edgeBps ?? null)}
                    />
                    <SavedDetail label="Expiry" value={formatDate(selectedMarket.expiresAt)} />
                    <SavedDetail
                      label="Status"
                      value={`market ${labelize(selectedMarket.freshnessStatus)}`}
                    />
                  </div>
                </>
              ) : (
                <p>Market focus will appear after the radar has a selected candidate.</p>
              )}
            </div>
          </div>

          <div className="intelligence-signal-flow">
          <div className="intelligence-saved-card intelligence-alert-card intelligence-saved-card-feed">
            <h3>Alert Center</h3>
            <div className="intelligence-saved-list">
              {visibleAlerts.map((alert) => (
                <div key={alert.id}>
                  <strong>{normalizeReason(alert.reasonCode)}</strong>
                  <span>{alert.summary}</span>
                  {alert.marketId ? (
                    <p className="intelligence-saved-note">
                      {savedMarketContextById.get(alert.marketId)?.question ?? 'Linked market research'}
                    </p>
                  ) : null}
                  <div className="intelligence-saved-detail-grid">
                    <SavedDetail label="Reason" value={normalizeReason(alert.reasonCode)} />
                    <SavedDetail label="Severity" value={labelize(alert.severity)} />
                    <SavedDetail
                      label={alert.currentSnapshot?.evaluatedAt ? 'Evaluated' : 'Created'}
                      value={
                        alert.currentSnapshot?.evaluatedAt
                          ? formatDate(alert.currentSnapshot.evaluatedAt)
                          : alert.createdAt
                            ? formatDate(alert.createdAt)
                            : 'n/a'
                      }
                    />
                    <SavedDetail
                      label="Opportunity"
                      value={formatOptionalPercent(alert.currentSnapshot?.opportunityScoreBps ?? null)}
                    />
                    <SavedDetail
                      label="Edge"
                      value={formatOptionalSignedBps(alert.currentSnapshot?.edgeBps ?? null)}
                    />
                    <SavedDetail
                      label="Probability gap"
                      value={formatOptionalSignedBps(alert.currentSnapshot?.probabilityGapBps ?? null)}
                    />
                    <SavedDetail
                      label="Data health"
                      value={formatOptionalPercent(alert.currentSnapshot?.dataHealthScoreBps ?? null)}
                    />
                    <SavedDetail
                      label="Time to expiry"
                      value={formatTimeToExpiry(alert.currentSnapshot?.timeToExpiryHours ?? null)}
                    />
                  </div>
                  <small>
                    {labelize(alert.sourceType)}
                    {alert.sourceLabel ? ` / ${alert.sourceLabel}` : ''}
                    {alert.orphaned ? ' / orphaned' : ''}
                  </small>
                  <div className="intelligence-saved-actions">
                    {alert.marketId ? (
                      <button
                        type="button"
                        onClick={() => void selectMarket(alert.marketId!)}
                        aria-label={`Open research for ${
                          savedMarketContextById.get(alert.marketId)?.asset ?? 'market'
                        }`}
                      >
                        Open research
                      </button>
                    ) : null}
                  {alert.readAt ? (
                    <button
                      type="button"
                      onClick={() => void markAlert(alert, 'unread')}
                      aria-label="Mark alert unread"
                    >
                      Mark unread
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void markAlert(alert, 'read')}
                      aria-label="Mark alert read"
                    >
                      Mark read
                    </button>
                  )}
                  <button
                  type="button"
                    onClick={() => void markAlert(alert, 'dismissed')}
                    aria-label="Dismiss alert"
                >
                    Dismiss
                  </button>
                  </div>
                </div>
              ))}
              {visibleAlerts.length === 0 ? (
                <p>No saved intelligence alerts after the latest refresh.</p>
              ) : null}
            </div>
          </div>

          <div className="intelligence-saved-card intelligence-queue-card intelligence-saved-card-feed">
            <h3>Daily Research Queue</h3>
            <div className="intelligence-saved-list">
              {dailyQueue.map((item) => (
                <div key={item.marketId}>
                  <strong>{item.asset}</strong>
                  <span>{item.question}</span>
                  <span>{item.summary}</span>
                  <div className="intelligence-saved-detail-grid">
                    <SavedDetail label="Reason" value={summarizeReasonCodes(item.reasonCodes)} />
                    <SavedDetail label="Severity" value={labelize(item.severity)} />
                    <SavedDetail label="Freshness" value={labelize(item.freshness)} />
                    <SavedDetail label="Unread alerts" value={String(item.unreadAlertCount)} />
                    <SavedDetail label="Opportunity" value={formatOptionalPercent(item.opportunityScoreBps)} />
                    <SavedDetail label="Edge" value={formatOptionalSignedBps(item.edgeBps)} />
                    <SavedDetail
                      label="Probability gap"
                      value={formatOptionalSignedBps(item.probabilityGapBps)}
                    />
                    <SavedDetail
                      label="Data health"
                      value={formatOptionalPercent(item.dataHealthScoreBps)}
                    />
                    <SavedDetail label="Expires" value={formatDate(item.expiresAt)} />
                    <SavedDetail label="Time to expiry" value={formatTimeToExpiry(item.timeToExpiryHours)} />
                  </div>
                  <small>{item.sourceTypes.map((sourceType) => labelize(sourceType)).join(', ')}</small>
                  <div className="intelligence-saved-actions">
                    <button
                      key={item.marketId}
                      type="button"
                      onClick={() => void openQueueItem(item)}
                      aria-label={`Open research for ${item.asset}`}
                    >
                      Open research for {item.asset}
                    </button>
                  </div>
                </div>
              ))}
              {dailyQueue.length === 0 ? (
                <p>Save a filter or watch a market to populate the daily research queue.</p>
              ) : null}
            </div>
          </div>
          </div>
        </div>
      </section>

      <section className="intelligence-layout">
        <section className="panel intelligence-market-panel" aria-labelledby="market-radar-title">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Research Priority</p>
              <h2 id="market-radar-title">Market Radar</h2>
            </div>
            <span className="panel-value">{marketCatalog.items.length}</span>
          </div>

          <div className="intelligence-controls" aria-label="Market radar filters">
            <label>
              Asset
              <select
                aria-label="Asset"
                value={marketFilters.asset}
                onChange={(event) =>
                  void updateMarketFilter(
                    'asset',
                    event.target.value as MarketCatalogFilters['asset']
                  )
                }
              >
                {assetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Condition type
              <select
                aria-label="Condition type"
                value={marketFilters.conditionType}
                onChange={(event) =>
                  void updateMarketFilter(
                    'conditionType',
                    event.target.value as MarketCatalogFilters['conditionType']
                  )
                }
              >
                {conditionOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Confidence
              <select
                aria-label="Confidence"
                value={marketFilters.confidence}
                onChange={(event) =>
                  void updateMarketFilter(
                    'confidence',
                    event.target.value as MarketCatalogFilters['confidence']
                  )
                }
              >
                {confidenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sort
              <select
                aria-label="Sort"
                value={marketFilters.sort}
                onChange={(event) =>
                  void updateMarketFilter('sort', event.target.value as MarketIntelligenceSort)
                }
              >
                {sortOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Source
              <select
                aria-label="Source"
                value={marketFilters.source}
                onChange={(event) =>
                  void updateMarketFilter(
                    'source',
                    event.target.value as MarketCatalogFilters['source']
                  )
                }
              >
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Min edge
              <input
                aria-label="Min edge"
                inputMode="numeric"
                min={0}
                max={5000}
                type="number"
                value={marketFilters.minEdgeBps}
                onChange={(event) =>
                  void updateMarketFilter(
                    'minEdgeBps',
                    Number(event.target.value || 0)
                  )
                }
              />
            </label>
            <label>
              Min liquidity
              <input
                aria-label="Min liquidity"
                inputMode="numeric"
                min={0}
                type="number"
                value={marketFilters.minLiquidity}
                onChange={(event) =>
                  void updateMarketFilter(
                    'minLiquidity',
                    Number(event.target.value || 0)
                  )
                }
              />
            </label>
            <label>
              Max expiry days
              <input
                aria-label="Max expiry days"
                inputMode="numeric"
                min={1}
                max={21}
                type="number"
                value={marketFilters.maxExpiryDays}
                onChange={(event) =>
                  void updateMarketFilter(
                    'maxExpiryDays',
                    Number(event.target.value || 1)
                  )
                }
              />
            </label>
          </div>

          <div className="intelligence-market-header" aria-hidden="true">
            <span>Market</span>
            <span>Implied</span>
            <span>Edge</span>
            <span>Priority</span>
            <span>Data health</span>
            <span>Risk</span>
            <span>Status</span>
          </div>
          <div className="intelligence-market-list">
            {marketCatalog.items.map((item) => (
              <MarketRow
                key={item.marketId}
                item={item}
                selected={item.marketId === selectedMarket?.marketId}
                onSelect={selectMarket}
              />
            ))}
            {marketCatalog.items.length === 0 ? (
              <EmptyState>Broaden filters to restore visible research candidates.</EmptyState>
            ) : null}
          </div>
        </section>

        <section className="panel intelligence-selected-panel" aria-label="Selected market summary">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Selected Market</p>
              <h2>{selectedMarket?.asset ?? 'No market selected'}</h2>
            </div>
            <span className="status-chip">{selectedMarket?.freshnessStatus ?? 'empty'}</span>
          </div>
          {selectedMarket ? (
            <>
              <p className="intelligence-question">{selectedMarket.question}</p>
              <div className="intelligence-score-stack">
                <ScoreBar label="Opportunity" score={selectedMarket.opportunityScoreBps} />
                <ScoreBar label="Data health" score={selectedMarket.dataHealthScoreBps} />
                <ScoreBar label="Risk" score={selectedMarket.riskScoreBps} />
              </div>
              <dl className="intelligence-facts">
                <div>
                  <dt>Implied</dt>
                  <dd>{formatPercent(selectedMarket.impliedProbabilityBps)}</dd>
                </div>
                <div>
                  <dt>Best agent</dt>
                  <dd>{selectedMarket.bestAgent?.agentName ?? 'none'}</dd>
                </div>
                <div>
                  <dt>Liquidity</dt>
                  <dd>{formatCompactNumber(selectedMarket.liquidity)}</dd>
                </div>
                <div>
                  <dt>Condition</dt>
                  <dd>{labelize(selectedMarket.conditionType)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{labelize(selectedMarket.source)}</dd>
                </div>
                <div>
                  <dt>Spread status</dt>
                  <dd>
                    {selectedMarket.spreadDiagnostics.reason ??
                      selectedMarket.spreadDiagnostics.status}
                  </dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>{formatDate(selectedMarket.expiresAt)}</dd>
                </div>
              </dl>
              <p className="intelligence-summary">{selectedMarket.summary}</p>
            </>
          ) : (
            <EmptyState>No market is available for the active filters.</EmptyState>
          )}
        </section>

        <section className="panel intelligence-research-panel" aria-labelledby="signal-research-title">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Deterministic Explanation</p>
              <h2 id="signal-research-title">Signal Research</h2>
            </div>
            <span className="status-chip">{research?.accountability.status ?? 'untracked'}</span>
          </div>
          {research ? (
            <>
              <div className="intelligence-probability-grid">
                <Metric
                  label="Market implied"
                  value={formatPercent(research.market.impliedProbabilityBps)}
                />
                <Metric
                  label="Probability gap"
                  value={formatSignedBps(probabilityGapBps)}
                  tone={Math.abs(probabilityGapBps) >= 1_000 ? 'amber' : 'neutral'}
                />
                <Metric
                  label="Comparable accuracy"
                  value={formatPercent(research.comparableOutcomes.accuracyBps)}
                  tone="mint"
                />
                <Metric
                  label="Comparable edge"
                  value={formatSignedBps(research.comparableOutcomes.averageEdgeBps)}
                />
                <Metric
                  label="Comparable resolved"
                  value={String(research.comparableOutcomes.resolvedCount)}
                />
                <Metric
                  label="Dry-run"
                  value={String(research.accountability.dryRunCount)}
                  tone={research.accountability.dryRunPresent ? 'mint' : 'neutral'}
                />
              </div>
              <div className="intelligence-agent-table">
                <div aria-hidden="true">
                  <span>Agent</span>
                  <span>Probability</span>
                  <span>Gap</span>
                  <span>Edge</span>
                  <span>Hashes</span>
                  <span>Risk flags</span>
                </div>
                {research.agentViews.map((agent) => (
                  <div key={agent.signalId}>
                    <strong>{agent.agentName}</strong>
                    <span>{formatPercent(agent.agentProbabilityBps)}</span>
                    <span>
                      {formatSignedBps(
                        agent.agentProbabilityBps - research.market.impliedProbabilityBps
                      )}
                    </span>
                    <span>{formatSignedBps(agent.edgeBps)}</span>
                    <span>
                      model {shortHash(agent.modelHash)}
                      <br />
                      data {shortHash(agent.dataHash)}
                    </span>
                    <span>{agent.riskFlags.join(', ') || 'balanced'}</span>
                  </div>
                ))}
              </div>
              <dl className="intelligence-facts intelligence-facts-tight">
                <div>
                  <dt>Primary driver</dt>
                  <dd>{research.drivers.primary}</dd>
                </div>
                <div>
                  <dt>Volatility drivers</dt>
                  <dd>{research.drivers.volatilityRiskFlags.join(', ') || 'balanced'}</dd>
                </div>
                <div>
                  <dt>Momentum drivers</dt>
                  <dd>{research.drivers.momentumRiskFlags.join(', ') || 'balanced'}</dd>
                </div>
                <div>
                  <dt>Market risk flags</dt>
                  <dd>{research.drivers.marketRiskFlags.join(', ') || 'none'}</dd>
                </div>
                <div>
                  <dt>Spread</dt>
                  <dd>{research.spreadDiagnostics.reason ?? research.spreadDiagnostics.status}</dd>
                </div>
                <div>
                  <dt>Resolved</dt>
                  <dd>{research.accountability.resolvedCount}</dd>
                </div>
                <div>
                  <dt>Source mix</dt>
                  <dd>
                    {research.accountability.resolutionSourceMix.automatic} auto /{' '}
                    {research.accountability.resolutionSourceMix.demo_admin} demo
                  </dd>
                </div>
              </dl>
              <p className="intelligence-summary">{research.summary}</p>
            </>
          ) : (
            <EmptyState>Select a market with agent output to load research.</EmptyState>
          )}
        </section>

        <section className="panel intelligence-agents-panel" aria-labelledby="agent-segments-title">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Reputation by Context</p>
              <h2 id="agent-segments-title">Agent Segments</h2>
            </div>
            <span className="panel-value">{agentRows.length}</span>
          </div>
          <div className="intelligence-controls intelligence-controls-compact">
            <label>
              Agent segment
              <select
                aria-label="Agent segment"
                value={agentFilters.groupBy}
                onChange={(event) =>
                  void updateAgentFilter('groupBy', event.target.value as AgentReputationGroupBy)
                }
              >
                {groupByOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Segment asset
              <select
                aria-label="Segment asset"
                value={agentFilters.asset}
                onChange={(event) =>
                  void updateAgentFilter(
                    'asset',
                    event.target.value as AgentReputationFilters['asset']
                  )
                }
              >
                {assetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Segment condition
              <select
                aria-label="Segment condition"
                value={agentFilters.conditionType}
                onChange={(event) =>
                  void updateAgentFilter(
                    'conditionType',
                    event.target.value as AgentReputationFilters['conditionType']
                  )
                }
              >
                {conditionOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Segment confidence
              <select
                aria-label="Segment confidence"
                value={agentFilters.confidence}
                onChange={(event) =>
                  void updateAgentFilter(
                    'confidence',
                    event.target.value as AgentReputationFilters['confidence']
                  )
                }
              >
                {confidenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Min resolved
              <input
                aria-label="Min resolved"
                inputMode="numeric"
                min={0}
                max={100}
                type="number"
                value={agentFilters.minResolved}
                onChange={(event) =>
                  void updateAgentFilter('minResolved', Number(event.target.value || 0))
                }
              />
            </label>
          </div>
          <div className="intelligence-segment-list">
            {agentRows.slice(0, 8).map((row) => (
              <div key={`${row.agentName}:${row.groupValue}`}>
                <span>
                  <strong>{row.agentName}</strong>
                  <small>
                    {row.groupBy}: {row.groupValue}
                  </small>
                </span>
                <span>
                  {row.resolvedCount}/{row.generatedCount} resolved
                  <br />
                  {row.committedCount} committed
                </span>
                <span>
                  {formatPercent(row.accuracyBps)} accuracy
                  <br />
                  Brier {row.brierScoreBps === null ? 'n/a' : formatPercent(row.brierScoreBps)}
                </span>
                <span>
                  Average edge {formatSignedBps(row.averageEdgeBps)}
                  <br />
                  Paper ROI {formatSignedBps(row.paperRoiBps)}
                </span>
                <span>
                  Bond / Refund / Slash
                  <br />
                  {formatMicroUsdc(row.bondedMicroUsdc)} / {formatMicroUsdc(row.refundedMicroUsdc)} /{' '}
                  {formatMicroUsdc(row.slashedMicroUsdc)}
                </span>
                <span>{row.insufficientData ? 'thin sample' : 'usable sample'}</span>
              </div>
            ))}
            {agentRows.length === 0 ? (
              <EmptyState>No agent segment rows match the active filters.</EmptyState>
            ) : null}
          </div>
        </section>

        <section className="panel intelligence-paper-panel" aria-labelledby="paper-follow-title">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Read-only Strategy Check</p>
              <h2 id="paper-follow-title">Paper-Follow / Backtest</h2>
            </div>
            <span className={paperResult.insufficientData ? 'status-chip status-amber' : 'status-chip status-ready'}>
              {paperResult.insufficientData ? 'thin sample' : 'sample ready'}
            </span>
          </div>
          <div className="intelligence-controls intelligence-controls-compact">
            <label>
              Paper agent
              <select
                aria-label="Paper agent"
                value={paperFilters.agentName}
                onChange={(event) =>
                  void updatePaperFilter(
                    'agentName',
                    event.target.value as PaperFollowFilters['agentName']
                  )
                }
              >
                {paperAgentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paper confidence
              <select
                aria-label="Paper confidence"
                value={paperFilters.confidence}
                onChange={(event) =>
                  void updatePaperFilter(
                    'confidence',
                    event.target.value as PaperFollowFilters['confidence']
                  )
                }
              >
                {confidenceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paper asset
              <select
                aria-label="Paper asset"
                value={paperFilters.asset}
                onChange={(event) =>
                  void updatePaperFilter(
                    'asset',
                    event.target.value as PaperFollowFilters['asset']
                  )
                }
              >
                {assetOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paper condition
              <select
                aria-label="Paper condition"
                value={paperFilters.conditionType}
                onChange={(event) =>
                  void updatePaperFilter(
                    'conditionType',
                    event.target.value as PaperFollowFilters['conditionType']
                  )
                }
              >
                {conditionOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Stake model
              <select
                aria-label="Stake model"
                value={paperFilters.stakeModel}
                onChange={(event) =>
                  void updatePaperFilter('stakeModel', event.target.value as PaperFollowStakeModel)
                }
              >
                {stakeModelOptions.map((option) => (
                  <option key={option} value={option}>
                    {labelize(option)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Paper min edge
              <input
                aria-label="Paper min edge"
                inputMode="numeric"
                min={0}
                max={5000}
                type="number"
                value={paperFilters.minEdgeBps}
                onChange={(event) =>
                  void updatePaperFilter('minEdgeBps', Number(event.target.value || 0))
                }
              />
            </label>
            <label>
              From
              <input
                aria-label="Paper from"
                type="datetime-local"
                value={toDatetimeLocal(paperFilters.from)}
                onChange={(event) =>
                  void updatePaperFilter('from', fromDatetimeLocal(event.target.value))
                }
              />
            </label>
            <label>
              To
              <input
                aria-label="Paper to"
                type="datetime-local"
                value={toDatetimeLocal(paperFilters.to)}
                onChange={(event) =>
                  void updatePaperFilter('to', fromDatetimeLocal(event.target.value))
                }
              />
            </label>
          </div>
          <div className="intelligence-probability-grid">
            <Metric label="Paper ROI" value={formatSignedBps(paperResult.paperRoiBps)} tone="mint" />
            <Metric label="Hit rate" value={formatPercent(paperResult.hitRateBps)} />
            <Metric
              label="Brier score"
              value={paperResult.brierScoreBps === null ? 'n/a' : formatPercent(paperResult.brierScoreBps)}
              tone="amber"
            />
            <Metric label="Max drawdown" value={formatSignedBps(-paperResult.maxDrawdownBps)} tone="risk" />
          </div>
          <dl className="intelligence-facts intelligence-facts-tight">
            <div>
              <dt>Assumptions</dt>
              <dd>{paperResult.assumptions.agentName} / {labelize(paperResult.assumptions.stakeModel)}</dd>
            </div>
            <div>
              <dt>Included</dt>
              <dd>{paperResult.includedCount}</dd>
            </div>
            <div>
              <dt>Unresolved</dt>
              <dd>{paperResult.unresolvedCount}</dd>
            </div>
            <div>
              <dt>Skipped</dt>
              <dd>{paperResult.skippedCount}</dd>
            </div>
            <div>
              <dt>Source mix</dt>
              <dd>
                {paperResult.sourceMix.automatic} auto / {paperResult.sourceMix.demo_admin} demo /{' '}
                {paperResult.sourceMix.unresolved} unresolved
              </dd>
            </div>
          </dl>
          <div className="intelligence-curve" aria-label="Paper-follow curve">
            {paperResult.curve.slice(-8).map((point) => (
              <span
                key={point.signalId}
                style={scoreStyle(Math.max(0, Math.min(10_000, point.cumulativeRoiBps + 5_000)))}
                title={`${point.signalId}: ${formatSignedBps(point.cumulativeRoiBps)}`}
              />
            ))}
            {paperResult.curve.length === 0 ? <span style={scoreStyle(5_000)} /> : null}
          </div>
          <div className="intelligence-breakdowns">
            <div>
              <h3>Breakdown by asset</h3>
              {paperResult.breakdownByAsset.slice(0, 4).map((row) => (
                <p key={row.key}>
                  <strong>{row.key}</strong>
                  <span>{row.resolvedCount}/{row.includedCount} resolved</span>
                  <span>{formatSignedBps(row.paperRoiBps)}</span>
                </p>
              ))}
              {paperResult.breakdownByAsset.length === 0 ? <p>No resolved asset rows yet.</p> : null}
            </div>
            <div>
              <h3>Breakdown by condition</h3>
              {paperResult.breakdownByConditionType.slice(0, 4).map((row) => (
                <p key={row.key}>
                  <strong>{labelize(row.key)}</strong>
                  <span>{row.resolvedCount}/{row.includedCount} resolved</span>
                  <span>{formatSignedBps(row.paperRoiBps)}</span>
                </p>
              ))}
              {paperResult.breakdownByConditionType.length === 0 ? (
                <p>No resolved condition rows yet.</p>
              ) : null}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
