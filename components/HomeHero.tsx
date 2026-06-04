import React from 'react';
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
    <section className="home-hero" data-component="home-hero">
      <p className="home-hero-kicker">{kicker}</p>
      <h1 className="editorial-h1 home-hero-heading">
        <span>{HOME_COPY.h1Lead}</span>{' '}
        <em className="home-hero-emphasis">{HOME_COPY.h1Emphasis}</em>
      </h1>
      <p className="home-hero-subtitle">{HOME_COPY.subtitle}</p>
    </section>
  );
}
