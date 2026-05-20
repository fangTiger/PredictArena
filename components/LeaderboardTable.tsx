import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/persistence/store';
import { formatBps, formatMicroUsdc } from '@/lib/utils/format';

function formatAgentName(agentName: LeaderboardEntry['agentName']) {
  return agentName === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';
}

export function LeaderboardTable({ entries }: { entries: LeaderboardEntry[] }) {
  return (
    <section className="leaderboard-table-shell">
      <div className="table-scroll">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Agent</th>
              <th>Generated</th>
              <th>Committed</th>
              <th>Avg Edge</th>
              <th>Bonded</th>
              <th>Refunded</th>
              <th>Slashed</th>
              <th>Paper ROI</th>
              <th>Brier</th>
              <th>Confidence Mix</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.agentName}>
                <td>{entry.rank}</td>
                <td>
                  <Link href="/arena" className="table-agent-link">
                    {formatAgentName(entry.agentName)}
                  </Link>
                </td>
                <td>{entry.generatedSignals}</td>
                <td>{entry.committedSignals}</td>
                <td>{formatBps(entry.averageEdgeBps)}</td>
                <td>{formatMicroUsdc(entry.totalBondedMicroUsdc)}</td>
                <td>{formatMicroUsdc(entry.refundedMicroUsdc)}</td>
                <td>{formatMicroUsdc(entry.slashedMicroUsdc)}</td>
                <td>{formatBps(entry.paperRoiBps)}</td>
                <td>
                  {entry.brierScoreBps === null ? 'Pending' : formatBps(entry.brierScoreBps)}
                </td>
                <td>
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
