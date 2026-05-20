export function AgentBadge({ agent }: { agent: 'volatility' | 'momentum' }) {
  const label = agent === 'volatility' ? 'Volatility Agent' : 'Momentum Agent';

  return (
    <span
      className={`status-chip ${agent === 'volatility' ? 'status-ready' : 'status-live'}`}
    >
      {label}
    </span>
  );
}
