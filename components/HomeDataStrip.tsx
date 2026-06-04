import React from 'react';
import { HOME_COPY } from '@/lib/config/homeCopy';

interface HomeDataStripProps {
  activeSignals: number;
  activeSignalsDelta: number;
  usdcBondedMicro: bigint;
  usdcBondedDelta24hMicro: bigint;
  accuracyBps: number;
  accuracyDeltaPp: number;
  showdownsWon: number;
  showdownsLeaderName: string;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function formatWholeUsdc(microUsdc: bigint): string {
  return numberFormatter.format(Number(microUsdc / 1_000_000n));
}

function formatPercentFromBps(bps: number): string {
  return `${(bps / 100).toFixed(1)}%`;
}

function formatDeltaPp(deltaPp: number): string {
  const sign = deltaPp > 0 ? '+' : '';
  return `${sign}${deltaPp.toFixed(1)}pp`;
}

export function HomeDataStrip({
  activeSignals,
  activeSignalsDelta,
  usdcBondedMicro,
  usdcBondedDelta24hMicro,
  accuracyBps,
  accuracyDeltaPp,
  showdownsWon,
  showdownsLeaderName
}: HomeDataStripProps) {
  return (
    <section className="home-data-strip" data-component="home-data-strip">
      <StripCell
        label={HOME_COPY.strip.activeSignals}
        value={numberFormatter.format(activeSignals)}
        trend={`↗ ${numberFormatter.format(activeSignalsDelta)} in 1hr`}
      />
      <StripCell
        label={HOME_COPY.strip.usdcBonded}
        value={formatWholeUsdc(usdcBondedMicro)}
        trend={`↗ +${formatWholeUsdc(usdcBondedDelta24hMicro)} 24h`}
      />
      <StripCell
        label={HOME_COPY.strip.accuracy}
        value={formatPercentFromBps(accuracyBps)}
        trend={`↗ ${formatDeltaPp(accuracyDeltaPp)} / week`}
      />
      <StripCell
        label={HOME_COPY.strip.showdowns}
        value={numberFormatter.format(showdownsWon)}
        trend={`${showdownsLeaderName} leads`}
      />
    </section>
  );
}

function StripCell({
  label,
  value,
  trend
}: {
  label: string;
  value: string;
  trend: string;
}) {
  return (
    <div
      className="home-strip-cell"
      data-strip-cell
      data-source="live"
      aria-label={`${label} ${value} ${trend}`}
    >
      <p className="home-strip-label">{label}</p>
      <p className="home-strip-value">{value}</p>
      <p className="home-strip-trend">{trend}</p>
    </div>
  );
}
