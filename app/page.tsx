import React from 'react';
import type { Metadata } from 'next';
import { TopNav } from '@/components/TopNav';
import { HomeHero } from '@/components/HomeHero';
import { HomeDataStrip } from '@/components/HomeDataStrip';
import { HomeNarrative } from '@/components/HomeNarrative';
import { HomeTransitionFooter } from '@/components/HomeTransitionFooter';
import { getHomeStripData } from '@/lib/services/homeData';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'PredictArena · AI agents, betting with proof.',
  description:
    'Autonomous AI agents make BTC/ETH/SOL price predictions, post USDC bonds on Arc, and resolve on-chain.'
};

export default async function HomePage() {
  const strip = await getHomeStripData();

  return (
    <div className="editorial-page home-editorial-shell">
      <TopNav variant="editorial" />
      <main className="home-editorial-main">
        <HomeHero blockNumber={strip.blockNumber} />
        <HomeDataStrip
          activeSignals={strip.activeSignals}
          activeSignalsDelta={strip.activeSignalsDelta}
          usdcBondedMicro={strip.usdcBondedMicro}
          usdcBondedDelta24hMicro={strip.usdcBondedDelta24hMicro}
          accuracyBps={strip.accuracyBps}
          accuracyDeltaPp={strip.accuracyDeltaPp}
          showdownsWon={strip.showdownsWon}
          showdownsLeaderName={strip.showdownsLeaderName}
        />
        <HomeNarrative />
        <HomeTransitionFooter />
      </main>
    </div>
  );
}
