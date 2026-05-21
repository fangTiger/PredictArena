import { formatBps, formatMicroUsdc } from '@/lib/utils/format';
import type { ArenaMetrics } from '@/lib/persistence/store';

export function MetricsStrip({ metrics }: { metrics: ArenaMetrics }) {
  const cards = [
    { label: 'Generated Signals', value: String(metrics.generatedSignals) },
    { label: 'Committed Signals', value: String(metrics.committedSignals) },
    { label: 'Open Signals', value: String(metrics.openSignals) },
    { label: 'Resolved Signals', value: String(metrics.resolvedSignals) },
    { label: 'Bonded USDC', value: formatMicroUsdc(metrics.totalBondedMicroUsdc) }
  ];

  return (
    <section className="deck-metrics">
      {cards.map((card) => (
        <article key={card.label} className="metric-card">
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </article>
      ))}
    </section>
  );
}
