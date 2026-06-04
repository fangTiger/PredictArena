'use client';

import React from 'react';

export interface MyTxHistoryRow {
  txHash: string;
  blockNumber: number | null;
  timestamp: string;
  kind: 'follow-commit' | 'follow-resolve' | 'wallet-self';
  amountMicroUsdc: string | null;
  status: 'success' | 'failed';
  arcExplorerUrl: string;
}

interface MyTxHistoryTableProps {
  items: MyTxHistoryRow[];
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

export function MyTxHistoryTable({ items }: MyTxHistoryTableProps) {
  return (
    <section className="my-panel glass-card">
      <div className="my-section-head">
        <p className="my-kicker">Arc memory</p>
        <h2>Transaction History</h2>
      </div>

      {items.length === 0 ? (
        <p className="my-empty-state">No wallet transactions have been indexed yet.</p>
      ) : (
        <div className="my-table-wrap">
          <table className="my-table">
            <thead>
              <tr>
                <th>Tx</th>
                <th>Kind</th>
                <th>Amount</th>
                <th>Block</th>
                <th>Status</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {items.slice(0, 50).map((item) => (
                <tr key={`${item.txHash}:${item.kind}:${item.timestamp}`}>
                  <td>
                    <a href={item.arcExplorerUrl} target="_blank" rel="noreferrer">
                      <code>{shortHash(item.txHash)}</code>
                    </a>
                  </td>
                  <td>{item.kind}</td>
                  <td>{formatMicroUsdc(item.amountMicroUsdc)} USDC</td>
                  <td>{item.blockNumber ?? 'pending'}</td>
                  <td>
                    <span className={`my-status my-status-${item.status}`}>{item.status}</span>
                  </td>
                  <td>{formatDate(item.timestamp)} UTC</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
