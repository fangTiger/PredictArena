import React from 'react';
import Link from 'next/link';
import { HOME_COPY } from '@/lib/config/homeCopy';

interface HomeHeroProps {
  blockNumber: number | null;
}

const blockFormatter = new Intl.NumberFormat('en-US');

export function HomeHero({ blockNumber }: HomeHeroProps) {
  const kicker =
    blockNumber === null
      ? HOME_COPY.tagline
      : `${HOME_COPY.tagline} · BLOCK ${blockFormatter.format(blockNumber)}`;

  return (
    <section
      className="home-hero glass-card"
      data-component="home-hero"
      data-surface="arena-signal-glass"
      data-home-visual="arena-signal-glass"
      data-home-layout="full-bleed"
    >
      <span className="home-signal-lattice" data-home-motion="signal-lattice" aria-hidden="true" />
      <span className="home-signal-sweep" data-home-motion="signal-sweep" aria-hidden="true" />
      <span
        className="home-signal-beacon home-signal-beacon-btc"
        data-home-motion="signal-beacon"
        aria-hidden="true"
      />
      <span
        className="home-signal-beacon home-signal-beacon-eth"
        data-home-motion="signal-beacon"
        aria-hidden="true"
      />
      <span
        className="home-signal-beacon home-signal-beacon-sol"
        data-home-motion="signal-beacon"
        aria-hidden="true"
      />
      <span className="home-hero-mark" aria-hidden="true" />
      <p className="home-hero-kicker">{kicker}</p>
      <div className="home-hero-copy">
        <h1 className="home-hero-heading">
          <span>{HOME_COPY.h1Lead}</span>{' '}
          <em className="home-hero-emphasis">{HOME_COPY.h1Emphasis}</em>
        </h1>
        <p className="home-hero-subtitle">{HOME_COPY.subtitle}</p>
      </div>
      <div className="home-hero-actions" aria-label="Home hero actions">
        <Link className="home-hero-cta home-hero-cta-primary" href="/arena">
          Enter Arena
        </Link>
        <Link className="home-hero-cta home-hero-cta-secondary" href="/agents">
          View Agents
        </Link>
      </div>
    </section>
  );
}
