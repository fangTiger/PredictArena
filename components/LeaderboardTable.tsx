import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/persistence/store';
import { formatBps, formatMicroUsdc } from '@/lib/utils/format';

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/60 shadow-panel backdrop-blur">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-300">
          <thead className="bg-white/5 text-xs uppercase tracking-[0.24em] text-slate-500">
            <tr>
              <th className="px-5 py-4">Rank</th>
              <th className="px-5 py-4">Agent</th>
              <th className="px-5 py-4">Generated</th>
              <th className="px-5 py-4">Committed</th>
              <th className="px-5 py-4">Avg Edge</th>
              <th className="px-5 py-4">Bonded</th>
              <th className="px-5 py-4">Refunded</th>
              <th className="px-5 py-4">Slashed</th>
              <th className="px-5 py-4">Paper ROI</th>
              <th className="px-5 py-4">Brier</th>
              <th className="px-5 py-4">Confidence Mix</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.agentName} className="border-t border-white/10">
                <td className="px-5 py-4 text-white">{entry.rank}</td>
                <td className="px-5 py-4 text-white">
                  <Link href="/arena" className="hover:text-mint">
                    {entry.agentName}
                  </Link>
                </td>
                <td className="px-5 py-4">{entry.generatedSignals}</td>
                <td className="px-5 py-4">{entry.committedSignals}</td>
                <td className="px-5 py-4">{formatBps(entry.averageEdgeBps)}</td>
                <td className="px-5 py-4">{formatMicroUsdc(entry.totalBondedMicroUsdc)}</td>
                <td className="px-5 py-4">{formatMicroUsdc(entry.refundedMicroUsdc)}</td>
                <td className="px-5 py-4">{formatMicroUsdc(entry.slashedMicroUsdc)}</td>
                <td className="px-5 py-4">{formatBps(entry.paperRoiBps)}</td>
                <td className="px-5 py-4">
                  {entry.brierScoreBps === null ? 'Pending' : formatBps(entry.brierScoreBps)}
                </td>
                <td className="px-5 py-4">
                  L {entry.confidenceDistribution.low} / M {entry.confidenceDistribution.medium} / H{' '}
                  {entry.confidenceDistribution.high}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
