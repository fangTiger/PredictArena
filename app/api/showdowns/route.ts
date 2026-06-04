import { NextResponse } from 'next/server';
import { getShowdownStore } from '@/lib/persistence/showdowns';
import type { ShowdownRecord } from '@/lib/persistence/store';

type ShowdownStatusFilter = 'active' | 'resolving' | 'settled' | 'all';

interface ShowdownsQuery {
  status: ShowdownStatusFilter;
  limit: number;
}

export const dynamic = 'force-dynamic';

function parseStatusFilter(value: string | null): ShowdownStatusFilter {
  if (
    value === 'active' ||
    value === 'resolving' ||
    value === 'settled' ||
    value === 'all'
  ) {
    return value;
  }

  return 'active';
}

function parseLimit(value: string | null): number {
  const parsed = Number.parseInt(value ?? '20', 10);
  if (!Number.isFinite(parsed)) {
    return 20;
  }

  return Math.min(Math.max(parsed, 1), 50);
}

function parseQuery(url: URL): ShowdownsQuery {
  return {
    status: parseStatusFilter(url.searchParams.get('status')),
    limit: parseLimit(url.searchParams.get('limit'))
  };
}

function matchesStatusFilter(
  record: ShowdownRecord,
  status: ShowdownStatusFilter,
  nowMs: number
): boolean {
  if (status === 'all') {
    return true;
  }

  if (status === 'settled') {
    return record.status === 'SettledA' || record.status === 'SettledB';
  }

  if (record.status !== 'Open') {
    return false;
  }

  const deadlineMs = Date.parse(record.deadline);
  return status === 'resolving' ? deadlineMs <= nowMs : deadlineMs > nowMs;
}

function capitalizeAgentName(name: string): string {
  return name.length === 0 ? name : `${name[0]!.toUpperCase()}${name.slice(1)}`;
}

function fallbackAgentThesis(agent: ShowdownRecord['agentA'] | ShowdownRecord['agentB']): string {
  return `${capitalizeAgentName(agent.name)} expects ${agent.side} with a ${(agent.probabilityBps / 100).toFixed(2)}% model line.`;
}

function serializeAgent(agent: ShowdownRecord['agentA'] | ShowdownRecord['agentB']) {
  return {
    ...agent,
    name: capitalizeAgentName(agent.name),
    confidence: agent.confidence ?? 'MEDIUM',
    thesis: agent.thesis ?? fallbackAgentThesis(agent)
  };
}

function serializeShowdown(record: ShowdownRecord) {
  return {
    id: record.externalId,
    onchainId: record.onchainId,
    marketId: record.marketId,
    marketQuestion: record.marketQuestion,
    agentA: serializeAgent(record.agentA),
    agentB: serializeAgent(record.agentB),
    bondMicroUsdc: String(record.bondPerSideMicroUsdc),
    deadline: record.deadline,
    status: record.status,
    openedAt: record.openedAt,
    settledAt: record.settledAt,
    openTxHash: record.openTxHash,
    settleTxHash: record.settleTxHash,
    resolvedOutcome: record.resolvedOutcome,
    resolvedPriceLabel: record.resolvedPriceLabel
  };
}

export async function GET(request: Request) {
  const query = parseQuery(new URL(request.url));
  const nowMs = Date.now();
  const showdowns = (await getShowdownStore().listAll())
    .filter((record) => matchesStatusFilter(record, query.status, nowMs))
    .sort((left, right) => right.openedAt.localeCompare(left.openedAt))
    .slice(0, query.limit)
    .map(serializeShowdown);

  return NextResponse.json({ showdowns });
}
