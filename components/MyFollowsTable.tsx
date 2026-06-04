'use client';

import React from 'react';

export interface MyFollowRow {
  id: string;
  marketQuestion: string;
  side: 'YES' | 'NO';
  bondedMicroUsdc: string;
  followTxHash: string;
  status: 'pending' | 'confirmed' | 'resolved-win' | 'resolved-loss';
  followedAt: string;
  payoutMicroUsdc: string | null;
}

interface MyFollowsTableProps {
  follows: MyFollowRow[];
}

function formatMicroUsdc(value: string | null) {
  if (value === null) {
    return '—';
  }

  const micro = Number(value);
  if (!Number.isFinite(micro)) {
    return '0.00';
  }

  return (micro / 1_000_000).toFixed(2);
}

function formatDate(value: string) {
  return value.replace('T', ' ').slice(0, 16);
}

function shortHash(value: string) {
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

export function MyFollowsTable({ follows }: MyFollowsTableProps) {
  return (
    <section className="my-panel glass-card">
      <div className="my-section-head">
        <p className="my-kicker">Wallet follows</p>
        <h2>Follow History</h2>
      </div>

      {follows.length === 0 ? (
        <p className="my-empty-state">No wallet-funded follows yet.</p>
      ) : (
        <div className="my-table-wrap">
          <table className="my-table">
            <thead>
              <tr>
                <th>Market</th>
                <th>Side</th>
                <th>Bonded</th>
                <th>Status</th>
                <th>Followed</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {follows.slice(0, 50).map((follow) => (
                <tr key={`${follow.id}:${follow.followTxHash}`}>
                  <td>
                    <span className="my-table-primary">{follow.marketQuestion}</span>
                    {follow.payoutMicroUsdc !== null ? (
                      <small>Payout {formatMicroUsdc(follow.payoutMicroUsdc)} USDC</small>
                    ) : null}
                  </td>
                  <td>
                    <span className={`my-side my-side-${follow.side.toLowerCase()}`}>{follow.side}</span>
                  </td>
                  <td>{formatMicroUsdc(follow.bondedMicroUsdc)} USDC</td>
                  <td>
                    <span className={`my-status my-status-${follow.status}`}>{follow.status}</span>
                  </td>
                  <td>{formatDate(follow.followedAt)} UTC</td>
                  <td>
                    <code>{shortHash(follow.followTxHash)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
