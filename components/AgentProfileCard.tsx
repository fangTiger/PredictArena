import React from 'react';
import Link from 'next/link';
import type { AgentReputationProfile } from '@/lib/insights/readModels';
import { formatBps, formatMicroUsdc } from '@/lib/utils/format';

interface AgentProfileCardProps {
  profile: AgentReputationProfile;
  showdownsWon: number;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="agent-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function AgentProfileCard({ profile, showdownsWon }: AgentProfileCardProps) {
  return (
    <Link
      href={`/agents/${profile.agentName}`}
      className="agent-card-link"
      aria-label={profile.displayName}
    >
      <article className="agent-card glass-card">
        <div className="agent-card-head">
          <div>
            <p className="agent-kicker">Reputation profile</p>
            <h2>{profile.displayName}</h2>
          </div>
          <span className="agent-card-chip">{profile.openSignals} open</span>
        </div>

        <div className="agent-stat-grid">
          <Stat label="Generated signals" value={profile.generatedSignals.toLocaleString('en-US')} />
          <Stat label="Accuracy" value={formatBps(profile.accuracyBps)} />
          <Stat label="Bonded" value={formatMicroUsdc(profile.totalBondedMicroUsdc)} />
          <Stat label="Showdowns won" value={showdownsWon.toLocaleString('en-US')} />
        </div>
      </article>
    </Link>
  );
}
