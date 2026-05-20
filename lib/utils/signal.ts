import type { AgentSignal } from '@/lib/polymarket/types';

export function normalizeSignalIdParam(id: string): string {
  return decodeURIComponent(id);
}

export function isSignalEligibleForCommit(signal: AgentSignal): boolean {
  return signal.side !== 'AVOID' && signal.edgeBps >= 700 && signal.confidence !== 'LOW';
}

export function buildSignalExplanation(signal: AgentSignal): string {
  const thesis =
    signal.side === 'YES'
      ? `The ${signal.agentName} agent expects the market to settle YES.`
      : signal.side === 'NO'
        ? `The ${signal.agentName} agent expects the market to settle NO.`
        : `The ${signal.agentName} agent does not see enough edge to take risk.`;

  const riskNote =
    signal.riskFlags.length > 0
      ? ` Risk flags: ${signal.riskFlags.join(', ')}.`
      : ' No additional risk flags were raised.';

  return `${thesis} It priced ${signal.agentProbabilityBps / 100}% conviction against a ${signal.marketPriceBps / 100}% market line, producing ${signal.edgeBps / 100}% edge and ${signal.kellyBps / 100}% capped Kelly.${riskNote}`;
}
