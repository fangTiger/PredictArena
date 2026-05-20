export function AgentBadge({ agent }: { agent: 'volatility' | 'momentum' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs uppercase tracking-[0.24em] ${
        agent === 'volatility'
          ? 'border-mint/30 bg-mint/10 text-mint'
          : 'border-sky/30 bg-sky/10 text-sky'
      }`}
    >
      {agent}
    </span>
  );
}
