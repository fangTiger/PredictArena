'use client';

import React from 'react';

export interface MyOverviewSummary {
  usdcBalanceMicro: string;
  cumulativeBondedMicro: string;
  cumulativePayoutMicro: string;
  currentNetPnlMicro: string;
}

interface MyOverviewStripProps {
  data: MyOverviewSummary;
}

function formatMicroUsdc(value: string) {
  const micro = Number(value);
  if (!Number.isFinite(micro)) {
    return '0.00 USDC';
  }

  return `${(micro / 1_000_000).toLocaleString('en-US', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })} USDC`;
}

export function MyOverviewStrip({ data }: MyOverviewStripProps) {
  const cells = [
    {
      label: 'USDC Balance',
      value: formatMicroUsdc(data.usdcBalanceMicro),
      tone: 'neutral'
    },
    {
      label: 'Cumulative Bonded',
      value: formatMicroUsdc(data.cumulativeBondedMicro),
      tone: 'bonded'
    },
    {
      label: 'Cumulative Payout',
      value: formatMicroUsdc(data.cumulativePayoutMicro),
      tone: 'payout'
    },
    {
      label: 'Net PnL',
      value: formatMicroUsdc(data.currentNetPnlMicro),
      tone: data.currentNetPnlMicro.startsWith('-') ? 'loss' : 'gain'
    }
  ];

  return (
    <section className="my-overview-strip" aria-label="Overview">
      <div className="my-section-head">
        <p className="my-kicker">Wallet ledger</p>
        <h2>Overview</h2>
      </div>
      <div className="my-overview-grid">
        {cells.map((cell) => (
          <article key={cell.label} className={`my-overview-cell my-overview-cell-${cell.tone}`}>
            <span>{cell.label}</span>
            <strong>{cell.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
