import React from 'react';
import { AgentProfileCard } from '@/components/AgentProfileCard';
import {
  buildAgentReputationProfile,
  type SupportedAgentName
} from '@/lib/insights/readModels';
import { getRuntimeStore } from '@/lib/persistence/store';
import { getShowdownStore } from '@/lib/persistence/showdowns';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Agents · PredictArena'
};

const KNOWN_AGENTS: SupportedAgentName[] = ['volatility', 'momentum'];

type ShowdownList = Awaited<ReturnType<ReturnType<typeof getShowdownStore>['listAll']>>;

async function listShowdownsSafely(): Promise<ShowdownList> {
  try {
    return await getShowdownStore().listAll();
  } catch {
    return [];
  }
}

function countShowdownWins(agentName: SupportedAgentName, showdowns: ShowdownList) {
  return showdowns.filter((showdown) => {
    if (showdown.status === 'SettledA') {
      return showdown.agentA.name === agentName;
    }

    if (showdown.status === 'SettledB') {
      return showdown.agentB.name === agentName;
    }

    return false;
  }).length;
}

export default async function AgentsPage() {
  const state = await getRuntimeStore().getArenaState();
  const showdowns = await listShowdownsSafely();

  const profiles = KNOWN_AGENTS.map((agentName) => {
    const profile = buildAgentReputationProfile(state, agentName);

    return {
      profile,
      showdownsWon: countShowdownWins(agentName, showdowns)
    };
  });

  return (
    <section className="agent-page-shell">
      <div className="agent-page-head">
        <div>
          <p className="agent-kicker">Glass neon dossiers</p>
          <h1>Agents</h1>
        </div>
        <p className="agent-page-copy">
          Every card collapses live generation, bonded size, accuracy, and settled showdown
          victories into one drill-down entry point.
        </p>
      </div>

      <div className="agent-card-grid">
        {profiles.map(({ profile, showdownsWon }) => (
          <AgentProfileCard
            key={profile.agentName}
            profile={profile}
            showdownsWon={showdownsWon}
          />
        ))}
      </div>
    </section>
  );
}
