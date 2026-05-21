'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, useTransition } from 'react';
import { buildArcTxUrl } from '@/lib/arc/explorer';
import type { AgentSignal, ParsedCryptoMarket } from '@/lib/polymarket/types';
import type {
  ArenaMetrics,
  ArenaState,
  AutonomousRunRecord,
  AutonomyQueueEntry
} from '@/lib/persistence/store';
import { isSignalEligibleForCommit } from '@/lib/utils/signal';

interface ArenaDashboardProps {
  initialMetrics: ArenaMetrics;
  initialState: ArenaState;
}

interface MarketsResponse {
  source: 'live' | 'demo_snapshot';
  fallbackReason?: string;
  markets: ParsedCryptoMarket[];
}

interface RunAgentsResponse extends MarketsResponse {
  signals: AgentSignal[];
  metrics: ArenaMetrics;
}

interface CommitResponse {
  reason?: string;
  signal?: AgentSignal;
  txHash?: `0x${string}`;
}

interface AgentPolicyView {
  mode: 'OFF' | 'DRY_RUN' | 'LIVE';
  maxDailyBondUsdc6: number;
  maxSignalsPerDay: number;
  maxStakePerSignalUsdc6: number;
  maxOpenSignals: number;
  minEdgeBps: number;
}

interface ArcWalletReadinessView {
  publicAddress: `0x${string}` | null;
  usdcBalanceMicroUsdc: string | null;
  allowanceMicroUsdc: string | null;
}

interface ArcControlRoomView {
  status: 'ready' | 'degraded';
  reason: string | null;
  chainId: number;
  arenaAddress: `0x${string}` | null;
  usdcAddress: `0x${string}`;
  usdcDecimals: number;
  commitAvailable: boolean;
  latestTxHash: `0x${string}` | null;
  wallets: Record<'volatility' | 'momentum', ArcWalletReadinessView>;
}

interface AutonomyResponse {
  policies: Record<'volatility' | 'momentum', AgentPolicyView>;
  metrics: ArenaMetrics;
  runs: AutonomousRunRecord[];
  controlRoom: ArcControlRoomView;
}

interface AutonomyViewState {
  policies: Record<'volatility' | 'momentum', AgentPolicyView> | null;
  runs: AutonomousRunRecord[];
  controlRoom: ArcControlRoomView | null;
  error: string | null;
}

type CommitResult =
  | {
      status: 'committed';
      signalId: string;
      txHash: `0x${string}`;
    }
  | {
      status: 'disabled';
      signalId: string;
      reason: string;
    };

type Language = 'en' | 'zh';
type ThemeMode = 'light' | 'dark';
type ScanSource = 'live' | 'demo_snapshot' | 'idle';

interface ScanFeedback {
  changedCount: number;
  hash: string;
  scannedAt: string;
  source: ScanSource;
}

const copy = {
  en: {
    agent: 'Agent',
    agentOutput: 'Agent Output',
    agentProbability: 'Agent Probability',
    arcCommit: 'Arc commit',
    arcCommitLane: 'Arc Commit Lane',
    arcLane: 'Arc lane',
    arcMode: 'Agent custody',
    arcSettlement: 'Settlement Rail',
    arcStatus: 'Arc status',
    assetStrike: 'Asset / Strike',
    awaitingForecast: 'Awaiting forecast',
    avgEdge: 'Avg edge',
    bond: 'Bond',
    cappedKelly: 'Capped Kelly',
    commitArmed: 'armed',
    commitBlocked: 'Commit blocked',
    commitConfirmed: 'Commit confirmed',
    commitEligible: 'Commit Eligible Signals',
    commitGuarded: 'guarded',
    commitToArc: 'Commit to Arc',
    confidence: 'Confidence',
    decision: 'Decision',
    deterministicAgentOutput: 'Deterministic agent output',
    edge: 'Edge',
    expiry: 'Expiry',
    fallback: 'Fallback',
    forecastVisualLabel: 'PredictArena live probability radar',
    languageLabel: '中文',
    latestSignal: 'Latest signal',
    latestSweep: 'Latest sweep',
    leaderboard: 'Leaderboard',
    lightThemeLabel: 'Light',
    marketPrice: 'Market Price',
    marketScanRail: 'Market Scan Rail',
    marketsScanned: 'Markets Scanned',
    noParsedMarkets: 'No parsed markets yet. Trigger a scan to load the rail.',
    noRiskFlags: 'No risk flags in generated signals.',
    noSignal: 'Signals will appear here after you click Run Agents.',
    openSignal: 'Open Signal Detail',
    parsedMarkets: 'Parsed Markets',
    predictionKicker: 'Arc Forecast Arena',
    probabilityRail: 'Probability Rail',
    proofPack: 'Proof Pack',
    reScan: 'Re-Scan Markets',
    riskDiagnostics: 'Risk Diagnostics',
    riskFlags: 'Risk Flags',
    runAgents: 'Run Agents',
    runAgentsToPopulate: 'Run agents to populate the commitment rail.',
    runAgentsToRank: 'Run agents to rank assets.',
    scanComplete: 'scan complete with',
    scanControl: 'Scan Control',
    scanDelta: 'Scan delta',
    scanHash: 'Scan hash',
    scout: 'Scout',
    signalBelowThreshold: 'Signal below commit threshold',
    signalBoard: 'Signal Board',
    signals: 'Signals',
    resolvedSignals: 'Resolved',
    skipped: 'Skipped',
    source: 'Source',
    status: 'Status',
    strike: 'Strike',
    subtitle:
      'Autonomous agents scan crypto prediction markets, price quantified edge, and commit USDC signal bonds on Arc.',
    themeLabel: 'Night',
    usdcBonded: 'USDC Bonded',
    yesPrice: 'YES Price'
  },
  zh: {
    agent: '智能体',
    agentOutput: '智能体输出',
    agentProbability: '智能体概率',
    arcCommit: 'Arc 提交',
    arcCommitLane: 'Arc 提交通道',
    arcLane: 'Arc 通道',
    arcMode: '智能体托管',
    arcSettlement: '结算轨道',
    arcStatus: 'Arc 状态',
    assetStrike: '资产 / 阈值',
    awaitingForecast: '等待预测',
    avgEdge: '平均优势',
    bond: '保证金',
    cappedKelly: 'Kelly 上限',
    commitArmed: '就绪',
    commitBlocked: '提交受阻',
    commitConfirmed: '提交确认',
    commitEligible: '提交合格信号',
    commitGuarded: '守卫中',
    commitToArc: '提交到 Arc',
    confidence: '置信度',
    decision: '决策',
    deterministicAgentOutput: '确定性智能体输出',
    edge: '优势',
    expiry: '到期',
    fallback: '回退',
    forecastVisualLabel: 'PredictArena 实时概率雷达',
    languageLabel: 'EN',
    latestSignal: '最新信号',
    latestSweep: '最新扫描',
    leaderboard: '排行榜',
    lightThemeLabel: '日间',
    marketPrice: '市场价格',
    marketScanRail: '市场扫描轨道',
    marketsScanned: '扫描市场',
    noParsedMarkets: '暂无可解析市场。触发扫描以加载轨道。',
    noRiskFlags: '生成信号没有风险标记。',
    noSignal: '点击运行智能体后，信号会出现在这里。',
    openSignal: '打开信号详情',
    parsedMarkets: '可解析市场',
    predictionKicker: 'Arc 预测竞技场',
    probabilityRail: '概率轨道',
    proofPack: '证明包',
    reScan: '重新扫描市场',
    riskDiagnostics: '风险诊断',
    riskFlags: '风险标记',
    runAgents: '运行智能体',
    runAgentsToPopulate: '运行智能体以填充提交通道。',
    runAgentsToRank: '运行智能体以生成资产排名。',
    scanComplete: '扫描完成，变化候选数',
    scanControl: '扫描控制',
    scanDelta: '扫描变化',
    scanHash: '扫描哈希',
    scout: '侦察分',
    signalBelowThreshold: '信号低于提交阈值',
    signalBoard: '信号看板',
    signals: '信号',
    resolvedSignals: '已结算',
    skipped: '跳过',
    source: '来源',
    status: '状态',
    strike: '阈值',
    subtitle: '自主智能体扫描加密预测市场、计算量化优势，并在 Arc 上提交 USDC 信号债券。',
    themeLabel: '夜间',
    usdcBonded: '已绑定 USDC',
    yesPrice: 'YES 价格'
  }
} as const;

function Icon({
  name
}: {
  name: 'bolt' | 'chart' | 'globe' | 'moon' | 'radar' | 'scan' | 'sun' | 'wallet';
}) {
  const common = {
    'aria-hidden': true,
    className: 'mini-icon',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24'
  } as const;

  if (name === 'sun') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
      </svg>
    );
  }

  if (name === 'moon') {
    return (
      <svg {...common}>
        <path d="M20 14.8A7.6 7.6 0 0 1 9.2 4 8 8 0 1 0 20 14.8Z" />
      </svg>
    );
  }

  if (name === 'globe') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M3.6 9h16.8M3.6 15h16.8M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    );
  }

  if (name === 'scan') {
    return (
      <svg {...common}>
        <path d="M7 3H5a2 2 0 0 0-2 2v2M17 3h2a2 2 0 0 1 2 2v2M7 21H5a2 2 0 0 1-2-2v-2M17 21h2a2 2 0 0 0 2-2v-2M5 12h14" />
      </svg>
    );
  }

  if (name === 'bolt') {
    return (
      <svg {...common}>
        <path d="m13 2-8 12h6l-1 8 9-13h-6V2Z" />
      </svg>
    );
  }

  if (name === 'wallet') {
    return (
      <svg {...common}>
        <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19v14H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
        <path d="M16 12h4" />
      </svg>
    );
  }

  if (name === 'chart') {
    return (
      <svg {...common}>
        <path d="M4 19V5M4 19h16M7 15l4-4 3 3 5-7" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function formatSourceLabel(source: string | undefined, language: Language) {
  if (source === 'demo_snapshot') {
    return language === 'zh' ? '演示快照' : 'demo snapshot';
  }

  if (source === 'live') {
    return language === 'zh' ? '实时' : 'live';
  }

  return language === 'zh' ? '未扫描' : 'not scanned';
}

function formatPercent(bps: number) {
  return `${(bps / 100).toFixed(2)}%`;
}

function formatUsd(value: number) {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatUsdMicro(micro: number) {
  return `$${(micro / 1_000_000).toFixed(2)}`;
}

function formatUsdMicroValue(micro: number | string | null | undefined) {
  if (micro === null || micro === undefined) {
    return 'Unavailable';
  }

  const numeric = typeof micro === 'string' ? Number(micro) : micro;
  if (!Number.isFinite(numeric)) {
    return 'Unavailable';
  }

  return formatUsdMicro(numeric);
}

function truncateHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function truncateAddress(address: string | null | undefined) {
  if (!address) {
    return 'Not configured';
  }

  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatTimestampLabel(value?: string) {
  if (!value) {
    return 'pending';
  }

  return value.slice(0, 16).replace('T', ' ');
}

function signalDecisionClass(signal: AgentSignal) {
  if (signal.side === 'YES') {
    return 'decision-buy_yes';
  }

  if (signal.side === 'NO') {
    return 'decision-buy_no';
  }

  return 'decision-avoid';
}

function marketDirection(market: ParsedCryptoMarket) {
  return market.conditionType.replace('_', ' ');
}

function agentDisplayName(agentName: AgentSignal['agentName']) {
  return agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';
}

function buildSignalReasons(signal: AgentSignal, language: Language) {
  const riskLine =
    signal.riskFlags.length > 0
      ? language === 'zh'
        ? `风险标记：${signal.riskFlags.join(', ')}`
        : `Risk flags: ${signal.riskFlags.join(', ')}`
      : language === 'zh'
        ? '风险智能体已放行该信号。'
        : 'Risk agent cleared this signal.';

  if (language === 'zh') {
    return [
      `${signal.modelVersion} 估计概率 ${formatPercent(signal.agentProbabilityBps)}，市场价格 ${formatPercent(signal.marketPriceBps)}。`,
      `${riskLine} Kelly 上限为 ${formatPercent(signal.kellyBps)}。`
    ];
  }

  return [
    `${signal.modelVersion} priced ${formatPercent(signal.agentProbabilityBps)} vs market ${formatPercent(signal.marketPriceBps)}.`,
    `${riskLine} Kelly capped at ${formatPercent(signal.kellyBps)}.`
  ];
}

function buildAssetLeaderboard(signals: AgentSignal[]) {
  const grouped = new Map<string, AgentSignal[]>();
  for (const signal of signals) {
    grouped.set(signal.asset, [...(grouped.get(signal.asset) ?? []), signal]);
  }

  return [...grouped.entries()]
    .map(([asset, assetSignals]) => {
      const scoreBps = Math.round(
        assetSignals.reduce((sum, signal) => sum + signal.edgeBps, 0) / assetSignals.length
      );

      return {
        asset,
        committedCount: assetSignals.filter((signal) => signal.arcTxHash).length,
        scoreBps,
        signalCount: assetSignals.length
      };
    })
    .sort((a, b) => b.scoreBps - a.scoreBps);
}

function computeScanHash(markets: ParsedCryptoMarket[]) {
  const source = markets
    .map((market) => `${market.id}:${market.yesPriceBps}:${market.noPriceBps}:${market.scoutScoreBps}`)
    .join('|');
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
}

function countMarketChanges(previousMarkets: ParsedCryptoMarket[], nextMarkets: ParsedCryptoMarket[]) {
  const previous = new Map(
    previousMarkets.map((market) => [
      market.id,
      `${market.yesPriceBps}:${market.noPriceBps}:${market.scoutScoreBps}`
    ])
  );
  const next = new Map(
    nextMarkets.map((market) => [
      market.id,
      `${market.yesPriceBps}:${market.noPriceBps}:${market.scoutScoreBps}`
    ])
  );

  let changes = 0;
  for (const [id, signature] of next) {
    if (previous.get(id) !== signature) {
      changes += 1;
    }
  }

  for (const id of previous.keys()) {
    if (!next.has(id)) {
      changes += 1;
    }
  }

  return changes;
}

function findAssetMarket(markets: ParsedCryptoMarket[], asset: ParsedCryptoMarket['asset']) {
  return markets.find((market) => market.asset === asset);
}

function buildDerivedQueue(signals: AgentSignal[], lastCommitResult: CommitResult | null): AutonomyQueueEntry[] {
  return signals.slice(0, 8).map((signal) => {
    const committed = Boolean(signal.arcTxHash);
    const eligible = isSignalEligibleForCommit(signal);
    const failed =
      lastCommitResult?.status === 'disabled' && lastCommitResult.signalId === signal.id
        ? lastCommitResult.reason
        : null;

    return {
      signalId: signal.id,
      agentName: signal.agentName,
      status: committed ? 'committed' : failed ? 'commit_failed' : eligible ? 'dry_run_eligible' : 'not_eligible',
      reason: failed ?? (eligible ? null : signal.side === 'AVOID' ? 'signal_side_avoid' : 'below_policy_threshold'),
      txHash: signal.arcTxHash,
      edgeBps: signal.edgeBps,
      stakeMicroUsdc: signal.stakeMicroUsdc
    };
  });
}

function queueStatusLabel(status: AutonomyQueueEntry['status']) {
  const labels: Record<AutonomyQueueEntry['status'], string> = {
    not_eligible: 'Not eligible',
    mode_off: 'Mode off',
    policy_blocked: 'Policy blocked',
    claim_blocked: 'Claim blocked',
    dry_run_eligible: 'Dry-run eligible',
    committed: 'Committed',
    commit_failed: 'Commit failed'
  };

  return labels[status];
}

export function ArenaDashboard({ initialMetrics, initialState }: ArenaDashboardProps) {
  const [arena, setArena] = useState(initialState);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [autonomy, setAutonomy] = useState<AutonomyViewState>({
    policies: null,
    runs: initialState.autonomyRuns ?? [],
    controlRoom: null,
    error: null
  });
  const [lastCommitResult, setLastCommitResult] = useState<CommitResult | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(() => ({
    changedCount: initialState.markets.length,
    hash: computeScanHash(initialState.markets),
    scannedAt: initialState.latestScan?.scannedAt ?? new Date().toISOString(),
    source: initialState.latestScan?.source ?? 'idle'
  }));
  const [isPending, startTransition] = useTransition();
  const t = copy[language];

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  }, [language, theme]);

  const refreshAutonomy = useCallback(async () => {
    try {
      const response = await fetch('/api/autonomy', { headers: { accept: 'application/json' } });
      const payload = (await response.json()) as AutonomyResponse;
      if (!response.ok) {
        throw new Error('Autonomy state unavailable.');
      }

      setAutonomy({
        policies: payload.policies,
        runs: payload.runs ?? [],
        controlRoom: payload.controlRoom,
        error: null
      });
      setMetrics(payload.metrics);
    } catch (error) {
      setAutonomy((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Autonomy state unavailable.'
      }));
    }
  }, []);

  useEffect(() => {
    void refreshAutonomy();
  }, [refreshAutonomy]);

  async function refreshMarkets() {
    const response = await fetch('/api/markets', { headers: { accept: 'application/json' } });
    const payload = (await response.json()) as MarketsResponse;
    if (!response.ok) {
      throw new Error('Market scan failed.');
    }

    const scannedAt = new Date().toISOString();
    setScanFeedback({
      changedCount: countMarketChanges(arena.markets, payload.markets),
      hash: computeScanHash(payload.markets),
      scannedAt,
      source: payload.source
    });
    setArena((current) => ({
      ...current,
      latestScan: {
        fallbackReason: payload.fallbackReason,
        marketCount: payload.markets.length,
        scannedAt,
        source: payload.source
      },
      markets: payload.markets
    }));
  }

  async function runAgents() {
    const response = await fetch('/api/run-agents', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ limit: 20 })
    });
    const payload = (await response.json()) as RunAgentsResponse;
    if (!response.ok) {
      throw new Error('Agent run failed.');
    }

    const generatedAt = new Date().toISOString();
    setScanFeedback({
      changedCount: countMarketChanges(arena.markets, payload.markets),
      hash: computeScanHash(payload.markets),
      scannedAt: generatedAt,
      source: payload.source
    });
    setArena({
      latestScan: {
        fallbackReason: payload.fallbackReason,
        marketCount: payload.markets.length,
        scannedAt: generatedAt,
        source: payload.source
      },
      lastRun: {
        generatedAt,
        runId: `run:${Date.now()}`,
        source: payload.source
      },
      markets: payload.markets,
      signals: payload.signals,
      autonomyRuns: arena.autonomyRuns
    });
    setMetrics(payload.metrics);
    await refreshAutonomy();
  }

  async function commitSignal(signal: AgentSignal) {
    const response = await fetch('/api/commit-signal', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ signalId: signal.id })
    });
    const payload = (await response.json()) as CommitResponse;

    if (!response.ok || !payload.signal || !payload.txHash) {
      setLastCommitResult({
        reason: payload.reason ?? 'Commit failed.',
        signalId: signal.id,
        status: 'disabled'
      });
      return;
    }

    const committedSignal = payload.signal;
    setArena((current) => ({
      ...current,
      signals: current.signals.map((currentSignal) =>
        currentSignal.id === committedSignal.id ? committedSignal : currentSignal
      )
    }));
    setMetrics((current) => ({
      ...current,
      committedSignals: current.committedSignals + 1,
      totalBondedMicroUsdc: current.totalBondedMicroUsdc + committedSignal.stakeMicroUsdc
    }));
    setLastCommitResult({
      signalId: signal.id,
      status: 'committed',
      txHash: payload.txHash
    });
    await refreshAutonomy();
  }

  async function commitEligibleSignals() {
    const pendingEligibleSignals = arena.signals.filter(
      (signal) => isSignalEligibleForCommit(signal) && !signal.arcTxHash
    );

    if (pendingEligibleSignals.length === 0) {
      setLastCommitResult({
        reason: 'No medium/high eligible signals are waiting for Arc commit.',
        signalId: 'eligible-signals',
        status: 'disabled'
      });
      return;
    }

    for (const signal of pendingEligibleSignals) {
      await commitSignal(signal);
    }
  }

  function runAction(action: () => Promise<void>) {
    startTransition(async () => {
      try {
        await action();
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown dashboard action error.';
        setLastCommitResult({
          reason,
          signalId: 'dashboard',
          status: 'disabled'
        });
      }
    });
  }

  const sourceLabel = formatSourceLabel(arena.latestScan?.source, language);
  const fallbackReason = arena.latestScan?.fallbackReason;
  const latestSignal = arena.signals[0];
  const eligibleSignals = arena.signals.filter(
    (signal) => isSignalEligibleForCommit(signal) && !signal.arcTxHash
  );
  const assetLeaderboard = buildAssetLeaderboard(arena.signals);
  const scannedMarkets = arena.latestScan?.marketCount ?? arena.markets.length;
  const skippedMarkets = Math.max(scannedMarkets - arena.markets.length, 0);
  const commitArmed = eligibleSignals.length > 0;
  const btcMarket = findAssetMarket(arena.markets, 'BTC');
  const ethMarket = findAssetMarket(arena.markets, 'ETH');
  const solMarket = findAssetMarket(arena.markets, 'SOL');
  const latestAutonomyRun = autonomy.runs[0];
  const queueRows =
    latestAutonomyRun?.queue && latestAutonomyRun.queue.length > 0
      ? latestAutonomyRun.queue.slice(0, 8)
      : buildDerivedQueue(arena.signals, lastCommitResult);

  return (
    <main className="arena-shell" data-theme={theme}>
      <nav className="arena-topbar" aria-label="PredictArena controls">
        <Link href="/arena" className="brand-lockup" aria-label="PredictArena arena">
          <span className="brand-mark" aria-hidden="true" />
          <span>PredictArena</span>
        </Link>
        <div className="topbar-actions">
          <Link href="/leaderboard" className="icon-link">
            <Icon name="chart" />
            {t.leaderboard}
          </Link>
          <Link href="/proof" className="icon-link">
            <Icon name="wallet" />
            {t.proofPack}
          </Link>
          <button
            type="button"
            className="icon-button"
            onClick={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
            aria-label="Toggle theme"
          >
            <Icon name={theme === 'light' ? 'sun' : 'moon'} />
            {theme === 'light' ? t.themeLabel : t.lightThemeLabel}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={() => setLanguage((current) => (current === 'en' ? 'zh' : 'en'))}
          >
            <Icon name="globe" />
            {t.languageLabel}
          </button>
        </div>
      </nav>

      <section className="command-deck">
        <div className="deck-copy">
          <p className="deck-kicker">
            <Icon name="radar" />
            {t.predictionKicker}
          </p>
          <h1>PredictArena</h1>
          <p className="deck-summary">{t.subtitle}</p>
          <div className="deck-status-row">
            <span className={`status-chip status-${arena.latestScan?.source ?? 'idle'}`}>
              <Icon name="scan" />
              {t.source}: {sourceLabel}
            </span>
            <span className={`status-chip ${commitArmed ? 'status-ready' : 'status-risk'}`}>
              <Icon name="wallet" />
              {t.arcCommit}: {commitArmed ? t.commitArmed : t.commitGuarded}
            </span>
            {fallbackReason ? (
              <span className="status-chip status-amber">
                <Icon name="bolt" />
                {t.fallback}: {fallbackReason}
              </span>
            ) : null}
          </div>
        </div>

        <div className="deck-visual" role="img" aria-label={t.forecastVisualLabel}>
          <div className="forecast-panel">
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
              {[
                { asset: 'BTC', market: btcMarket, fallback: 5200 },
                { asset: 'ETH', market: ethMarket, fallback: 4200 },
                { asset: 'SOL', market: solMarket, fallback: 3600 }
              ].map((entry) => (
                <div key={entry.asset} className="probability-row">
                  <span>{entry.asset}</span>
                  <strong>{entry.market ? formatPercent(entry.market.yesPriceBps) : '--'}</strong>
                  <div className="probability-track">
                    <span style={{ width: `${(entry.market?.yesPriceBps ?? entry.fallback) / 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="deck-metrics">
          <article className="metric-card">
            <span>
              <Icon name="scan" />
              {t.marketsScanned}
            </span>
            <strong>{scannedMarkets}</strong>
            <small>{t.latestSweep}</small>
          </article>
          <article className="metric-card">
            <span>
              <Icon name="radar" />
              {t.parsedMarkets}
            </span>
            <strong>{arena.markets.length}</strong>
            <small>Scan {formatTimestampLabel(arena.latestScan?.scannedAt)}</small>
          </article>
          <article className="metric-card">
            <span>
              <Icon name="bolt" />
              {t.signals}
            </span>
            <strong>{arena.signals.length || metrics.generatedSignals}</strong>
            <small>
              {metrics.resolvedSignals} {t.resolvedSignals}
            </small>
          </article>
          <article className="metric-card">
            <span>
              <Icon name="wallet" />
              {t.usdcBonded}
            </span>
            <strong>{formatUsdMicro(metrics.totalBondedMicroUsdc)}</strong>
            <small>{metrics.committedSignals} committed</small>
          </article>
        </div>
      </section>

      <section className="ops-grid">
        <article className="panel autonomy-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Scheduled Agents</p>
              <h2>Autonomy Panel</h2>
            </div>
            <span className="panel-value">{autonomy.runs.length}</span>
          </div>

          {autonomy.error ? <p className="muted">{autonomy.error}</p> : null}

          <div className="autonomy-sections">
            <section>
              <h3>Mode by Agent</h3>
              <div className="policy-grid">
                {(['volatility', 'momentum'] as const).map((agentName) => {
                  const policy = autonomy.policies?.[agentName];
                  return (
                    <article key={agentName} className="policy-card">
                      <span className={`status-chip ${policy?.mode === 'LIVE' ? 'status-ready' : policy?.mode === 'OFF' ? 'status-risk' : 'status-amber'}`}>
                        {policy?.mode ?? 'LOADING'}
                      </span>
                      <strong>{agentDisplayName(agentName)}</strong>
                      <small>Min edge {policy ? formatPercent(policy.minEdgeBps) : 'pending'}</small>
                    </article>
                  );
                })}
              </div>
            </section>

            <section>
              <h3>Budget Utilization</h3>
              <div className="budget-grid">
                {(latestAutonomyRun?.budgetSnapshots ?? []).map((snapshot) => (
                  <article key={snapshot.agentName} className="budget-card">
                    <span>{agentDisplayName(snapshot.agentName)}</span>
                    <strong>
                      {formatUsdMicro(snapshot.dailyBondUsedUsdc6)} / {formatUsdMicro(snapshot.policy.maxDailyBondUsdc6)}
                    </strong>
                    <small>
                      {snapshot.signalsUsedToday}/{snapshot.policy.maxSignalsPerDay} daily signals, {snapshot.openSignals}/{snapshot.policy.maxOpenSignals} open
                    </small>
                  </article>
                ))}
                {!latestAutonomyRun?.budgetSnapshots?.length ? (
                  <article className="budget-card">
                    <span>Budget Pending</span>
                    <strong>No autonomous run yet</strong>
                    <small>Dry-run history will populate this panel after cron executes.</small>
                  </article>
                ) : null}
              </div>
            </section>

            <section>
              <h3>Recent Autonomous Runs</h3>
              <ul className="run-history-list">
                {autonomy.runs.slice(0, 4).map((run) => (
                  <li key={run.runId}>
                    <div>
                      <Link href={`/autonomy/runs/${encodeURIComponent(run.runId)}`}>
                        <strong>{formatTimestampLabel(run.triggeredAt)}</strong>
                      </Link>
                      <span>{run.source} · {run.generatedSignalCount} generated</span>
                    </div>
                    <div className="leaderboard-metric">
                      <strong>{run.committedCount ?? 0} live / {run.dryRunCount ?? 0} dry</strong>
                      <span>{run.skippedCount ?? 0} skipped</span>
                    </div>
                  </li>
                ))}
                {autonomy.runs.length === 0 ? (
                  <li className="plain-list-item">No scheduled run has been recorded yet.</li>
                ) : null}
              </ul>
            </section>
          </div>
        </article>

        <article className="panel control-room-panel">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Arc Readiness</p>
              <h2>Agent Control Room</h2>
            </div>
            <span className={`status-chip ${autonomy.controlRoom?.commitAvailable ? 'status-ready' : 'status-risk'}`}>
              {autonomy.controlRoom?.status ?? 'loading'}
            </span>
          </div>

          <div className="control-room-grid">
            <article>
              <span>Commit Availability</span>
              <strong>{autonomy.controlRoom?.commitAvailable ? 'Available' : 'Guarded'}</strong>
              <small>{autonomy.controlRoom?.reason ?? 'Ready for Arc signal bonds'}</small>
            </article>
            <article>
              <span>Contract</span>
              <strong>{truncateAddress(autonomy.controlRoom?.arenaAddress)}</strong>
              <small>Arc chain {autonomy.controlRoom?.chainId ?? 'pending'}</small>
            </article>
            <article>
              <span>Latest Arc Tx</span>
              <strong>
                {autonomy.controlRoom?.latestTxHash ? truncateHash(autonomy.controlRoom.latestTxHash) : 'Pending'}
              </strong>
              <small>{autonomy.controlRoom?.usdcDecimals ?? 6} USDC decimals</small>
            </article>
          </div>

          <section>
            <h3>Wallet Readiness</h3>
            <div className="wallet-readiness-list">
              {(['volatility', 'momentum'] as const).map((agentName) => {
                const wallet = autonomy.controlRoom?.wallets[agentName];
                return (
                  <article key={agentName}>
                    <div>
                      <strong>{agentDisplayName(agentName)}</strong>
                      <span>{truncateAddress(wallet?.publicAddress)}</span>
                    </div>
                    <div>
                      <span>USDC balance</span>
                      <strong>{formatUsdMicroValue(wallet?.usdcBalanceMicroUsdc)}</strong>
                    </div>
                    <div>
                      <span>Allowance</span>
                      <strong>{formatUsdMicroValue(wallet?.allowanceMicroUsdc)}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </article>
      </section>

      <section className="war-room-grid">
        <article className="panel rail-panel market-rail">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">{t.scanControl}</p>
              <h2>{t.marketScanRail}</h2>
            </div>
            <span className="panel-value">{arena.markets.length}</span>
          </div>

          <div className="control-stack">
            <button type="button" onClick={() => runAction(refreshMarkets)} disabled={isPending}>
              <Icon name="scan" />
              {t.reScan}
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => runAction(runAgents)}
              disabled={isPending}
            >
              <Icon name="bolt" />
              {t.runAgents}
            </button>
            <button
              type="button"
              className="wide-button"
              onClick={() => runAction(commitEligibleSignals)}
              disabled={isPending || eligibleSignals.length === 0}
            >
              <Icon name="wallet" />
              {t.commitEligible}
            </button>
          </div>

          <dl className="rail-stats">
            <div>
              <dt>{t.source}</dt>
              <dd>{sourceLabel}</dd>
            </div>
            <div>
              <dt>{t.skipped}</dt>
              <dd>{skippedMarkets}</dd>
            </div>
            <div>
              <dt>{t.fallback}</dt>
              <dd>{fallbackReason ?? 'none'}</dd>
            </div>
            <div>
              <dt>{t.avgEdge}</dt>
              <dd>{formatPercent(metrics.averageEdgeBps)}</dd>
            </div>
            <div>
              <dt>{t.scanHash}</dt>
              <dd>{scanFeedback.hash}</dd>
            </div>
            <div>
              <dt>{t.scanDelta}</dt>
              <dd>{scanFeedback.changedCount}</dd>
            </div>
          </dl>

          <div className={`scan-readout scan-${scanFeedback.source}`}>
            <span className="scan-line" />
            <p>
              {language === 'zh'
                ? `${formatTimestampLabel(scanFeedback.scannedAt)} ${t.scanComplete}: ${scanFeedback.changedCount}`
                : `${formatTimestampLabel(scanFeedback.scannedAt)} ${t.scanComplete} ${scanFeedback.changedCount} candidate change(s).`}
            </p>
          </div>

          <div className="market-list">
            {arena.markets.map((market) => (
              <section key={market.id} className="market-card">
                <div className="market-card-header">
                  <p className="market-asset">{market.asset}</p>
                  <span className="market-direction">{marketDirection(market)}</span>
                </div>
                <h3>{market.question}</h3>
                <dl className="market-metrics">
                  <div>
                    <dt>{t.strike}</dt>
                    <dd>{formatUsd(market.thresholdUsd)}</dd>
                  </div>
                  <div>
                    <dt>YES</dt>
                    <dd>{formatPercent(market.yesPriceBps)}</dd>
                  </div>
                  <div>
                    <dt>NO</dt>
                    <dd>{formatPercent(market.noPriceBps)}</dd>
                  </div>
                  <div>
                    <dt>{t.scout}</dt>
                    <dd>{formatPercent(market.scoutScoreBps)}</dd>
                  </div>
                </dl>
                <div className="market-spark" aria-hidden="true">
                  <span style={{ width: `${market.yesPriceBps / 100}%` }} />
                </div>
              </section>
            ))}
            {arena.markets.length === 0 ? (
              <div className="empty-card">
                <p>{t.noParsedMarkets}</p>
              </div>
            ) : null}
          </div>
        </article>

        <article className="panel signal-board">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">{t.agentOutput}</p>
              <h2>{t.signalBoard}</h2>
            </div>
            <span className="panel-value">{arena.signals.length}</span>
          </div>

          <div className="signal-board-meta">
            <span>{t.decision}</span>
            <span>{t.confidence}</span>
            <span>{t.edge}</span>
            <span>{t.arcLane}</span>
          </div>

          <section className="commit-queue-panel">
            <div className="subpanel-header">
              <p className="panel-kicker">Batch Commit</p>
              <h2>Commit Queue</h2>
            </div>
            <div className="queue-header">
              <span>Signal</span>
              <span>Policy Decision</span>
              <span>Approve State</span>
              <span>Failure / Tx</span>
            </div>
            <div className="queue-list">
              {queueRows.map((entry) => (
                <article key={`${entry.signalId}-${entry.status}`} className="queue-row">
                  <code>{entry.signalId}</code>
                  <span>{queueStatusLabel(entry.status)}</span>
                  <span>{entry.status === 'committed' ? 'approved + committed' : entry.status === 'dry_run_eligible' ? 'dry-run only' : 'not attempted'}</span>
                  <span>
                    {entry.txHash ? (
                      <a href={buildArcTxUrl(entry.txHash)} target="_blank" rel="noreferrer">
                        {truncateHash(entry.txHash)}
                      </a>
                    ) : (
                      entry.reason ?? `${formatPercent(entry.edgeBps)} edge / ${formatUsdMicro(entry.stakeMicroUsdc)}`
                    )}
                  </span>
                </article>
              ))}
              {queueRows.length === 0 ? (
                <article className="queue-row queue-row-empty">
                  <span>No queue rows yet. Run agents or cron to populate policy decisions.</span>
                </article>
              ) : null}
            </div>
          </section>

          <div className="signal-list">
            {arena.signals.map((signal) => {
              const disabledReason =
                signal.side === 'AVOID'
                  ? language === 'zh'
                    ? '风险智能体避开该设置'
                    : 'Risk agent avoided this setup'
                  : !isSignalEligibleForCommit(signal)
                    ? t.signalBelowThreshold
                    : undefined;

              return (
                <section key={signal.id} className="signal-card">
                  <div className="signal-card-top">
                    <div>
                      <p className="signal-id">{signal.id}</p>
                      <h3>
                        <Link href={`/signals/${encodeURIComponent(signal.id)}`}>
                          {signal.marketQuestion}
                        </Link>
                      </h3>
                    </div>
                    <span className={`decision ${signalDecisionClass(signal)}`}>{signal.side}</span>
                  </div>

                  <div className="signal-grid">
                    <div>
                      <span className="signal-label">{t.agent}</span>
                      <strong>{agentDisplayName(signal.agentName)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.assetStrike}</span>
                      <strong>
                        {signal.asset} {formatUsd(signal.thresholdUsd)}
                      </strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.confidence}</span>
                      <strong>{signal.confidence}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.edge}</span>
                      <strong>{formatPercent(signal.edgeBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.agentProbability}</span>
                      <strong>{formatPercent(signal.agentProbabilityBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.marketPrice}</span>
                      <strong>{formatPercent(signal.marketPriceBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.yesPrice}</span>
                      <strong>{formatPercent(signal.yesPriceBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.cappedKelly}</span>
                      <strong>{formatPercent(signal.kellyBps)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.riskFlags}</span>
                      <strong>
                        {signal.riskFlags.length > 0 ? signal.riskFlags.join(', ') : 'None'}
                      </strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.bond}</span>
                      <strong>{formatUsdMicro(signal.stakeMicroUsdc)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.expiry}</span>
                      <strong>{formatTimestampLabel(signal.expiresAt)}</strong>
                    </div>
                    <div>
                      <span className="signal-label">{t.status}</span>
                      <strong>{signal.status}</strong>
                    </div>
                  </div>

                  <div className="probability-lane" aria-label={t.probabilityRail}>
                    <div>
                      <span>{t.marketPrice}</span>
                      <i style={{ left: `${signal.marketPriceBps / 100}%` }} />
                    </div>
                    <div>
                      <span>{t.agentProbability}</span>
                      <i style={{ left: `${signal.agentProbabilityBps / 100}%` }} />
                    </div>
                  </div>

                  <ul className="reason-list signal-reasons">
                    {buildSignalReasons(signal, language).map((reason) => (
                      <li key={`${signal.id}-${reason}`}>{reason}</li>
                    ))}
                  </ul>

                  <div className="commit-cell">
                    <Link
                      href={`/signals/${encodeURIComponent(signal.id)}`}
                      className="signal-detail-link"
                    >
                      <Icon name="chart" />
                      {t.openSignal}
                    </Link>
                    {signal.arcTxHash ? (
                      <a href={buildArcTxUrl(signal.arcTxHash)} target="_blank" rel="noreferrer">
                        {truncateHash(signal.arcTxHash)}
                      </a>
                    ) : disabledReason ? (
                      <span className="muted">{disabledReason}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => runAction(() => commitSignal(signal))}
                        disabled={isPending}
                      >
                        <Icon name="wallet" />
                        {t.commitToArc}
                      </button>
                    )}
                  </div>
                </section>
              );
            })}

            {arena.signals.length === 0 ? (
              <div className="empty-card signal-empty">
                <p>{t.noSignal}</p>
              </div>
            ) : null}
          </div>
        </article>

        <aside className="panel rail-panel arc-rail">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">{t.arcCommitLane}</p>
              <h2>{t.arcSettlement}</h2>
            </div>
            <span className="panel-value">{metrics.committedSignals}</span>
          </div>

          <div className="commit-summary">
            {lastCommitResult ? (
              lastCommitResult.status === 'committed' ? (
                <>
                  <span className="summary-tone summary-positive">{t.commitConfirmed}</span>
                  <p>
                    <strong>{lastCommitResult.signalId}</strong> settled to Arc with tx{' '}
                    <code>{truncateHash(lastCommitResult.txHash)}</code>
                  </p>
                </>
              ) : (
                <>
                  <span className="summary-tone summary-risk">{t.commitBlocked}</span>
                  <p>
                    <strong>{lastCommitResult.signalId}</strong> remains gated:{' '}
                    {lastCommitResult.reason}
                  </p>
                </>
              )
            ) : latestSignal ? (
              <>
                <span className="summary-tone summary-neutral">{t.latestSignal}</span>
                <p>
                  <strong>{latestSignal.id}</strong> is ready for review in the Signal Board.
                </p>
              </>
            ) : (
              <>
                <span className="summary-tone summary-neutral">{t.awaitingForecast}</span>
                <p>{t.runAgentsToPopulate}</p>
              </>
            )}
          </div>

          <div className="mini-metrics">
            <article>
              <span>{t.arcStatus}</span>
              <strong>{commitArmed ? t.commitArmed : t.commitGuarded}</strong>
            </article>
            <article>
              <span>{t.usdcBonded}</span>
              <strong>{formatUsdMicro(metrics.totalBondedMicroUsdc)}</strong>
            </article>
            <article>
              <span>{t.arcMode}</span>
              <strong>USDC</strong>
            </article>
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <p className="panel-kicker">{t.leaderboard}</p>
              <span>{assetLeaderboard.length}</span>
            </div>
            <ul className="leaderboard-list">
              {assetLeaderboard.map((entry) => (
                <li key={entry.asset}>
                  <div>
                    <strong>{entry.asset}</strong>
                    <span>{entry.signalCount} signals</span>
                  </div>
                  <div className="leaderboard-metric">
                    <strong>{formatPercent(entry.scoreBps)}</strong>
                    <span>{entry.committedCount} committed</span>
                  </div>
                </li>
              ))}
              {assetLeaderboard.length === 0 ? (
                <li className="plain-list-item">{t.runAgentsToRank}</li>
              ) : null}
            </ul>
          </div>

          <div className="subpanel">
            <div className="subpanel-header">
              <p className="panel-kicker">{t.riskDiagnostics}</p>
              <span>{arena.signals.filter((signal) => signal.riskFlags.length > 0).length}</span>
            </div>
            <ul className="skip-list">
              {arena.signals
                .filter((signal) => signal.riskFlags.length > 0)
                .slice(0, 8)
                .map((signal) => (
                  <li key={`${signal.id}-risk`}>
                    <div>
                      <strong>{signal.riskFlags.join(', ')}</strong>
                      <span>{signal.marketQuestion}</span>
                    </div>
                    <code>{signal.asset}</code>
                  </li>
                ))}
              {arena.signals.every((signal) => signal.riskFlags.length === 0) ? (
                <li className="plain-list-item">{t.noRiskFlags}</li>
              ) : null}
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
