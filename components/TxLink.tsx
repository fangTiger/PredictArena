import { buildArcTxUrl } from '@/lib/arc/explorer';

export function TxLink({ hash }: { hash: `0x${string}` | null }) {
  if (!hash) {
    return <span className="muted">Pending</span>;
  }

  const label = `View transaction ${hash} on Arc`;

  return (
    <a
      href={buildArcTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="tx-link"
      aria-label={label}
      title={label}
    >
      {hash.slice(0, 10)}...{hash.slice(-8)}
    </a>
  );
}
