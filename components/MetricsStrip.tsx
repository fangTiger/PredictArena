import { formatBps, formatMicroUsdc } from '@/lib/utils/format';
import type { ArenaMetrics } from '@/lib/persistence/store';

export function MetricsStrip({ metrics }: { metrics: ArenaMetrics }) {
  const cards = [
    { label: 'Generated Signals', value: String(metrics.generatedSignals) },
    { label: 'Committed Signals', value: String(metrics.committedSignals) },
    { label: 'Average Edge', value: formatBps(metrics.averageEdgeBps) },
    { label: 'Bonded USDC', value: formatMicroUsdc(metrics.totalBondedMicroUsdc) }
  ];

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <article
          key={card.label}
          className="rounded-[24px] border border-white/10 bg-slate-950/60 p-5 shadow-panel backdrop-blur"
        >
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{card.label}</p>
          <strong className="mt-3 block font-display text-3xl text-white">{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
