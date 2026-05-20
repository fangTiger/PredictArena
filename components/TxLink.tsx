import { buildArcTxUrl } from '@/lib/arc/explorer';

export function TxLink({ hash }: { hash: `0x${string}` | null }) {
  if (!hash) {
    return <span className="muted">Pending</span>;
  }

  return (
    <a
      href={buildArcTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="tx-link"
    >
      {hash.slice(0, 10)}...{hash.slice(-8)}
    </a>
  );
}
