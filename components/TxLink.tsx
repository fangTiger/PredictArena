import { buildArcTxUrl } from '@/lib/arc/explorer';

export function TxLink({ hash }: { hash: `0x${string}` | null }) {
  if (!hash) {
    return <span className="text-slate-500">Pending</span>;
  }

  return (
    <a
      href={buildArcTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-xs text-sky underline-offset-4 hover:underline"
    >
      {hash.slice(0, 10)}...{hash.slice(-8)}
    </a>
  );
}
