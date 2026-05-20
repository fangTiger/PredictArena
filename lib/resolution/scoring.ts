import type { AgentSignal } from '@/lib/polymarket/types';

export interface ResolutionAccountingInput {
  signal: AgentSignal;
  outcomeCorrect: boolean;
}

export interface ResolutionAccounting {
  resolvedCount: number;
  correctCount: number;
  accuracyBps: number;
  refundedMicroUsdc: number;
  slashedMicroUsdc: number;
  paperRoiBps: number;
  brierScoreBps: number | null;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function computeSignalCorrectness(signal: AgentSignal, yesOutcome: boolean): boolean {
  if (signal.side === 'YES') {
    return yesOutcome;
  }

  if (signal.side === 'NO') {
    return !yesOutcome;
  }

  return false;
}

export function computeBrierScoreBps(signal: AgentSignal, yesOutcome: boolean): number {
  const pYes = signal.pYesBps / 10_000;
  const actualYes = yesOutcome ? 1 : 0;
  return Math.round((pYes - actualYes) ** 2 * 10_000);
}

export function computePaperRoiBps(signal: AgentSignal, outcomeCorrect: boolean): number {
  return outcomeCorrect ? 10_000 - signal.marketPriceBps : -signal.marketPriceBps;
}

export function computeResolutionAccounting(
  entries: ResolutionAccountingInput[]
): ResolutionAccounting {
  const resolvedCount = entries.length;
  const correctCount = entries.filter((entry) => entry.outcomeCorrect).length;
  const brierScores = entries
    .map((entry) => entry.signal.resolution?.yesOutcome)
    .map((yesOutcome, index) =>
      yesOutcome === undefined ? null : computeBrierScoreBps(entries[index].signal, yesOutcome)
    )
    .filter((value): value is number => value !== null);

  return {
    resolvedCount,
    correctCount,
    accuracyBps: resolvedCount === 0 ? 0 : Math.round((correctCount / resolvedCount) * 10_000),
    refundedMicroUsdc: entries
      .filter((entry) => entry.outcomeCorrect)
      .reduce((sum, entry) => sum + entry.signal.stakeMicroUsdc, 0),
    slashedMicroUsdc: entries
      .filter((entry) => !entry.outcomeCorrect)
      .reduce((sum, entry) => sum + entry.signal.stakeMicroUsdc, 0),
    paperRoiBps: average(entries.map((entry) => computePaperRoiBps(entry.signal, entry.outcomeCorrect))),
    brierScoreBps: brierScores.length === 0 ? null : average(brierScores)
  };
}
