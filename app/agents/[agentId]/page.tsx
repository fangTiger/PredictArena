import React from 'react';
import { notFound } from 'next/navigation';
import { AgentReputationPanel } from '@/components/AgentReputationPanel';
import {
  buildAgentReputationProfile,
  isSupportedAgentName
} from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';

export const dynamic = 'force-dynamic';

interface AgentDetailPageProps {
  params: Promise<{
    agentId: string;
  }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { agentId } = await params;

  if (!isSupportedAgentName(agentId)) {
    notFound();
  }

  const state = await getRuntimeStore().getArenaState();
  const profile = buildAgentReputationProfile(state, agentId);

  return <AgentReputationPanel profile={profile} />;
}
